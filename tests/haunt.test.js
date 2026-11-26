// Reading the salon's workarounds, using Gemini safely, and switching without loss.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fc from 'fast-check'
import { slotlyRecords, SERVICES, IDLE_CATEGORY } from '../web/data.js'
import { readWithRules, mergeReading, findingsFor, cleanName } from '../web/interpret.js'
import { useSession } from '../web/features.js'
import { idleRecords } from '../web/switch.js'
import { cleanReadRequest, cleanAskRequest } from '../src/agent/ai.js'

const old = slotlyRecords()
const read = readWithRules(old)
const truth = old.truth.clients

test('every workaround in the notes and names reads back to the real record', () => {
  assert.equal(read.clients.length, truth.length)
  read.clients.forEach((c, i) => {
    const t = truth[i]
    assert.equal(c.name, t.name)
    assert.equal(c.vip, t.vip, `${t.name} VIP`)
    assert.equal(c.credit, t.credit, `${t.name} credit`)
    assert.deepEqual(c.packages.map(p => [p.name, p.left, p.of, p.paid]), t.packages.map(p => [p.name, p.left, p.of, p.paid]), `${t.name} packages`)
  })
})

test('fake services, clean-up blocks, breaks and written rules all find their real meaning', () => {
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

test('whatever Gemini says, nothing ungrounded in the original text gets through', () => {
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

test('counting off a session keeps the note in the style the team wrote it', () => {
  assert.equal(useSession('PKG blowdry: 4 left of 5, paid $200'), 'PKG blowdry: 3 left of 5, paid $200')
  assert.equal(useSession('prepaid 10 mens cuts ($340) - 6 remaining'), 'prepaid 10 mens cuts ($340) - 5 remaining')
  assert.equal(useSession('3x scalp detox pkg, 1 used. pd $150'), '3x scalp detox pkg, 2 used. pd $150')
  for (const c of read.clients) for (const p of c.packages) {
    const after = readWithRules({ ...old, customers: old.customers.map((x, i) => (i === c.src ? { ...x, notes: x.notes.replace(p.from, useSession(p.from)) } : x)) })
    assert.equal(after.clients[c.src].packages.find(q => q.name === p.name).left, p.left - 1, `${c.name} ${p.name}`)
  }
})

test('the owner decides: merging, expiry, and what stays as a note', () => {
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

test('names lose the marks, never the person', () => {
  fc.assert(fc.property(fc.stringMatching(/^[A-Z][a-z]{1,8} [A-Z][a-z]{1,8}$/), n => cleanName(`${n} ★`) === n && cleanName(`${n} **VIP** (PPD ALLERGY)`) === n))
})

test('requests to the AI are cut down to size', () => {
  assert.equal(cleanReadRequest(null), null)
  const big = cleanReadRequest({ customers: Array.from({ length: 900 }, (_, i) => ({ i, name: 'x'.repeat(300), notes: 'y'.repeat(2000) })) })
  assert.equal(big.customers.length, 300)
  assert.ok(big.customers.every(c => c.name.length <= 80 && c.notes.length <= 400))
  assert.equal(cleanAskRequest({ question: '   ' , records: 'x' }), null)
})
