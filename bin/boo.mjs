#!/usr/bin/env node
// boo: raise dead data from the command line, and prove nothing was lost.
//
//   boo raise <file.csv|photo.jpg> [--out dir]   clean CSVs + a sealed certificate
//   boo certify [--write]                        re-run the engine on the samples, compare with certificates/
//   boo verify <certificate.json> [source]       check a certificate's seal; with the source, replay it
//   boo gate                                     certify, and fail if anything is haunted or changed
//   boo hook gate|stop                           the same, for Kiro hooks (reads the hook event on stdin)
//   boo coverage                                 every acceptance criterion in .kiro/specs, and its test
//
// Photos need GEMINI_API_KEY (or GEMINI_ENV_FILE). CSV works offline, with rules only.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, basename, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { checkSeal, sameResult } from '../web/certificate.js'
import { raiseFile, gate, coverage, loadKey } from '../src/boo/engine.mjs'

const say = (...a) => console.log(...a)
const flag = name => process.argv.includes(name)
const opt = name => {
  const i = process.argv.indexOf(name)
  return i > 0 ? process.argv[i + 1] : null
}

const readStdin = () =>
  new Promise(done => {
    if (process.stdin.isTTY) return done('')
    let s = ''
    process.stdin.setEncoding('utf-8')
    process.stdin.on('data', c => (s += c))
    process.stdin.on('end', () => done(s))
    setTimeout(() => done(s), 1500)
  })

const block = reason => {
  console.log(JSON.stringify({ decision: 'block', reason }))
  console.error(reason)
  process.exit(2)
}

const [cmd, arg, arg2] = process.argv.slice(2)

if (cmd === 'raise') {
  if (!arg) (say('Usage: boo raise <file.csv|photo.jpg> [--out dir]'), process.exit(1))
  const out = opt('--out') ?? join(dirname(arg), `${basename(arg).replace(/\.[^.]+$/, '')}-raised`)
  const r = await raiseFile(arg, { key: loadKey() })
  mkdirSync(out, { recursive: true })
  for (const [name, text] of Object.entries(r.files)) writeFileSync(join(out, name), text)
  writeFileSync(join(out, 'certificate.json'), JSON.stringify(r.certificate, null, 2) + '\n')
  say(`Raised ${r.records.length} records from ${basename(arg)} (${r.headers.length} columns).`)
  for (const [k, list] of Object.entries(r.found)) if (list.length) say(`  ${list.length} × ${k}`)
  say(`${r.certificate.verdict}: ${r.certificate.passed}/${r.certificate.checks} checks. Seal ${r.certificate.seal.slice(0, 16)}`)
  say(`Wrote ${Object.keys(r.files).join(', ')} and certificate.json to ${out}`)
  process.exit(r.certificate.verdict === 'AT REST' ? 0 : 1)
} else if (cmd === 'certify') {
  const problems = await gate({ write: flag('--write'), log: say })
  if (problems.length) (problems.forEach(p => console.error(p)), process.exit(1))
} else if (cmd === 'verify') {
  if (!arg) (say('Usage: boo verify <certificate.json> [source file]'), process.exit(1))
  const cert = JSON.parse(readFileSync(arg, 'utf-8'))
  const sealed = await checkSeal(cert)
  say(sealed ? `✔ Seal intact: ${cert.subject}, ${cert.verdict}` : '✖ Seal broken: this certificate was changed after it was issued.')
  if (sealed && arg2) {
    const again = (await raiseFile(arg2)).certificate
    const same = sameResult(cert, again)
    say(same ? '✔ Replayed from the source: same records, same money, same verdict.' : '✖ Replayed from the source: the result is different.')
    process.exit(same ? 0 : 1)
  }
  process.exit(sealed ? 0 : 1)
} else if (cmd === 'gate') {
  const problems = await gate({ log: say })
  if (problems.length) (problems.forEach(p => console.error(p)), process.exit(1))
} else if (cmd === 'hook') {
  const raw = await readStdin()
  let input = {}
  try {
    input = raw ? JSON.parse(raw) : {}
  } catch {}
  const command = String(input?.tool_input?.command ?? '')
  if (arg === 'gate') {
    // Only git commit, push and merge are gated; every other command passes at once.
    if (command && !/\bgit\s+(commit|push|merge)\b/.test(command)) process.exit(0)
    const problems = await gate()
    if (problems.length) block(`Boo's proof gate: ${problems.join(' | ')}`)
    process.exit(0)
  }
  if (arg === 'stop') {
    const problems = await gate()
    const cov = coverage()
    if (problems.length) block(`Not done yet. ${problems.join(' | ')} Fix the engine until every certificate is AT REST, then stop.`)
    if (cov.stale.length) block(`Tests name acceptance criteria that no longer exist: ${cov.stale.join(', ')}. Fix the tags or the specs.`)
    process.exit(0)
  }
} else if (cmd === 'coverage') {
  const c = coverage()
  say(`${c.covered.length} of ${c.criteria.length} acceptance criteria are named by a test (${Math.round((c.covered.length / c.criteria.length) * 100)}%).`)
  if (flag('--list')) for (const u of c.uncovered) say(`  untested: [${u.id}] ${u.text.slice(0, 90)}`)
  if (c.stale.length) (console.error(`Stale: ${c.stale.join(', ')}`), process.exit(1))
} else {
  say(readFileSync(fileURLToPath(import.meta.url), 'utf-8').split('\n').slice(1, 11).map(l => l.replace(/^\/\/ ?/, '')).join('\n'))
}
