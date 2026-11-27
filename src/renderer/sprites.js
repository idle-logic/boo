// Boo. Hand-placed 16x16 pixel art, drawn facing right.
// Each frame is a base body plus a face, so moods stay consistent.

export const SIZE = 16

export const PALETTES = {
  normal: {
    o: '#2b1d42', // outline
    w: '#fbf8ff', // body
    s: '#d9d0f7', // shade
    e: '#1b1030', // eyes
    h: '#ffffff', // eye glint
    p: '#ff9ec9', // blush
    m: '#5a2342', // mouth
    t: '#ff6fae', // tongue
    l: '#ffb347', // lantern glow
    k: '#6b4a2b', // lantern frame
    z: '#9b8cff', // magic
  },
  // The worker ghosts Boo splits into, one colour each.
  mint: { o: '#1f3d33', w: '#effff7', s: '#b5ecd2', e: '#13261f', h: '#ffffff', p: '#ff9ec9', m: '#2c5546', t: '#ff6fae', l: '#ffb347', k: '#6b4a2b', z: '#9b8cff' },
  peach: { o: '#4a2a1c', w: '#fff5ee', s: '#ffd2bd', e: '#2a160d', h: '#ffffff', p: '#ff8fb0', m: '#6b3420', t: '#ff6fae', l: '#ffb347', k: '#6b4a2b', z: '#9b8cff' },
  // The ghost of the old app: faded blue, like the software it was.
  old: { o: '#1a2c55', w: '#dbe5f7', s: '#9db2dc', e: '#0c1733', h: '#ffffff', p: '#a9bdf0', m: '#22386b', t: '#a9bdf0', l: '#9fc3ff', k: '#3b4a6b', z: '#7f9cff' },
  sky: { o: '#1c2d4a', w: '#f1f7ff', s: '#bcd5f7', e: '#0f1a30', h: '#ffffff', p: '#ff9ec9', m: '#24365e', t: '#ff6fae', l: '#ffb347', k: '#6b4a2b', z: '#9b8cff' },
  scared: {
    o: '#1d2a4a',
    w: '#e3ecff',
    s: '#b3c4ee',
    e: '#0f1a33',
    h: '#ffffff',
    p: '#9fb6ff',
    m: '#24365e',
    t: '#9fb6ff',
    l: '#ffb347',
    k: '#6b4a2b',
    z: '#9b8cff',
  },
}

// Body without a face. Rows 13 to 15 are the wavy tail, in two frames.
const BODY_TOP = [
  '......oooo......',
  '....oowwwwoo....',
  '...owwwwwwwwo...',
  '..owwwwwwwwwwo..',
  '.owwwwwwwwwwwwo.',
  '.owwwwwwwwwwwwo.',
  '.owwwwwwwwwwwwo.',
  '.owwwwwwwwwwwwo.',
  '.owwwwwwwwwwwwo.',
  '.owwwwwwwwwwwso.',
  '.oswwwwwwwwwwso.',
  '.osswwwwwwwwsso.',
  '.osssswwwwsssso.',
]

const TAILS = {
  a: ['.osssssssssssso.', '.osso.osso.osso.', '..oo...oo...oo..'],
  b: ['.osssssssssssso.', '.oso.osso.osso..', '..o...oo...oo...'],
}

// Faces: [x, y, colour] pixels drawn on top of the body. Facing right.
const eye = (x, y) => [[x, y, 'h'], [x + 1, y, 'e'], [x, y + 1, 'e'], [x + 1, y + 1, 'e'], [x, y + 2, 'e'], [x + 1, y + 2, 'e']]
const cheeks = [[4, 8, 'p'], [13, 8, 'p']]

const FACES = {
  idle: [...eye(6, 5), ...eye(11, 5), ...cheeks, [9, 9, 'm'], [10, 9, 'm']],
  blink: [[6, 7, 'e'], [7, 7, 'e'], [11, 7, 'e'], [12, 7, 'e'], ...cheeks, [9, 9, 'm'], [10, 9, 'm']],
  happy: [
    [5, 6, 'e'], [6, 5, 'e'], [7, 6, 'e'],
    [10, 6, 'e'], [11, 5, 'e'], [12, 6, 'e'],
    ...cheeks,
    [8, 8, 'm'], [9, 8, 'm'], [10, 8, 'm'],
    [8, 9, 'm'], [9, 9, 't'], [10, 9, 'm'],
  ],
  scared: [
    ...eye(6, 4), [6, 7, 'e'], [7, 7, 'e'],
    ...eye(11, 4), [11, 7, 'e'], [12, 7, 'e'],
    [9, 9, 'm'], [10, 9, 'm'], [9, 10, 'm'], [10, 10, 'm'],
  ],
  sleep: [[6, 7, 'e'], [7, 7, 'e'], [11, 7, 'e'], [12, 7, 'e'], ...cheeks, [9, 10, 'm']],
  look: [...eye(7, 4), ...eye(12, 4), ...cheeks, [10, 9, 'm']],
  knock: [...eye(6, 5), ...eye(11, 5), ...cheeks, [8, 9, 'm'], [9, 9, 'm'], [10, 9, 'm']],
}

