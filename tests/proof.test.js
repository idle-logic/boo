// The proof, the command line, the gates and the export: Boo's promise that nothing is lost.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, mkdtempSync, cpSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { certify, checkSeal, sameResult } from '../web/certificate.js'
import { raiseFile, certifySample, coverage } from '../src/boo/engine.mjs'
import { parseCsv, guessKinds, guessTarget, raise, cleanFiles } from '../web/raise.js'
import { PRESETS, autoMap, exportTo, proveExport, headersFrom, fieldFor } from '../web/destinations.js'
import { readItemName, readPrice, readMinutes, fixProduct, fixStaff, fixService } from '../web/habits.js'
import { findings as repoFindings } from '../tools/public-repo-check.mjs'
import { slotlyRecords } from '../web/data.js'
import { readWithRules } from '../web/interpret.js'
import { crewsFor, idleRecords } from '../web/switch.js'

const ROOT = new URL('..', import.meta.url)
const file = p => new URL(p, ROOT)
const node = (args, input = '', env = {}) => spawnSync(process.execPath, args, { cwd: file('.'), input, encoding: 'utf-8', env: { ...process.env, ...env } })
const GYM = 'web/samples/fittrack-members.csv'

// ------------------------------------------------------------- the certificate

const pk = (client, left, of, paid) => ({ client, left, of, paid })
const clients = [{ name: 'Mei Tan', phone: '9123 4567', vip: true, credit: 50 }, { name: 'Sam Lee', phone: '8123 4567', vip: false, credit: 0 }]

test('a certificate compares every set and every dollar, and says AT REST or STILL HAUNTED [proof-certificate 1.1] [proof-certificate 1.2] [proof-certificate 1.3]', async () => {
  const expected = { clients, packages: [pk('Mei Tan', 8, 10, 300)] }
  const good = await certify({ subject: 't', expected, actual: structuredClone(expected) })
  assert.equal(good.verdict, 'AT REST')
  assert.equal(good.passed, good.checks)
  assert.deepEqual(good.money.prepaid, { expected: 300, arrived: 300 })
  assert.deepEqual(good.money.credit, { expected: 50, arrived: 50 })
  const bad = await certify({ subject: 't', expected, actual: { clients, packages: [] } })
  assert.equal(bad.verdict, 'STILL HAUNTED')
  assert.equal(bad.sets.packages.missing.length, 1, 'the missing package is listed')
  assert.ok(bad.detail.some(d => d.check === 'prepaid dollars' && !d.pass))
})

test('the seal covers everything but the issue time, and any change breaks it [proof-certificate 1.4] [proof-certificate 2.1] [proof-certificate 2.3]', async () => {
  const a = await certify({ subject: 't', expected: { clients }, actual: { clients } })
  await new Promise(r => setTimeout(r, 5))
  const b = await certify({ subject: 't', expected: { clients }, actual: { clients } })
  assert.match(a.seal, /^[0-9a-f]{64}$/)
  assert.equal(a.seal, b.seal, 'issued at different times, same seal')
  assert.ok(sameResult(a, b))
  assert.ok(await checkSeal(a))
  assert.equal(await checkSeal({ ...a, passed: 99 }), false)
  assert.equal(await checkSeal({ ...a, sets: { ...a.sets, clients: { ...a.sets.clients, count: 3 } } }), false)
  assert.ok(await checkSeal({ ...a, issued: 'another day' }), 'the issue time is not sealed')
})

test('the demo engine, without a browser, matches the hidden truth [proof-certificate 4.1] [swarm-migration 2.1] [swarm-migration 2.2]', async () => {
  const cert = await certifySample()
  assert.equal(cert.verdict, 'AT REST', cert.detail.filter(d => !d.pass).map(d => d.detail).join('; '))
  assert.equal(cert.sets.clients.count, 42)
  assert.ok(cert.sets.bookings.count > 0)
})

test('raising a file is repeatable and replays to the same certificate [boo-cli 1.3] [proof-certificate 2.2]', async () => {
  const a = await raiseFile(file(GYM).pathname.replace(/^\/([A-Z]:)/, '$1'))
  const b = await raiseFile(file(GYM).pathname.replace(/^\/([A-Z]:)/, '$1'))
  assert.equal(a.certificate.verdict, 'AT REST')
  assert.ok(sameResult(a.certificate, b.certificate))
  assert.equal(a.certificate.seal, b.certificate.seal)
})

