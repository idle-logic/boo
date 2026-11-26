// The autonomous loop, with a fake screen and a fake brain.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fc from 'fast-check'
import { runAgent, validateAction, needsApproval, renderObservation } from '../src/agent/agent.js'

const screen = () => [
  { id: 'e1', app: 'Messages', role: 'textbox', name: 'Type a message', value: '' },
  { id: 'e2', app: 'Messages', role: 'button', name: 'Send' },
  { id: 'e3', app: 'Bloom Booking', role: 'select', name: 'Staff', options: ['Hana', 'Tom'] },
  { id: 'e4', app: 'Bloom Booking', role: 'button', name: 'Book' },
  { id: 'e5', app: 'Bloom Booking', role: 'tab', name: 'Fri 4 Dec' },
  { id: 'e6', app: 'Login', role: 'password', name: 'Password' },
  { id: 'e7', app: 'Bloom Booking', role: 'button', name: 'Delete booking', disabled: true },
]

test('the model can only touch elements on screen, in ways that fit them', () => {
  const els = screen()
  const actionArb = fc.record({
    type: fc.constantFrom('click', 'type', 'select', 'say', 'done', 'hack', ''),
    id: fc.constantFrom('e1', 'e2', 'e3', 'e4', 'e5', 'e6', 'e7', 'e99', undefined),
    text: fc.option(fc.string(), { nil: undefined }),
    option: fc.option(fc.constantFrom('Hana', 'tom', 'Zed', ''), { nil: undefined }),
  })
  fc.assert(
    fc.property(actionArb, a => {
      const r = validateAction({ action: a }, els)
      if (!r.ok) return true
      const act = r.action
      if (act.type === 'say' || act.type === 'done') return act.text.length > 0
      const el = els.find(e => e.id === act.id)
      if (!el || el.disabled || el.role === 'password') return false
      if (act.type === 'type') return el.role === 'textbox' && act.text.length > 0
      if (act.type === 'select') return el.role === 'select' && el.options.includes(act.option)
      return act.type === 'click'
    }),
    { numRuns: 1000 },
  )
})

test('Book and Send need a yes first. Tabs do not.', () => {
  const els = screen()
  assert.equal(needsApproval({ type: 'click', id: 'e4' }, els), true)
  assert.equal(needsApproval({ type: 'click', id: 'e2' }, els), true)
  assert.equal(needsApproval({ type: 'click', id: 'e5' }, els), false)
  assert.equal(needsApproval({ type: 'type', id: 'e1', text: 'Hi' }, els), false)
})

test('nothing that needs a yes ever happens after a no', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.array(fc.record({ id: fc.constantFrom('e1', 'e2', 'e3', 'e4', 'e5'), type: fc.constantFrom('click', 'type', 'select') }), { minLength: 1, maxLength: 12 }),
      async plan => {
        const acted = []
        let i = 0
        const result = await runAgent({
          goal: 'test',
          adapter: { observe: async () => screen(), act: async a => (acted.push(a), 'ok') },
          think: async () => (i < plan.length ? { thought: 't', action: { ...plan[i++], text: 'x', option: 'Hana' } } : { action: { type: 'done', text: 'fin' } }),
          approve: async () => false,
        })
        return result.history && acted.every(a => !needsApproval(a, screen()))
      },
    ),
    { numRuns: 200 },
  )
})

test('a run books with a yes, reports each step, and finishes', async () => {
  const plan = [
    { thought: 'Look at Friday', action: { type: 'click', id: 'e5' } },
    { thought: 'Hana is free', action: { type: 'select', id: 'e3', option: 'hana' } },
    { thought: 'Book it', action: { type: 'click', id: 'e4' } },
    { thought: 'Reply', action: { type: 'type', id: 'e1', text: 'Booked for Friday 6pm with Hana.' } },
    { thought: 'Send', action: { type: 'click', id: 'e2' } },
    { thought: 'All set', action: { type: 'done', text: 'Booked Luna with Hana, Friday 6pm.' } },
  ]
  let i = 0
  const acted = []
  const steps = []
  const asked = []
  const result = await runAgent({
    goal: 'Handle the new message',
    adapter: { observe: async () => screen(), act: async a => (acted.push(a), 'ok') },
    think: async () => plan[i++],
    approve: async d => (asked.push(d), true),
    onStep: s => steps.push(s.kind),
  })
  assert.equal(result.ok, true)
  assert.equal(result.summary, 'Booked Luna with Hana, Friday 6pm.')
  assert.deepEqual(asked, ['Press "Book" in Bloom Booking', 'Press "Send" in Messages'])
  assert.equal(acted.length, 5)
  assert.equal(acted[1].option, 'Hana')
  assert.ok(steps.includes('ask') && steps.at(-1) === 'done')
})

test('three bad answers in a row and Boo hands back to the person', async () => {
  const result = await runAgent({
    goal: 'x',
    adapter: { observe: async () => screen(), act: async () => 'ok' },
    think: async () => ({ action: { type: 'click', id: 'nope' } }),
    approve: async () => true,
  })
  assert.equal(result.ok, false)
  assert.match(result.summary, /stuck/)
})

test('the screen text for the model never runs past its caps', () => {
  fc.assert(
    fc.property(fc.array(fc.record({ id: fc.string(), app: fc.constantFrom('A', 'B'), role: fc.constant('text'), name: fc.string({ maxLength: 500 }) }), { maxLength: 300 }), els => {
      const text = renderObservation(els, 50)
      return text.split('\n').every(l => l.length < 400)
    }),
  )
})