// The little arm it knocks on your screen with.
const EXTRAS = {
  arm: [[14, 6, 'o'], [15, 6, 'o'], [14, 7, 'w'], [15, 7, 'o'], [14, 8, 'o'], [15, 8, 'o']],
}

/** The lantern Boo carries while Kiro works. Drawn beside the ghost so it can glow. */
export const LANTERN = {
  grid: ['..kk..', '.k..k.', 'kkkkkk', 'kllllk', 'klyylk', 'klyylk', 'kllllk', 'kkkkkk'].map(r =>
    [...r].map(c => (c === '.' ? null : c)),
  ),
  palette: { k: '#4a3320', l: '#ffb347', y: '#fff3b0' },
}

// Where each open-eyed face keeps its eyes, so they can look around.
const EYES = { idle: [[6, 5], [11, 5]], look: [[7, 4], [12, 4]], knock: [[6, 5], [11, 5]] }

/** The nearest gaze that keeps both eyes inside the body, never on the outline. */
function fitGaze(face, [dx, dy], rows) {
  if (!EYES[face]) return [0, 0]
  const inside = (gx, gy) =>
    EYES[face].every(([x, y]) => eye(x + gx, y + gy).every(([ex, ey]) => 'ws'.includes(rows[ey]?.[ex] ?? '.')))
  for (const [gx, gy] of [[dx, dy], [dx, 0], [0, dy]]) if ((gx || gy) && inside(gx, gy)) return [gx, gy]
  return [0, 0]
}

/** Faces whose eyes can follow your pointer. */
export const GAZING_FACES = Object.keys(EYES)

/**
 * Build a 16x16 grid of palette keys (or null) for a pose.
 * gaze is [dx, dy], each -1, 0 or 1: which way the eyes look, in sprite space.
 */
export function frame({ face = 'idle', tail = 'a', extra = null } = {}, gaze = [0, 0]) {
  const rows = [...BODY_TOP, ...TAILS[tail]]
  const grid = rows.map(r => [...r].map(c => (c === '.' ? null : c)))
  for (const [x, y, c] of FACES[face]) grid[y][x] = c
  const [dx, dy] = fitGaze(face, gaze, rows)
  if (dx || dy) {
    // Wipe the eyes, then draw them again one pixel towards the pointer.
    for (const [x, y] of EYES[face]) for (const [ex, ey] of eye(x, y)) grid[ey][ex] = 'w'
    for (const [x, y] of EYES[face]) for (const [ex, ey, c] of eye(x + dx, y + dy)) grid[ey][ex] = c
  }
  if (extra) for (const [x, y, c] of EXTRAS[extra]) grid[y][x] = c
  return grid
}

/** Every pose the ghost uses, by name. */
export const POSES = {
  idleA: { face: 'idle', tail: 'a' },
  idleB: { face: 'idle', tail: 'b' },
  blink: { face: 'blink', tail: 'a' },
  happyA: { face: 'happy', tail: 'a' },
  happyB: { face: 'happy', tail: 'b' },
  scaredA: { face: 'scared', tail: 'a', palette: 'scared' },
  scaredB: { face: 'scared', tail: 'b', palette: 'scared' },
  sleep: { face: 'sleep', tail: 'a' },
  look: { face: 'look', tail: 'a' },
  knockA: { face: 'knock', tail: 'a', extra: 'arm' },
  knockB: { face: 'knock', tail: 'b' },
  workA: { face: 'look', tail: 'a' },
  workB: { face: 'look', tail: 'b' },
}

/** Pose name to { grid, palette }, with the eyes turned by gaze. */
export function pose(name, gaze = [0, 0], colour = 'normal') {
  const p = POSES[name]
  // Mood colours (like scared) win; otherwise the ghost's own colour.
  return { grid: frame(p, gaze), palette: PALETTES[p.palette ?? colour] ?? PALETTES.normal }
}

/** Does this pose have eyes that can follow the pointer? */
export const canGaze = name => GAZING_FACES.includes(POSES[name]?.face)

/**
 * Which way to look: from the eyes towards the pointer, as [dx, dy] in -1..1.
 * Straight ahead when the pointer is far away or right on top of Boo.
 * flip mirrors the sprite, so x turns around too.
 */
export function gazeToward(eyes, pointer, flip, near = 650, dead = 18) {
  if (!pointer) return [0, 0]
  const vx = pointer.x - eyes.x
  const vy = pointer.y - eyes.y
  const dist = Math.hypot(vx, vy)
  if (dist > near || dist < dead) return [0, 0]
  let dx = Math.abs(vx) > dist * 0.38 ? Math.sign(vx) : 0
  const dy = Math.abs(vy) > dist * 0.38 ? Math.sign(vy) : 0
  if (flip) dx = -dx
  return [dx, dy]
}