// ------------------------------------------------------------- the command line and the gates

test('boo raise writes clean files and a certificate; boo verify checks the seal and replays [boo-cli 1.1] [boo-cli 2.1]', () => {
  const out = mkdtempSync(join(tmpdir(), 'boo-'))
  const r = node(['bin/boo.mjs', 'raise', GYM, '--out', out])
  assert.equal(r.status, 0, r.stderr)
  for (const f of ['clients.csv', 'packages.csv', 'certificate.json']) assert.ok(existsSync(join(out, f)), f)
  const v = node(['bin/boo.mjs', 'verify', join(out, 'certificate.json'), GYM])
  assert.equal(v.status, 0, v.stdout)
  assert.match(v.stdout, /Seal intact/)
  assert.match(v.stdout, /same records, same money, same verdict/)
  const cert = JSON.parse(readFileSync(join(out, 'certificate.json'), 'utf-8'))
  writeFileSync(join(out, 'certificate.json'), JSON.stringify({ ...cert, verdict: 'AT REST', passed: 999 }))
  assert.notEqual(node(['bin/boo.mjs', 'verify', join(out, 'certificate.json')]).status, 0, 'a changed certificate fails')
})

test('a photo needs a Gemini key [boo-cli 1.2]', async () => {
  await assert.rejects(raiseFile(file('web/samples/paper-client-book.jpg').pathname.replace(/^\/([A-Z]:)/, '$1'), { key: null }), /GEMINI_API_KEY/)
})

test('the gate passes on the committed certificates and fails when one is changed [boo-cli 3.1] [proof-certificate 4.2] [kiro-gates 1.1]', () => {
  assert.equal(node(['bin/boo.mjs', 'gate']).status, 0)
  const dir = mkdtempSync(join(tmpdir(), 'boo-certs-'))
  cpSync(file('certificates').pathname.replace(/^\/([A-Z]:)/, '$1'), dir, { recursive: true })
  const p = join(dir, 'slotly-sample.json')
  const cert = JSON.parse(readFileSync(p, 'utf-8'))
  writeFileSync(p, JSON.stringify({ ...cert, money: { ...cert.money, prepaid: { expected: 1, arrived: 1 } } }))
  const r = node(['bin/boo.mjs', 'gate'], '', { BOO_CERTS: dir })
  assert.notEqual(r.status, 0)
  assert.match(r.stderr, /seal is broken/)
  const hook = node(['bin/boo.mjs', 'hook', 'gate'], JSON.stringify({ tool_input: { command: 'git commit -m x' } }), { BOO_CERTS: dir })
  assert.equal(hook.status, 2, 'Kiro blocks the commit')
  assert.equal(JSON.parse(hook.stdout.trim().split('\n').pop()).decision, 'block')
})

test('the hook lets every other command through at once [boo-cli 3.3] [kiro-gates 1.2]', () => {
  const t0 = Date.now()
  const r = node(['bin/boo.mjs', 'hook', 'gate'], JSON.stringify({ tool_input: { command: 'npm test' } }))
  assert.equal(r.status, 0)
  assert.ok(Date.now() - t0 < 5000)
})

test('the stop hook sends the agent back while the proof fails [kiro-gates 2.1]', () => {
  const dir = mkdtempSync(join(tmpdir(), 'boo-stop-'))
  const r = node(['bin/boo.mjs', 'hook', 'stop'], '{}', { BOO_CERTS: dir })
  assert.equal(r.status, 2)
  assert.match(JSON.parse(r.stdout.trim().split('\n').pop()).reason, /Not done yet/)
  assert.equal(node(['bin/boo.mjs', 'hook', 'stop'], '{}').status, 0, 'at rest, it lets the agent stop')
})

test('every test tag names a real acceptance criterion [boo-cli 3.2]', () => {
  const c = coverage()
  assert.deepEqual(c.stale, [])
  assert.ok(c.criteria.length > 100)
  assert.ok(c.covered.length / c.criteria.length > 0.6)
})

