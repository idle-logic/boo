// Boo's engine for Node: raise a file, certify the demo against its hidden truth,
// gate on the committed certificates, and trace acceptance criteria to tests.
// Used by bin/boo.mjs (the CLI, the git pre-commit check, the Kiro hooks) and the MCP server.

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs'
import { join, basename, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseCsv, guessKinds, raise, cleanFiles } from '../../web/raise.js'
import { certify, checkSeal, sameResult, sha256 } from '../../web/certificate.js'
import { slotlyRecords } from '../../web/data.js'
import { readWithRules, findingsFor } from '../../web/interpret.js'
import { idleRecords } from '../../web/switch.js'
import { storeFrom } from '../../web/edits.js'

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const CERTS = process.env.BOO_CERTS ?? join(ROOT, 'certificates')
const SAMPLES = [{ id: 'fittrack-members', file: join(ROOT, 'web/samples/fittrack-members.csv') }]

export function loadKey() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY
  const f = process.env.GEMINI_ENV_FILE
  if (f && existsSync(f)) return /^\s*GEMINI_API_KEY\s*=\s*(.+?)\s*$/m.exec(readFileSync(f, 'utf-8'))?.[1]?.replace(/^["']|["']$/g, '')
  return null
}

/** The new app's shape for the raised records, the same mapping the browser uses. */
const newAppFrom = records => ({
  clients: records.map(c => ({ name: c.name, phone: c.phone, vip: c.vip, credit: c.credit })),
  packages: records.flatMap(c => c.packages.map(p => ({ client: c.name, left: p.left, of: p.of, paid: p.paid }))),
})

/** Raise a file (rules only, so the result is exactly repeatable) and certify the clean files against it. */
export async function raiseFile(file, { key = null } = {}) {
  const bytes = readFileSync(file)
  let headers, rows, kinds
  if (/\.(png|jpe?g|webp)$/i.test(file)) {
    if (!key) throw new Error('Reading a photo needs GEMINI_API_KEY.')
    const { readImage } = await import('../agent/ai.js')
    const mime = /\.png$/i.test(file) ? 'image/png' : /\.webp$/i.test(file) ? 'image/webp' : 'image/jpeg'
    const out = await readImage({ mime, data: bytes.toString('base64') }, key)
    ;({ headers, rows } = out)
    kinds = guessKinds(headers, rows)
  } else {
    ;[headers, ...rows] = parseCsv(bytes.toString('utf-8'))
    kinds = guessKinds(headers, rows)
  }
  const { records, found } = raise({ headers, rows, kinds })
  const files = cleanFiles(records)
  // The check that matters: read the clean files back and compare them with what was raised.
  const back = parseCsv(files['clients.csv']).slice(1).map(r => ({ name: r[0], phone: r[1], vip: r[3] === 'Yes', credit: r[5] }))
  const backPk = parseCsv(files['packages.csv']).slice(1).map(r => ({ client: r[0], left: r[2], of: r[3], paid: r[4] }))
  const certificate = await certify({
    subject: `Raised ${basename(file)}`,
    source: { name: basename(file), sha256: await sha256(bytes.toString('base64')), rows: rows.length, columns: headers.length },
    expected: newAppFrom(records),
    actual: { clients: back, packages: backPk },
  })
  return { headers, kinds, records, found, files, certificate }
}

/** The demo, end to end without a browser: read Slotly with rules, clean with the default choices, compare with the truth. */
export async function certifySample() {
  const old = slotlyRecords()
  const read = readWithRules(old)
  const decisions = Object.fromEntries(findingsFor(old, read).map(f => [f.key, f.choices?.[0]?.[0]]))
  const store = { clients: [], services: [], products: [], staff: [], packages: [], bookings: [], policies: {}, changed() {} }
  storeFrom(idleRecords(read, decisions), store)
  const truth = old.truth
  return certify({
    subject: 'Slotly → Idle, rules engine against the hidden truth',
    source: { name: 'web/data.js slotlyRecords()', sha256: await sha256(JSON.stringify({ customers: old.customers, services: old.services, staff: old.staff, appointments: old.appointments, terms: old.terms })) },
    expected: {
      clients: truth.clients.map(c => ({ name: c.name, phone: c.phone, vip: c.vip, credit: c.credit })),
      packages: truth.clients.flatMap(c => c.packages.map(p => ({ client: c.name, left: p.left, of: p.of, paid: p.paid }))),
      bookings: truth.bookings,
    },
    actual: store,
  })
}

async function everyCertificate() {
  const out = [{ id: 'slotly-sample', cert: await certifySample() }]
  for (const s of SAMPLES) out.push({ id: s.id, cert: (await raiseFile(s.file)).certificate })
  return out
}

/** Certify everything and compare with what is committed. Returns a list of problems (empty means at rest). */
export async function gate({ write = false, log = () => {} } = {}) {
  const problems = []
  mkdirSync(CERTS, { recursive: true })
  for (const { id, cert } of await everyCertificate()) {
    const path = join(CERTS, `${id}.json`)
    if (cert.verdict !== 'AT REST') problems.push(`${id}: STILL HAUNTED (${cert.passed}/${cert.checks}) ${cert.detail.filter(d => !d.pass).map(d => `${d.check}: ${d.detail}`).join('; ')}`)
    if (write) writeFileSync(path, JSON.stringify(cert, null, 2) + '\n')
    else if (!existsSync(path)) problems.push(`${id}: no committed certificate. Run "boo certify --write".`)
    else {
      const committed = JSON.parse(readFileSync(path, 'utf-8'))
      if (!(await checkSeal(committed))) problems.push(`${id}: the committed certificate's seal is broken.`)
      else if (!sameResult(committed, cert)) problems.push(`${id}: the engine now gives a different result than the committed certificate. If that is intended, run "boo certify --write" and commit it.`)
    }
    log(`${cert.verdict === 'AT REST' ? '✔' : '✖'} ${id}: ${cert.verdict}, ${cert.passed}/${cert.checks} checks, seal ${cert.seal.slice(0, 12)}`)
  }
  return problems
}

/** Every WHEN/THEN acceptance criterion, and the tests that name it like [spec 1.2]. */
export function coverage() {
  const specs = join(ROOT, '.kiro/specs')
  const criteria = []
  for (const spec of readdirSync(specs)) {
    const p = join(specs, spec, 'requirements.md')
    if (!existsSync(p)) continue
    let req = 0
    for (const line of readFileSync(p, 'utf-8').split('\n')) {
      const r = /^### Requirement (\d+)/.exec(line)
      if (r) req = Number(r[1])
      const c = /^(\d+)\. (WHEN|IF|WHILE)\b/.exec(line)
      if (c && req) criteria.push({ id: `${spec} ${req}.${c[1]}`, text: line.slice(c[0].length - c[2].length) })
    }
  }
  const tests = readdirSync(join(ROOT, 'tests')).filter(f => f.endsWith('.test.js')).map(f => readFileSync(join(ROOT, 'tests', f), 'utf-8')).join('\n')
  const e2e = existsSync(join(ROOT, 'tests/e2e/run.mjs')) ? readFileSync(join(ROOT, 'tests/e2e/run.mjs'), 'utf-8') : ''
  const named = new Set([...(tests + e2e).matchAll(/\[([a-z0-9-]+ \d+\.\d+)\]/g)].map(m => m[1]))
  const known = new Set(criteria.map(c => c.id))
  return {
    criteria,
    covered: criteria.filter(c => named.has(c.id)),
    uncovered: criteria.filter(c => !named.has(c.id)),
    stale: [...named].filter(id => !known.has(id)),
  }
}

