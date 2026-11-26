// Boo, the Haunt ghost. Hand-placed 16x16 pixel art, drawn facing right.
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

/** Build a 16x16 grid of palette keys (or null) for a pose. */
export function frame({ face = 'idle', tail = 'a', extra = null } = {}) {
  const rows = [...BODY_TOP, ...TAILS[tail]]
  const grid = rows.map(r => [...r].map(c => (c === '.' ? null : c)))
  for (const [x, y, c] of FACES[face]) grid[y][x] = c
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

/** Pose name to { grid, palette }. */
export function pose(name) {
  const p = POSES[name]
  return { grid: frame(p), palette: PALETTES[p.palette ?? 'normal'] }
}
