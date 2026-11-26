// Reincarnation: the reborn app, running only on the spec Boo learned by using
// ClinicMaster 98, must answer every entry the way the old app does.
// The fixture is the spec a real headless run of the demo produced.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import fc from 'fast-check'
import { legacySave, parseDmy, legacyGst, LEGACY_SEED, LEGACY_SERVICES } from '../web/legacy.js'
import { check, rowFor, readDate } from '../web/reborn.js'
import { inferMoney } from '../web/explore.js'
import { makeScenarios, compare } from '../web/parity.js'
import { specFiles, ears } from '../web/spec.js'
import { zip } from '../web/zip.js'

const learned = JSON.parse(readFileSync(new URL('./fixtures/clinicmaster-spec.json', import.meta.url), 'utf-8'))
const codeOf = line => (line ? /\d{3}/.exec(line)[0] : 'ok')

// Both apps start from the same records.
function twins() {
  const old = { clients: LEGACY_SEED.map(c => ({ ...c })), bookings: [], invoices: [] }
  const rows = { Clients: LEGACY_SEED.map(c => [c.name, c.hp, c.dob, c.pet, c.breed, c.remarks]), Appointments: [], Invoices: [] }
  return { old, rows }
}

const name = fc.string({ minLength: 0, maxLength: 45 }).map(s => s.replace(/[^A-Za-z ]/g, 'a').trim())
const hp = fc.oneof(fc.stringMatching(/^[0-9]{6,10}$/), fc.stringMatching(/^[89][0-9]{7}$/), fc.constantFrom(...LEGACY_SEED.map(c => c.hp)))
const date = fc.oneof(
  fc.date({ min: new Date(1950, 0, 1), max: new Date(2030, 11, 31), noInvalidDate: true }).map(d => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`),
  fc.constantFrom('', '2027-01-04', '31/02/2027', '4/1/2027', '15/12/26'),
)
const client = fc.record({ Name: name, HP: hp, DOB: date, Pet: fc.constantFrom('', 'Mango'), Breed: fc.constantFrom('', 'Corgi'), Remarks: fc.constantFrom('', 'Shy') })

test('any client entry: the reborn app gives the same answer as ClinicMaster 98', () => {
  fc.assert(
    fc.property(fc.array(client, { minLength: 1, maxLength: 12 }), entries => {
      const { old, rows } = twins()
      for (const e of entries) {
        const a = codeOf(legacySave(old, 'client', { name: e.Name, hp: e.HP, dob: e.DOB, pet: e.Pet, breed: e.Breed, remarks: e.Remarks }))
        const err = check(learned, 'Clients', e, rows.Clients)
        if (!err) rows.Clients.push(rowFor(learned, 'Clients', e))
        if (a !== (err?.code ?? 'ok')) return false
      }
      return true
    }),
    { numRuns: 300 },
  )
})

test('any booking: same answer in both, including Sundays and taken slots', () => {
  const booking = fc.record({ Client: fc.constantFrom('', 'Priya Nair', 'Ken Wong'), Date: date, Time: fc.constantFrom('', '09:00', '10:00') })
  fc.assert(
    fc.property(fc.array(booking, { minLength: 1, maxLength: 15 }), entries => {
      const { old, rows } = twins()
      for (const e of entries) {
        const a = codeOf(legacySave(old, 'booking', { client: e.Client, date: e.Date, time: e.Time }))
        const err = check(learned, 'Appointments', e, rows.Appointments)
        if (!err) rows.Appointments.push(rowFor(learned, 'Appointments', e))
        if (a !== (err?.code ?? 'ok')) return false
      }
      return true
    }),
    { numRuns: 300 },
  )
})

test('invoices: sums add up, and rounding follows the owner\'s choice', () => {
  const keep = structuredClone(learned)
  keep.money.decision = 'keep'
  const fix = structuredClone(learned)
  fix.money.decision = 'fix'
  for (const [service, price] of LEGACY_SERVICES) {
    const [, , sub, gst, total] = rowFor(keep, 'Invoices', { Client: 'Ken Wong', Service: service })
    assert.equal(gst, legacyGst(price).toFixed(2), `${service} kept the old way`)
    assert.equal(Math.round(Number(sub) * 100) + Math.round(Number(gst) * 100), Math.round(Number(total) * 100))
    const fixed = rowFor(fix, 'Invoices', { Client: 'Ken Wong', Service: service })[3]
    assert.equal(fixed, (Math.round(price * 9) / 100).toFixed(2), `${service} to the nearest cent`)
  }
})

test('the rule exploring missed was learned from random testing', () => {
  const rule = learned.rules.find(r => r.kind === 'maxLength')
  assert.equal(rule.foundBy, 'random testing')
  assert.equal(rule.max, 30)
  assert.equal(rule.code, '105')
  assert.deepEqual(learned.rules.find(r => r.kind === 'unique' && r.screen === 'Appointments').fields, ['Date', 'Time'])
})

test('tax rate and rounding are worked out from real sales', () => {
  const samples = LEGACY_SERVICES.map(([n, p]) => {
    const gst = legacyGst(p)
    return { option: n, price: Math.round(p * 100), extra: { Subtotal: p.toFixed(2), GST: gst.toFixed(2), Total: (p + gst).toFixed(2) } }
  })
  const m = inferMoney('Invoices', 'Service', samples)
  assert.equal(m.rate, 9)
  assert.equal(m.rounding, 'down')
  assert.deepEqual(m.columns, { subtotal: 'Subtotal', tax: 'GST', total: 'Total' })
})

test('dates: strict DD/MM/YYYY and real days only, the same in both apps', () => {
  fc.assert(fc.property(fc.string({ maxLength: 12 }), s => Boolean(readDate(s)) === Boolean(parseDmy(s))))
  assert.equal(readDate('29/02/2028')?.getDate(), 29)
  assert.equal(readDate('29/02/2027'), null)
})

test('proof scenarios are repeatable and try every rule', () => {
  const start = { Clients: LEGACY_SEED.map(c => [c.name, c.hp, c.dob, c.pet, c.breed, c.remarks]), Appointments: [['08/12/2026', '10:00', 'Priya Nair']], Invoices: [] }
  const a = makeScenarios(learned, start, { seed: 11 })
  assert.deepEqual(a, makeScenarios(learned, start, { seed: 11 }))
  assert.notDeepEqual(a, makeScenarios(learned, start, { seed: 12 }))
  const whys = a.map(s => s.why)
  for (const w of ['Name left empty', 'HP one digit short', 'HP starting with 0', 'DOB written year first', 'Date on a Sunday', 'Date and Time already taken']) assert.ok(whys.includes(w), w)
})

test('a refusal the spec does not know is a missed rule; a cent of GST is a money question', () => {
  const sc = { screen: 'Clients', values: {} }
  const noRule = { ...learned, rules: learned.rules.filter(r => r.code !== '105') }
  assert.equal(compare(noRule, sc, { code: '105' }, { code: 'ok', row: [] }).kind, 'missed')
  const inv = { screen: 'Invoices', values: {} }
  const v = compare(learned, inv, { code: 'ok', row: ['Ken Wong', 'Deshed', '69.95', '6.29', '76.24'] }, { code: 'ok', row: ['Ken Wong', 'Deshed', '$69.95', '$6.30', '$76.25'] })
  assert.equal(v.kind, 'money')
  assert.equal(compare(learned, inv, { code: 'ok', row: ['A', 'Bath', '45.00'] }, { code: 'ok', row: ['A', 'Bath', '$45.00'] }).same, true)
})

test('the spec is written the way Kiro reads it', () => {
  const files = specFiles(learned)
  assert.match(files['requirements.md'], /^# Requirements Document/)
  assert.match(files['design.md'], /## Correctness Properties/)
  assert.match(files['tasks.md'], /^# Implementation Plan/)
  for (const r of learned.rules) assert.match(ears(r, learned), /^WHEN .+ THEN the system SHALL /)
  assert.doesNotMatch(files['requirements.md'], /\ba (appointment|invoice)\b/)
})

test('the download is a real zip with Kiro\'s folder layout', () => {
  const bytes = zip({ '.kiro/specs/x/requirements.md': 'hi', '.kiro/specs/x/tasks.md': 'there' })
  const view = new DataView(bytes.buffer)
  assert.equal(view.getUint32(0, true), 0x04034b50)
  const end = bytes.length - 22
  assert.equal(view.getUint32(end, true), 0x06054b50)
  assert.equal(view.getUint16(end + 10, true), 2)
  assert.ok(new TextDecoder().decode(bytes).includes('.kiro/specs/x/tasks.md'))
})
