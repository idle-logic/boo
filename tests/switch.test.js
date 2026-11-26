// The switch: what the AI is allowed to decide, and what the move produces.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fc from 'fast-check'
import { SERVICES, STAFF, POLICIES, makeClients, makeBookings, quote } from '../web/data.js'
import { planRequest, rulePlan, checkPlan, idleRecords, IDLE_CATEGORIES } from '../web/plan.js'
import { cleanPlanRequest } from '../src/agent/plan.js'

const clients = makeClients()
const learned = {
  clients,
  services: SERVICES.map(({ cleanup, ...s }) => s), // the services table does not show clean-up time
  staff: STAFF,
  policies: POLICIES,
  bookings: makeBookings(clients),
}
const req = planRequest(learned)

test('the demo salon is the same every time', () => {
  assert.deepEqual(makeClients(), makeClients())
  assert.equal(clients.length, 42)
  assert.equal(new Set(clients.map(c => c.name)).size, 42)
  assert.equal(clients.flatMap(c => c.packages).length, 9)
  for (const b of learned.bookings) assert.notEqual(new Date(`${b.date}T00:00`).getDay(), 1, 'closed on Mondays')
})

test('without the AI, plain rules still make a complete plan', () => {
  const plan = rulePlan(req)
  for (const c of req.categories) assert.ok(IDLE_CATEGORIES.includes(plan.categories[c]), c)
  assert.deepEqual(plan.sameStaff, [[2, 3]], 'Jasmine Koh and Jas K. share a phone')
  assert.ok(plan.alerts.some(a => /PPD/.test(a.alert)))
  assert.ok(!plan.alerts.some(a => /Prefers Hana/.test(req.notes.find(n => n.i === a.i).text)), 'preferences are not health alerts')
})

test('whatever the AI answers, only answers that fit what was asked get through', () => {
  const junk = fc.oneof(fc.string(), fc.integer(), fc.constant(null), fc.array(fc.anything(), { maxLength: 3 }), fc.object())
  fc.assert(
    fc.property(fc.record({ categories: fc.oneof(junk, fc.dictionary(fc.string(), fc.string())), alerts: fc.oneof(junk, fc.array(fc.record({ i: fc.integer({ min: -5, max: 60 }), alert: fc.string() }))), sameStaff: fc.oneof(junk, fc.array(fc.array(fc.integer({ min: -2, max: 8 }), { maxLength: 3 }))) }, { requiredKeys: [] }), ai => {
      const plan = checkPlan(req, ai)
      const noteIds = new Set(req.notes.map(n => n.i))
      return (
        req.categories.every(c => IDLE_CATEGORIES.includes(plan.categories[c])) &&
        plan.alerts.every(a => noteIds.has(a.i) && a.alert.length > 0 && a.alert.length <= 60) &&
        plan.sameStaff.every(([a, b]) => a !== b && req.staff.some(s => s.i === a) && req.staff.some(s => s.i === b))
      )
    }),
    { numRuns: 400 },
  )
})

test('merging a duplicate keeps everything they did and moves their bookings', () => {
  const plan = rulePlan(req)
  const merged = idleRecords(learned, plan, { merge: true })
  assert.equal(merged.staff.length, 4)
  const jasmine = merged.staff.find(s => s.Name === 'Jasmine Koh')
  assert.deepEqual(jasmine.Does.sort(), ['Brows', 'Colour', 'Treatments'])
  assert.ok(!merged.bookings.some(b => b['Team member'] === 'Jas K.'))
  assert.equal(idleRecords(learned, plan, { merge: false }).staff.length, 5)
})

test('every record has a place in Idle, with nothing dropped', () => {
  const r = idleRecords(learned, rulePlan(req))
  assert.equal(r.clients.length, clients.length)
  assert.equal(r.packages.length, 9)
  assert.equal(r.bookings.length, learned.bookings.length)
  assert.equal(r.services.length, SERVICES.length)
  assert.equal(r.clients.reduce((a, c) => a + Number(c['Store credit'] || 0), 0), clients.reduce((a, c) => a + c.credit, 0))
})

test('a missing clean-up time shows up as a different end time, which is how the proof finds it', () => {
  for (const s of SERVICES) {
    const old = quote(s, '14:00')
    const moved = quote(s, '14:00', { cleanup: 0 })
    assert.equal(old.price, moved.price)
    assert.equal(old.ends === moved.ends, s.cleanup === 0, s.name)
  }
})

test('the planning request sent to the AI is cut down to size', () => {
  assert.equal(cleanPlanRequest(null), null)
  assert.equal(cleanPlanRequest({ categories: [] }), null)
  const big = cleanPlanRequest({ ...req, notes: Array.from({ length: 500 }, (_, i) => ({ i, text: 'x'.repeat(900) })) })
  assert.equal(big.notes.length, 200)
  assert.ok(big.notes.every(n => n.text.length <= 200))
})
