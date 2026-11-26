// Property tests for Boo's behaviour, run together with the physics.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fc from 'fast-check'
import { Brain, EVENT_TYPES } from '../src/renderer/brain.js'
import { GHOST, ledgesFromWindows, step } from '../src/renderer/world.js'
import { POSES } from '../src/renderer/sprites.js'

const bounds = { x: 0, y: 0, w: 1920, h: 1040 }
const windowArb = fc.record({
  x: fc.integer({ min: -100, max: 1800 }),
  y: fc.integer({ min: 100, max: 1000 }),
  w: fc.integer({ min: 200, max: 1400 }),
  h: fc.integer({ min: 150, max: 900 }),
})
const eventArb = fc.record({
  type: fc.constantFrom(...EVENT_TYPES.filter(t => !['grab', 'drop', 'guide', 'guide-say', 'wait', 'release', 'letgo', 'goto'].includes(t))),
  text: fc.string({ maxLength: 60 }),
})

/** Run Boo for a while with random events. Returns every frame. */
function simulate(windows, events, seconds, seed = 1) {
  let s = seed
  const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647)
  const brain = new Brain(rand)
  const ledges = ledgesFromWindows(windows, bounds)
  let body = { x: 900, y: 0, vx: 0, vy: 0, ground: null }
  const frames = []
  const dt = 1 / 30
  const steps = Math.round(seconds / dt)
  const every = Math.max(1, Math.floor(steps / (events.length + 1)))
  for (let i = 0; i < steps; i++) {
    const now = i * dt * 1000
    const e = i % every === 0 ? events[i / every - 1] : undefined
    if (e) brain.handle(e, now)
    const out = brain.update({ body, ledges, bounds, cursor: { x: 400, y: 300 }, now })
    body = step(body, out.intent, ledges, bounds, dt)
    frames.push({ now, body, out, event: e })
  }
  return frames
}

test('every pose Boo picks exists, and Boo stays on screen', () => {
  fc.assert(
    fc.property(fc.array(windowArb, { maxLength: 6 }), fc.array(eventArb, { maxLength: 12 }), fc.integer({ min: 1, max: 1e6 }), (windows, events, seed) => {
      for (const f of simulate(windows, events, 40, seed)) {
        if (!(f.out.pose in POSES)) return false
        if (f.body.x < 0 || f.body.x > bounds.w - GHOST.w || f.body.y < 0 || f.body.y > bounds.h - GHOST.h) return false
      }
      return true
    }),
    { numRuns: 60 },
  )
})

test('"Kiro needs you" stays on screen until you click Boo', () => {
  fc.assert(
    fc.property(fc.array(eventArb.filter(e => e.type !== 'click' && e.type !== 'needs-you'), { maxLength: 10 }), events => {
      const brain = new Brain(() => 0.5)
      const body = { x: 500, y: 976, vx: 0, vy: 0, ground: { x1: 0, x2: 1920, y: 1040, floor: true } }
      brain.handle({ type: 'needs-you', text: 'approve a shell command' }, 0)
      let now = 0
      for (const e of events) {
        now += 5000
        brain.handle(e, now)
        const out = brain.update({ body, ledges: [], bounds, cursor: { x: 800, y: 400 }, now })
        if (!out.bubble || !out.bubble.sticky || !out.bubble.text.startsWith('Kiro needs you')) return false
      }
      brain.handle({ type: 'click' }, now + 1)
      const after = brain.update({ body, ledges: [], bounds, cursor: null, now: now + 2 })
      // After the click, the alert is gone. Any queued news may show instead.
      return !after.bubble?.text.startsWith('Kiro needs you')
    }),
    { numRuns: 200 },
  )
})

test('when Kiro needs you, Boo flies to the cursor', () => {
  const frames = simulate([], [{ type: 'needs-you', text: 'one approval' }], 6)
  const last = frames.at(-1)
  const dist = Math.hypot(last.body.x - (400 + 24), last.body.y - (300 - GHOST.h / 2))
  assert.ok(dist < 8, `ended ${dist.toFixed(1)}px from the cursor`)
  assert.match(last.out.pose, /^knock/)
})

test('Boo wanders, and climbs onto window ledges', () => {
  const windows = [
    { x: 300, y: 780, w: 700, h: 300 },
    { x: 900, y: 600, w: 700, h: 500 },
  ]
  let climbed = false
  let moved = 0
  for (let seed = 1; seed <= 6 && !climbed; seed++) {
    const frames = simulate(windows, [], 120, seed)
    climbed = frames.some(f => f.body.ground && !f.body.ground.floor)
    moved = Math.max(moved, Math.max(...frames.map(f => f.body.x)) - Math.min(...frames.map(f => f.body.x)))
  }
  assert.ok(moved > 200, `only moved ${moved}px`)
  assert.ok(climbed, 'never stood on a window')
})

