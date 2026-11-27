// Reading the salon's workarounds, using Gemini safely, and switching without loss.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fc from 'fast-check'
import { slotlyRecords, SERVICES, IDLE_CATEGORY } from '../web/data.js'
import { readWithRules, mergeReading, findingsFor, cleanName } from '../web/interpret.js'
import { idleRecords } from '../web/switch.js'
import { cleanReadRequest, cleanAskRequest } from '../src/agent/ai.js'

const old = slotlyRecords()
const read = readWithRules(old)
const truth = old.truth.clients

test('every workaround in the notes and names reads back to the real record [find-workarounds 1.1] [find-workarounds 1.2] [find-workarounds 1.3] [collect-old-app 1.3]', () => {
  assert.equal(read.clients.length, truth.length)
  read.clients.forEach((c, i) => {
    const t = truth[i]
    assert.equal(c.name, t.name)
    assert.equal(c.vip, t.vip, `${t.name} VIP`)
    assert.equal(c.credit, t.credit, `${t.name} credit`)
    assert.deepEqual(c.packages.map(p => [p.name, p.left, p.of, p.paid]), t.packages.map(p => [p.name, p.left, p.of, p.paid]), `${t.name} packages`)
  })
})

test('fake services, clean-up blocks, breaks and written rules all find their real meaning [find-workarounds 1.4] [find-workarounds 1.5] [find-workarounds 1.6]', () => {
  assert.equal(read.products.length, 8)
  assert.equal(read.services.length, SERVICES.length)
  for (const s of read.services) {
    const t = SERVICES.find(x => x.name === s.name)
    assert.equal(s.category, IDLE_CATEGORY[t.category], s.name)
    assert.equal(s.buffer, t.cleanup, `${s.name} clean-up`)
    assert.equal(s.deposit, t.deposit, `${s.name} deposit`)
  }
  assert.equal(read.bookings.length, old.truth.bookings.length)
  assert.equal(read.breaks.length, 4)
  assert.deepEqual(read.policies, { cancelHours: 24, cancelFee: 50, noShowFee: 100, lateMinutes: 15 })
  assert.deepEqual(read.sameStaff, [[2, 3]])
})

test('whatever Gemini says, nothing ungrounded in the original text gets through [find-workarounds 4.1]', () => {
  const answer = fc.record({
    customers: fc.array(fc.record({ i: fc.integer({ min: -2, max: 50 }), alert: fc.string(), credit: fc.integer({ min: -5, max: 500 }), packages: fc.array(fc.record({ left: fc.integer(), of: fc.integer(), paid: fc.integer() }), { maxLength: 2 }) }), { maxLength: 10 }),
    services: fc.array(fc.record({ i: fc.integer({ min: 0, max: 25 }), category: fc.string() }), { maxLength: 5 }),
    policies: fc.record({ cancelHours: fc.integer(), cancelFee: fc.integer(), noShowFee: fc.integer(), lateMinutes: fc.integer() }),
  })
  fc.assert(
    fc.property(answer, ai => {
      const out = mergeReading(old, read, ai)
      return (
        out.clients.every((c, i) => c.credit === read.clients[i].credit && JSON.stringify(c.packages) === JSON.stringify(read.clients[i].packages)) &&
        out.services.every(s => ['Cuts', 'Styling', 'Colour', 'Treatments', 'Brows'].includes(s.category)) &&
        Object.entries(out.policies).every(([k, v]) => v === read.policies[k] || old.terms.includes(String(v)) || (k === 'noShowFee' && v === 100))
      )
    }),
    { numRuns: 300 },
  )
})