test('the public repo check blocks dashes, keys, env files and home paths [kiro-gates 3.1]', () => {
  const diff = ['+++ b/web/main.js', '+const a = "Boo \u2014 the ghost"', '+const k = "AIza' + 'x'.repeat(35) + '"', '+++ b/web/x.js', '+// C:\\Users\\someone\\file', '+++ b/web/ok.js', '+const fine = 1'].join('\n')
  const f = repoFindings(['web/main.js', '.env.local', 'web/x.js'], diff)
  assert.ok(f.some(x => /secret or env file/.test(x)))
  assert.ok(f.some(x => /dash/.test(x)))
  assert.ok(f.some(x => /API key/.test(x)))
  assert.ok(f.some(x => /home folder/.test(x)))
  assert.deepEqual(repoFindings(['web/ok.js'], '+++ b/web/ok.js\n+const fine = 1'), [])
})

test('git and CI run the same gates as Kiro [kiro-gates 4.1] [kiro-gates 4.2]', () => {
  const pre = readFileSync(file('.githooks/pre-commit'), 'utf-8')
  for (const c of ['tools/public-repo-check.mjs', 'npm test', 'bin/boo.mjs gate']) assert.ok(pre.includes(c), c)
  const ci = readFileSync(file('.github/workflows/proof.yml'), 'utf-8')
  for (const c of ['npm test', 'bin/boo.mjs gate', 'bin/boo.mjs coverage']) assert.ok(ci.includes(c), c)
})

test('the Power, the agent and the hooks are wired to the real commands [kiro-gates 5.1] [kiro-gates 5.2] [kiro-gates 6.1] [kiro-gates 6.2]', () => {
  const power = readFileSync(file('powers/boo-migrate/POWER.md'), 'utf-8')
  assert.match(power, /^---\nname: boo-migrate\n/)
  assert.ok(JSON.parse(readFileSync(file('powers/boo-migrate/mcp.json'), 'utf-8')).mcpServers.boo)
  assert.ok(existsSync(file('powers/boo-migrate/steering/migration-workflow.md')))
  const agent = JSON.parse(readFileSync(file('.kiro/agents/boo-migrator.json'), 'utf-8'))
  assert.ok(agent.resources.some(r => r.startsWith('skill://')) && agent.resources.some(r => r.includes('steering')))
  assert.ok(agent.tools.includes('@boo'))
  assert.ok(agent.hooks.preToolUse.some(h => h.command === 'node bin/boo.mjs hook gate'))
  assert.ok(agent.hooks.stop.some(h => h.command === 'node bin/boo.mjs hook stop'))
  for (const s of ['workaround-hunting', 'grounded-ai', 'boo-migration-workflow']) assert.match(readFileSync(file(`.kiro/skills/${s}/SKILL.md`), 'utf-8'), new RegExp(`^---\\nname: ${s}\\n`))
  const trace = JSON.parse(readFileSync(file('.kiro/hooks/trace-criteria-on-spec-save.kiro.hook'), 'utf-8'))
  assert.deepEqual(trace.when.patterns, ['.kiro/specs/**/requirements.md'])
  const recert = JSON.parse(readFileSync(file('.kiro/hooks/recertify-on-engine-change.kiro.hook'), 'utf-8'))
  assert.ok(recert.when.patterns.includes('web/habits.js') && /boo\.mjs gate/.test(recert.then.prompt))
  for (const h of ['boo-proof-gate.json', 'boo-stop-check.json', 'public-repo-check.json']) {
    const j = JSON.parse(readFileSync(file(`.kiro/hooks/${h}`), 'utf-8'))
    assert.ok(j.hooks[0].enabled && j.hooks[0].action.type === 'command', h)
  }
})

test('the MCP server raises a CSV with a certificate and catches a changed one [kiro-gates 5.3]', async () => {
  const { Client } = await import('@modelcontextprotocol/sdk/client/index.js')
  const { StdioClientTransport } = await import('@modelcontextprotocol/sdk/client/stdio.js')
  const c = new Client({ name: 'test', version: '1' })
  await c.connect(new StdioClientTransport({ command: process.execPath, args: ['mcp/server.js'], cwd: file('.').pathname.replace(/^\/([A-Z]:)/, '$1') }))
  try {
    const r = JSON.parse((await c.callTool({ name: 'boo_raise_csv', arguments: { csv: readFileSync(file(GYM), 'utf-8'), name: 'gym.csv' } })).content[0].text)
    assert.equal(r.certificate.verdict, 'AT REST')
    assert.ok(r.found.length >= 5 && r.files['clients.csv'])
    const v = JSON.parse((await c.callTool({ name: 'boo_verify_certificate', arguments: { certificate: JSON.stringify({ ...r.certificate, passed: 0 }) } })).content[0].text)
    assert.equal(v.sealed, false)
  } finally {
    await c.close()
  }
})