test('Boo falls asleep when nothing happens, and wakes when clicked', () => {
  const brain = new Brain(() => 0.99)
  const body = { x: 500, y: 976, vx: 0, vy: 0, ground: { x1: 0, x2: 1920, y: 1040, floor: true } }
  const out = brain.update({ body, ledges: [], bounds, cursor: null, now: 200_000 })
  assert.equal(out.pose, 'sleep')
  brain.handle({ type: 'click' }, 200_001)
  assert.notEqual(brain.update({ body, ledges: [], bounds, cursor: null, now: 200_002 }).pose, 'sleep')
})

test('news that arrives while Kiro waits on you shows after you click', () => {
  const brain = new Brain(() => 0.5)
  const body = { x: 500, y: 976, vx: 0, vy: 0, ground: { x1: 0, x2: 1920, y: 1040, floor: true } }
  brain.handle({ type: 'needs-you', text: 'approve npm install' }, 0)
  brain.handle({ type: 'done', text: 'Spec 2 finished' }, 1000)
  assert.match(brain.update({ body, ledges: [], bounds, cursor: null, now: 1001 }).bubble.text, /^Kiro needs you/)
  brain.handle({ type: 'click' }, 2000)
  assert.equal(brain.update({ body, ledges: [], bounds, cursor: null, now: 2001 }).bubble.text, 'Done! Spec 2 finished')
})

test('in an alert, reaching for Boo does not make it move away', () => {
  fc.assert(
    fc.property(
      fc.array(fc.record({ dx: fc.integer({ min: -60, max: 60 }), dy: fc.integer({ min: -60, max: 60 }) }), { minLength: 1, maxLength: 30 }),
      moves => {
        const brain = new Brain(() => 0.5)
        let body = { x: 900, y: 500, vx: 0, vy: 0, ground: null }
        brain.handle({ type: 'needs-you', text: 'x' }, 0)
        let cursor = { x: 600, y: 400 }
        let now = 0
        // Let Boo arrive.
        for (let i = 0; i < 200; i++) {
          now += 33
          body = step(body, brain.update({ body, ledges: [], bounds, cursor, now }).intent, [], bounds, 1 / 30)
        }
        const parked = { x: body.x, y: body.y }
        // Now the cursor wanders close by, as if reaching for Boo.
        for (const m of moves) {
          cursor = { x: 600 + m.dx * 3, y: 400 + m.dy * 3 }
          now += 33
          body = step(body, brain.update({ body, ledges: [], bounds, cursor, now }).intent, [], bounds, 1 / 30)
        }
        return Math.hypot(body.x - parked.x, body.y - parked.y) < 1
      },
    ),
    { numRuns: 200 },
  )
})

test('tucked away, Boo ignores small talk but comes out for big news', () => {
  const body = { x: 500, y: 976, vx: 0, vy: 0, ground: { x1: 0, x2: 1920, y: 1040, floor: true } }
  for (const big of ['done', 'fail', 'needs-you']) {
    const brain = new Brain(() => 0.5)
    brain.handle({ type: 'tuck' }, 0)
    for (const small of ['start', 'tool', 'say']) brain.handle({ type: small, text: 'x' }, 10)
    assert.equal(brain.update({ body, ledges: [], bounds, cursor: null, now: 20 }).tucked, true)
    brain.handle({ type: big, text: 'y' }, 30)
    assert.equal(brain.update({ body, ledges: [], bounds, cursor: null, now: 40 }).tucked, false)
  }
})

test('a click brings Boo out of the corner', () => {
  const brain = new Brain(() => 0.5)
  const body = { x: 500, y: 976, vx: 0, vy: 0, ground: null }
  brain.handle({ type: 'tuck' }, 0)
  brain.handle({ type: 'click' }, 10)
  assert.equal(brain.update({ body, ledges: [], bounds, cursor: null, now: 20 }).tucked, false)
})

test('guiding a form, Boo hovers beside the field it is typing into', () => {
  const brain = new Brain(() => 0.5)
  let body = { x: 100, y: 900, vx: 0, vy: 0, ground: null }
  brain.handle({ type: 'guide', x: 600, y: 400, h: 40, text: 'First name: Mei' }, 0)
  for (let i = 0; i < 120; i++) body = step(body, brain.update({ body, ledges: [], bounds, cursor: null, now: i * 33 }).intent, [], bounds, 1 / 30)
  assert.ok(Math.abs(body.x - (600 - GHOST.w - 8)) < 2 && Math.abs(body.y - (420 - GHOST.h / 2)) < 2)
  brain.handle({ type: 'click' }, 5000)
  assert.equal(brain.mode, 'guide')
})

test('a click on Boo during a migration keeps Boo at the form', () => {
  const brain = new Brain(() => 0.5)
  brain.handle({ type: 'guide', x: 600, y: 400, h: 40, text: 'Email' }, 0)
  brain.handle({ type: 'wait', text: 'Check it, then click me.' }, 10)
  brain.handle({ type: 'grab' }, 20)
  brain.handle({ type: 'letgo' }, 30)
  brain.handle({ type: 'click' }, 40)
  assert.equal(brain.mode, 'guide')
})