test('the owner decides: merging, expiry, and what stays as a note [clean-and-confirm 1.3]', () => {
  const choices = Object.fromEntries(findingsFor(old, read).map(f => [f.key, f.value]))
  const r = idleRecords(read, choices)
  assert.equal(r.staff.length, 4)
  assert.ok(!r.bookings.some(b => b['Team member'] === 'Jas K.'))
  assert.ok(r.packages.every(p => p.Expires === '2027-11-26'))
  assert.equal(r.clients.reduce((a, c) => a + Number(c['Store credit'] || 0), 0), truth.reduce((a, c) => a + c.credit, 0))
  const kept = idleRecords(read, { ...choices, credit: false, merge: false, packages: '2027-05-26' })
  assert.equal(kept.staff.length, 5)
  assert.ok(kept.clients.every(c => !c['Store credit']))
  assert.ok(kept.clients.filter(c => c.Notes.includes('credit')).length >= 5)
  assert.ok(kept.packages.every(p => p.Expires === '2027-05-26'))
})

test('names lose the marks, never the person [find-workarounds 1.2]', () => {
  fc.assert(fc.property(fc.stringMatching(/^[A-Z][a-z]{1,8} [A-Z][a-z]{1,8}$/), n => cleanName(`${n} ★`) === n && cleanName(`${n} **VIP** (PPD ALLERGY)`) === n))
})

test('requests to the AI are cut down to size', () => {
  assert.equal(cleanReadRequest(null), null)
  const big = cleanReadRequest({ customers: Array.from({ length: 900 }, (_, i) => ({ i, name: 'x'.repeat(300), notes: 'y'.repeat(2000) })) })
  assert.equal(big.customers.length, 300)
  assert.ok(big.customers.every(c => c.name.length <= 80 && c.notes.length <= 400))
  assert.equal(cleanAskRequest({ question: '   ' , records: 'x' }), null)
})

test('rules set aside the notes they cannot read, and Gemini may only use numbers the note contains [find-workarounds 2.1] [find-workarounds 2.2] [find-workarounds 2.3] [raise-anything 3.2]', async () => {
  const { thinkAboutNotes } = await import('../web/ai.js')
  const unclear = read.clients.flatMap(c => (c.unclear ?? []).map(text => ({ src: c.src, text })))
  assert.ok(unclear.length >= 5, 'the odd notes are set aside for AI')
  const real = globalThis.fetch
  globalThis.fetch = async () => ({ ok: true, json: async () => ({
    notes: [
      { i: 0, meaning: 'Owed two blowdries', kind: 'prepaid', sessions: 2, service: 'blowdry', amount: 0 },
      { i: 1, meaning: 'Invented a number', kind: 'credit', sessions: 0, amount: 999 },
      { i: 2, meaning: 'Not a kind we know', kind: 'refund' },
    ],
    plan: ['Check every balance'],
    model: 'test',
  }) })
  try {
    const out = await thinkAboutNotes({ unclear, needs: 'money', found: [] })
    assert.equal(out.notes.length, 2, 'unknown kinds are dropped')
    assert.equal(out.notes[0].kind, 'prepaid')
    assert.equal(out.notes[0].sessions, 2)
    assert.equal(out.notes[1].kind, 'note', 'a number not in the note turns it back into a plain note')
    assert.equal(out.notes[1].amount, 0)
    assert.deepEqual(out.plan, ['Check every balance'])
  } finally {
    globalThis.fetch = real
  }
})

test('changes from the chat are checked against the data before they apply [clean-and-confirm 3.1] [clean-and-confirm 3.2] [clean-and-confirm 3.3]', async () => {
  const { applyEdits, cleanEdits } = await import('../web/edits.js')
  const r = structuredClone(read)
  const client = r.bookings[0].client
  const out = applyEdits(r, cleanEdits([
    { action: 'set', target: 'client', name: client, field: 'name', value: 'Renamed Person' },
    { action: 'set', target: 'service', name: r.services[0].name, field: 'price', value: 260 },
    { action: 'set', target: 'service', name: r.services[0].name, field: 'price', value: 'free' },
    { action: 'set', target: 'client', name: 'Nobody Here', field: 'vip', value: true },
    { action: 'add', target: 'booking', name: 'Renamed Person', record: { date: '2026-12-09', time: '10:00', service: 'Made Up Service', staff: r.staff[0].name } },
    { action: 'add', target: 'client', record: { name: 'Test Person', phone: '9000 0000' } },
  ]))
  assert.equal(out.done.length, 3)
  assert.equal(out.failed.length, 3, 'a bad price, an unknown client and a booking for an unknown service are refused')
  assert.ok(r.bookings.some(b => b.client === 'Renamed Person'), 'a rename carries through to bookings')
  assert.ok(!r.bookings.some(b => b.client === client))
  assert.equal(r.services[0].price, 260)
  assert.ok(r.clients.some(c => c.name === 'Test Person'))
})