// ------------------------------------------------------------- raising by kind of record

const menu = 'Item,Price,Description,Category\n"Dragon Roll ★ (SPICY)",$18 / $24 large,eel,Rolls\n"Rainbow Roll (GF)",$16,fish,Rolls\n"Miso Soup SOLD OUT",4.50,,Starters\n"Gyoza ★ chef\'s pick",$10,,Starters\n'

test('a menu goes to products, cleaned by item rules [raise-anything 5.1] [raise-anything 5.2]', () => {
  const [h, ...rows] = parseCsv(menu)
  assert.equal(guessTarget(h, rows), 'products')
  const { records, found } = raise({ headers: h, rows, kinds: guessKinds(h, rows), target: 'products' })
  assert.deepEqual(records.map(r => r.name), ['Dragon Roll', 'Rainbow Roll', 'Miso Soup', 'Gyoza'])
  assert.deepEqual(records.map(r => r.price), [18, 16, 4.5, 10])
  assert.equal(records[2].stock, 0)
  assert.deepEqual(records[1].allergens, ['GF'])
  assert.equal(found.featured.length, 2)
  assert.equal(found.prices.length, 1)
  assert.equal(guessTarget(['Name', 'Role', 'Phone'], []), 'team')
  assert.equal(guessTarget(['Service', 'Duration', 'Price'], []), 'services')
  assert.equal(guessTarget(['Name', 'Mobile', 'Email', 'Notes'], []), 'clients')
})

test('marks on items, prices and minutes typed the old way [seance-and-afterlife 3.7]', () => {
  assert.deepEqual(readItemName('Edamame (V, contains soy)'), { name: 'Edamame', featured: false, soldOut: false, tags: ['V'], allergens: ['Contains soy'] })
  assert.deepEqual(readPrice('$18 / $24 large'), { price: 18, extra: '$18 / $24 large' })
  assert.deepEqual(readPrice('S$12.50'), { price: 12.5, extra: '' })
  assert.equal(readMinutes('1h 15'), 75)
  assert.equal(readMinutes('90 min'), 90)
  const p = fixProduct({ name: 'Dragon Roll special ★ (GF) SOLD OUT', price: '$12 / $16 large' })
  assert.equal(p.values.name, 'Dragon Roll special')
  assert.equal(p.values.price, '12')
  assert.equal(p.values.stock, '0')
  assert.ok(p.fixes.length >= 3)
  assert.equal(fixProduct({ name: 'Plain Bowl', price: '9' }), null)
  assert.equal(fixService({ name: 'Express facial', price: '$40', minutes: '1h 15' }).values.minutes, '75')
  assert.equal(fixStaff({ name: 'Sam Lee (PART TIME)', phone: '9123 4567 / 6123 4567' }).values.role, 'Part time')
})

test('a wide export shows the columns that matter and finds the name among many [raise-anything 2.4] [raise-anything 2.1]', () => {
  const h = ['Type', 'ID', 'Created', 'Description', 'Amount', 'Currency', 'Fees', 'Customer ID', 'Customer Email', 'Customer Name', 'Status']
  const k = guessKinds(h, [])
  assert.equal(k[h.indexOf('Customer Name')], 'name')
  assert.equal(k[h.indexOf('Customer Email')], 'email')
  assert.equal(k[h.indexOf('Customer ID')], 'unknown')
  assert.equal(k.filter(x => x === 'name').length, 1)
})

test('unknown answers from Gemini fall back to the guess [raise-anything 2.3]', async () => {
  const { mapColumnsAi } = await import('../web/ai.js')
  const real = globalThis.fetch
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ kinds: ['name', 'spaceship', 'email'], target: 'planets', recordKind: 'client', title: 'A <b>book</b>' }) })
  try {
    const out = await mapColumnsAi(['Name', 'X', 'Mail'], [])
    assert.deepEqual(out.kinds, ['name', 'unknown', 'email'])
    assert.equal(out.target, null, 'an unknown destination is ignored')
    assert.doesNotMatch(out.title, /[<>]/, 'no markup gets through in a title')
  } finally {
    globalThis.fetch = real
  }
})

