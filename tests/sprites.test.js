// The pixel art stays intact whichever way Boo looks.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { POSES, pose, canGaze, gazeToward } from '../src/renderer/sprites.js'

const dirs = [-1, 0, 1].flatMap(dx => [-1, 0, 1].map(dy => [dx, dy]))

test('looking around never paints over the outline or outside the ghost', () => {
  for (const name of Object.keys(POSES)) {
    const straight = pose(name).grid
    for (const g of dirs) {
      const looking = pose(name, g).grid
      for (let y = 0; y < 16; y++)
        for (let x = 0; x < 16; x++) {
          if (straight[y][x] === 'o') assert.equal(looking[y][x], 'o', `${name} ${g} broke the outline at ${x},${y}`)
          if (straight[y][x] === null) assert.equal(looking[y][x], null, `${name} ${g} drew outside at ${x},${y}`)
        }
    }
  }
})

test('open eyes really move when looking sideways', () => {
  for (const name of Object.keys(POSES).filter(canGaze)) {
    const moved = [[1, 0], [-1, 0]].some(g => JSON.stringify(pose(name, g).grid) !== JSON.stringify(pose(name).grid))
    assert.ok(moved, `${name} eyes never move`)
  }
})

test('eyes look towards a near pointer, ahead when it is far', () => {
  const eyes = { x: 100, y: 100 }
  assert.deepEqual(gazeToward(eyes, { x: 400, y: 100 }, false), [1, 0])
  assert.deepEqual(gazeToward(eyes, { x: 400, y: 100 }, true), [-1, 0])
  assert.deepEqual(gazeToward(eyes, { x: 100, y: 20 }, false), [0, -1])
  assert.deepEqual(gazeToward(eyes, { x: 2000, y: 100 }, false), [0, 0])
  assert.deepEqual(gazeToward(eyes, null, false), [0, 0])
})