test('old habits in any data are read back to proper fields [seance-and-afterlife 3.2] [seance-and-afterlife 3.3] [seance-and-afterlife 3.5] [raise-anything 3.4]', async () => {
  const { fixClient, fixService, readName, readNotes } = await import('../web/habits.js')
  const fx = fixClient({ name: 'Mei Tan ★ (LATEX ALLERGY)', phone: '9123 4567 / 9876 5432', notes: 'credit $50 | 10x blowdry pkg, 2 used. pd $300', credit: '', alert: '' })
  assert.equal(fx.values.name, 'Mei Tan')
  assert.equal(fx.values.vip, 'Yes')
  assert.equal(fx.values.alert, 'Latex allergy')
  assert.equal(fx.values.credit, '50')
  assert.equal(fx.values.phone, '9123 4567')
  assert.deepEqual(fx.packages.map(p => [p.left, p.of, p.paid]), [['8', '10', '300']])
  assert.equal(fixClient({ name: 'Plain Person', phone: '1', notes: 'likes tea' }), null, 'nothing to fix means nothing changes')
  assert.equal(fixService({ name: 'RETAIL - Argan oil', price: '32' }).product.name, 'Argan oil')
  assert.deepEqual(readName('Sarah Lim *VIP* (DO NOT CALL)'), { name: 'Sarah Lim', vip: true, alert: '', flags: ['Do not call'] })
  const n = readNotes('owes $40 locker fee | gift card balance $60')
  assert.equal(n.credit, 60, 'money owed is not credit')
  assert.deepEqual(n.unclear, ['owes $40 locker fee'])
})

test('raise anything: a CSV round-trips and every row with a name comes out [raise-anything 1.1] [raise-anything 3.1] [raise-anything 3.3]', async () => {
  const { parseCsv, toCsv, guessKinds, raise } = await import('../web/raise.js')
  fc.assert(
    fc.property(fc.array(fc.array(fc.string({ minLength: 1, maxLength: 12 }).filter(s => s.trim() !== ''), { minLength: 3, maxLength: 3 }), { minLength: 1, maxLength: 20 }), rows => {
      assert.deepEqual(parseCsv(toCsv(rows)), rows)
    }),
  )
  const { readFileSync } = await import('node:fs')
  const [headers, ...rows] = parseCsv(readFileSync(new URL('../web/samples/fittrack-members.csv', import.meta.url), 'utf-8'))
  const kinds = guessKinds(headers, rows)
  assert.deepEqual(kinds.slice(0, 4), ['name', 'phone', 'email', 'note'])
  const out = raise({ headers, rows, kinds })
  assert.equal(out.records.length, rows.length)
  assert.ok(out.records.every(r => !/★|VIP|\(/.test(r.name)), 'names come out clean')
  const paid = out.records.flatMap(r => r.packages).reduce((a, p) => a + p.paid, 0)
  assert.equal(paid, 250 + 960 + 90 + 250 + 800, 'every prepaid dollar is found')
  const crossed = raise({ headers: ['Name', 'Phone'], rows: [['Wendy Tan', '9654 ~~2210~~ 2219']], kinds: ['name', 'phone'] })
  assert.equal(crossed.records[0].phone, '9654 2219', 'crossed out on paper is left out')
})