test('clean files for each kind of record [raise-anything 4.3]', () => {
  const [h, ...rows] = parseCsv(readFileSync(file(GYM), 'utf-8'))
  const { records } = raise({ headers: h, rows, kinds: guessKinds(h, rows) })
  const files = cleanFiles(records)
  assert.deepEqual(Object.keys(files), ['clients.csv', 'packages.csv'])
  assert.equal(parseCsv(files['clients.csv']).length - 1, records.length)
  const [mh, ...mr] = parseCsv(menu)
  assert.deepEqual(Object.keys(cleanFiles(raise({ headers: mh, rows: mr, kinds: guessKinds(mh, mr), target: 'products' }).records, 'products')), ['products.csv'])
})

// ------------------------------------------------------------- into any software

const gym = () => {
  const [h, ...rows] = parseCsv(readFileSync(file(GYM), 'utf-8'))
  return raise({ headers: h, rows, kinds: guessKinds(h, rows) }).records
}

test('a preset writes exactly its columns and proves every row and name [export-anywhere 1.1] [export-anywhere 3.1]', () => {
  const recs = gym()
  const p = PRESETS.find(x => x.id === 'google-contacts')
  const map = autoMap(p.headers, 'clients')
  const csv = exportTo(recs, 'clients', p.headers, map)
  assert.deepEqual(parseCsv(csv)[0], p.headers)
  const proof = proveExport(recs, 'clients', csv, map)
  assert.equal(proof.passed, proof.checks, proof.lines.join(' '))
})

test("any app's own template is followed exactly, names split, handles made, TRUE where needed [export-anywhere 1.2] [export-anywhere 1.3] [export-anywhere 2.1] [export-anywhere 2.2]", () => {
  const headers = headersFrom('Given name,Family name,Mobile phone,Customer tags,Internal memo,Active\nx,y,z,,,\n')
  assert.deepEqual(headers, ['Given name', 'Family name', 'Mobile phone', 'Customer tags', 'Internal memo', 'Active'])
  const map = autoMap(headers, 'clients')
  assert.deepEqual(map, ['first name', 'last name', 'phone', 'tags', 'notes', 'yes'])
  const row = parseCsv(exportTo([{ name: 'Sarah Lim', phone: '9123 4567', vip: true, notes: '' }], 'clients', headers, map))[1]
  assert.deepEqual(row.slice(0, 4), ['Sarah', 'Lim', '9123 4567', 'VIP'])
  assert.equal(row[5], 'TRUE')
  assert.equal(fieldFor('Handle', 'products'), 'handle')
  assert.equal(fieldFor('Spaceship', 'clients'), '')
})

test('nothing is lost when a destination has no column for it, and the proof says so when it would be [export-anywhere 2.3] [export-anywhere 3.2]', () => {
  const recs = gym()
  const g = PRESETS.find(x => x.id === 'google-contacts')
  const gm = autoMap(g.headers, 'clients')
  const sarah = parseCsv(exportTo(recs, 'clients', g.headers, gm))[1]
  assert.match(sarah[g.headers.indexOf('Notes')], /Package: 10 class/)
  const m = PRESETS.find(x => x.id === 'mailchimp')
  const mm = autoMap(m.headers, 'clients')
  const proof = proveExport(recs, 'clients', exportTo(recs, 'clients', m.headers, mm), mm)
  assert.ok(proof.passed < proof.checks)
  assert.ok(proof.lines.some(l => /✖ no column for .*credit/.test(l)))
})

// ------------------------------------------------------------- the demo engine

test('two staff with one phone number are flagged as maybe one person [find-workarounds 1.7]', () => {
  const read = readWithRules(slotlyRecords())
  assert.ok(read.sameStaff.length >= 1)
  const [a, b] = read.sameStaff[0].map(i => read.staff.find(s => s.src === i))
  assert.equal(a.phone, b.phone)
})

test('the swarm shares the work and waits for what a record depends on [swarm-migration 1.1] [swarm-migration 1.3]', () => {
  const old = slotlyRecords()
  const records = idleRecords(readWithRules(old), {})
  const crews = crewsFor(records)
  assert.equal(crews.filter(c => c.key === 'clients').length, 4)
  assert.equal(crews.filter(c => c.key === 'bookings').length, 2)
  const pkg = crews.find(c => c.key === 'packages')
  const empty = { clients: [], services: [], staff: [] }
  assert.equal(pkg.ready(pkg.list[0], empty), false, 'a package waits for its client')
  assert.equal(pkg.ready(pkg.list[0], { ...empty, clients: [{ name: pkg.list[0].Client }] }), true)
})
