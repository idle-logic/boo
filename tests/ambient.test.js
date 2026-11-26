// Ambient watching: only real changes reach the model.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fc from 'fast-check'
import { newLines, meaningfulChange, ambientPrompt } from '../src/main/ambient.js'

test('new lines are exactly the ones not seen before', () => {
  fc.assert(
    fc.property(fc.array(fc.string()), fc.array(fc.string()), (before, now) => {
      const added = newLines(before, now)
      return added.every(l => !before.includes(l)) && now.filter(l => !before.includes(l)).length === added.length
    }),
  )
})

test('a ticking clock is not news', () => {
  assert.equal(meaningfulChange(['10:41', '10:42 am']), false)
  assert.equal(meaningfulChange([]), false)
  assert.equal(meaningfulChange(['New booking: Mei Lin, Sat 10am']), true)
})

test('the prompt never sends more than the screen cap', () => {
  const lines = Array.from({ length: 500 }, (_, i) => `line ${i}`)
  const { user } = ambientPrompt('Bloom Booking', lines, lines.slice(0, 100), [])
  assert.ok(!user.includes('line 499'))
})
