// Property tests for the screen world: physics and ledges.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fc from 'fast-check'
import { GHOST, ledgesFromWindows, step, floorLedge, reachable, JUMP_HEIGHT } from '../src/renderer/world.js'

const bounds = { x: 0, y: 0, w: 1920, h: 1040 }

const windowArb = fc.record({
  x: fc.integer({ min: -200, max: 1900 }),
  y: fc.integer({ min: -50, max: 1100 }),
  w: fc.integer({ min: 50, max: 1920 }),
  h: fc.integer({ min: 40, max: 1100 }),
})

const intentArb = fc.record({
  move: fc.constantFrom(-1, 0, 1),
  jump: fc.boolean(),
  speed: fc.integer({ min: 0, max: 400 }),
  fly: fc.option(fc.record({ x: fc.integer({ min: -500, max: 2500 }), y: fc.integer({ min: -500, max: 1500 }) }), { nil: null }),
})

test('Boo never leaves the screen, whatever happens [boo-guide 1.2]', () => {
  fc.assert(
    fc.property(
      fc.array(windowArb, { maxLength: 8 }),
      fc.array(fc.tuple(intentArb, fc.double({ min: 0, max: 0.2, noNaN: true })), { maxLength: 200 }),
      (windows, steps) => {
        const ledges = ledgesFromWindows(windows, bounds)
        let body = { x: 900, y: 0, vx: 0, vy: 0, ground: null }
        for (const [intent, dt] of steps) {
          body = step(body, intent, ledges, bounds, dt)
          if (body.x < bounds.x || body.x > bounds.x + bounds.w - GHOST.w) return false
          if (body.y < bounds.y || body.y > bounds.y + bounds.h - GHOST.h) return false
        }
        return true
      },
    ),
    { numRuns: 300 },
  )
})

test('standing on a ledge means feet exactly on its top and centre over it', () => {
  fc.assert(
    fc.property(fc.array(windowArb, { maxLength: 8 }), fc.array(intentArb, { maxLength: 300 }), (windows, intents) => {
      const ledges = ledgesFromWindows(windows, bounds)
      let body = { x: 900, y: 0, vx: 0, vy: 0, ground: null }
      for (const intent of intents) {
        body = step(body, { ...intent, fly: null }, ledges, bounds, 1 / 60)
        if (body.ground && !body.ground.floor) {
          if (Math.abs(body.y + GHOST.h - body.ground.y) > 0.001) return false
          const c = body.x + GHOST.w / 2
          if (c < body.ground.x1 - 1 || c > body.ground.x2 + 1) return false
        }
      }
      return true
    }),
    { numRuns: 300 },
  )
})

test('a ledge never runs under a window that sits in front of it [boo-guide 3.1]', () => {
  fc.assert(
    fc.property(fc.array(windowArb, { minLength: 1, maxLength: 8 }), windows => {
      const ledges = ledgesFromWindows(windows, bounds)
      for (const l of ledges) {
        // Find the window this ledge belongs to (first one with that top), then check those in front.
        const owner = windows.findIndex(w => w.y === l.y && w.x <= l.x1 && w.x + w.w >= l.x2)
        if (owner < 0) return false
        for (let j = 0; j < owner; j++) {
          const f = windows[j]
          const covers = f.y <= l.y + 2 && f.y + f.h > l.y - GHOST.h * 0.5
          const overlap = Math.min(l.x2, f.x + f.w) - Math.max(l.x1, f.x)
          if (covers && overlap > 0) return false
        }
      }
      return true
    }),
    { numRuns: 400 },
  )
})

test('falling from the sky lands on the floor', () => {
  let body = { x: 300, y: 0, vx: 0, vy: 0, ground: null }
  for (let i = 0; i < 200; i++) body = step(body, { move: 0, jump: false }, [], bounds, 1 / 60)
  assert.ok(body.ground?.floor)
  assert.equal(body.y, bounds.h - GHOST.h)
})

test('a jump reaches a ledge listed as reachable', () => {
  const ledge = { x1: 200, x2: 700, y: bounds.h - JUMP_HEIGHT * 0.7 }
  let body = { x: 400, y: bounds.h - GHOST.h, vx: 0, vy: 0, ground: floorLedge(bounds) }
  assert.deepEqual(reachable(body, [ledge]), [ledge])
  body = step(body, { move: 0, jump: true }, [ledge], bounds, 1 / 60)
  for (let i = 0; i < 120 && body.ground !== ledge; i++) body = step(body, { move: 0, jump: false }, [ledge], bounds, 1 / 60)
  assert.equal(body.ground, ledge)
})
