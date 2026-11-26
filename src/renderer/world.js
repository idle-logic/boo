// The world Boo lives in: your screen. Pure logic, no DOM, so it can be tested.
//
// Every open window's top edge is a ledge. Parts of a ledge hidden behind a
// window in front of it are cut out, so Boo only stands on edges you can see.
// The bottom of the work area, just above the taskbar, is the floor.

export const GHOST = { w: 64, h: 64 }
export const PHYSICS = {
  gravity: 2400, // px/s^2
  walk: 90, // px/s
  run: 260, // px/s, when Kiro needs you
  jump: 760, // px/s, initial upward speed
  fly: 520, // px/s, floating straight to a point
  maxFall: 1400,
}

/** Highest a jump can reach: v^2 / 2g. */
export const JUMP_HEIGHT = (PHYSICS.jump * PHYSICS.jump) / (2 * PHYSICS.gravity)

/**
 * Windows in front-to-back order (the first one is on top) become visible
 * ledges. Each window is { x, y, w, h } in overlay pixels.
 * Returns ledges { x1, x2, y } sorted top to bottom.
 */
export function ledgesFromWindows(windows, bounds, minWidth = GHOST.w * 0.75) {
  const ledges = []
  windows.forEach((win, i) => {
    const y = win.y
    if (y < bounds.y + GHOST.h || y >= bounds.y + bounds.h - 8) return
    let segments = [[Math.max(win.x, bounds.x), Math.min(win.x + win.w, bounds.x + bounds.w)]]
    for (let j = 0; j < i; j++) {
      const front = windows[j]
      // A window in front hides this edge where it covers it, or sits just above it.
      const covers = front.y <= y + 2 && front.y + front.h > y - GHOST.h * 0.5
      if (!covers) continue
      segments = cut(segments, front.x, front.x + front.w)
    }
    for (const [x1, x2] of segments) if (x2 - x1 >= minWidth) ledges.push({ x1, x2, y })
  })
  return ledges.sort((a, b) => a.y - b.y)
}

function cut(segments, cx1, cx2) {
  const out = []
  for (const [a, b] of segments) {
    if (cx2 <= a || cx1 >= b) out.push([a, b])
    else {
      if (cx1 > a) out.push([a, cx1])
      if (cx2 < b) out.push([cx2, b])
    }
  }
  return out
}

/** The floor ledge: the whole width, at the bottom of the work area. */
export function floorLedge(bounds) {
  return { x1: bounds.x, x2: bounds.x + bounds.w, y: bounds.y + bounds.h, floor: true }
}

/**
 * One physics step. `body` is { x, y, vx, vy, ground } where x, y is the
 * ghost's top-left and `ground` is the ledge it stands on, or null.
 * `intent` is { move: -1 | 0 | 1, speed, jump, fly: {x, y} | null }.
 * Returns a new body. Never leaves the bounds.
 */
export function step(body, intent, ledges, bounds, dt) {
  dt = Math.min(dt, 1 / 20)
  let { x, y, vx, vy, ground } = body

  if (intent.fly) {
    // Ghosts can float. Straight line to the target, no gravity.
    const dx = intent.fly.x - x
    const dy = intent.fly.y - y
    const dist = Math.hypot(dx, dy)
    const stepLen = Math.min(dist, PHYSICS.fly * dt)
    if (dist > 0.5) {
      x += (dx / dist) * stepLen
      y += (dy / dist) * stepLen
    }
    return clamp({ x, y, vx: dist > 0.5 ? (dx / dist) * PHYSICS.fly : 0, vy: 0, ground: null }, bounds)
  }

  const speed = intent.speed ?? PHYSICS.walk
  if (ground) {
    vx = intent.move * speed
    vy = 0
    if (intent.jump) {
      vy = -PHYSICS.jump
      ground = null
    }
  } else {
    // Some steering in the air, like a platformer.
    vx += (intent.move * speed - vx) * Math.min(1, dt * 4)
  }

  if (!ground) vy = Math.min(PHYSICS.maxFall, vy + PHYSICS.gravity * dt)

  const prevFeet = y + GHOST.h
  x += vx * dt
  y += vy * dt
  const feet = y + GHOST.h
  const centre = x + GHOST.w / 2

  if (ground) {
    // Walked off the edge of a ledge: start falling.
    if (centre < ground.x1 || centre > ground.x2) ground = null
    else y = ground.y - GHOST.h
  } else if (vy >= 0) {
    // Landing: the feet crossed a ledge top this step while over it.
    const all = [...ledges, floorLedge(bounds)]
    let landed = null
    for (const l of all) {
      if (prevFeet <= l.y + 0.5 && feet >= l.y && centre >= l.x1 && centre <= l.x2) {
        if (!landed || l.y < landed.y) landed = l
      }
    }
    if (landed) {
      ground = landed
      y = landed.y - GHOST.h
      vy = 0
    }
  }

  return clamp({ x, y, vx, vy, ground }, bounds)
}

function clamp(body, bounds) {
  const maxX = bounds.x + bounds.w - GHOST.w
  const maxY = bounds.y + bounds.h - GHOST.h
  let { x, y, vx, vy, ground } = body
  if (x < bounds.x) { x = bounds.x; vx = Math.max(0, vx) }
  if (x > maxX) { x = maxX; vx = Math.min(0, vx) }
  if (y < bounds.y) { y = bounds.y; vy = Math.max(0, vy) }
  if (y >= maxY) {
    y = maxY
    if (!ground) { ground = floorLedge(bounds); vy = 0 }
  }
  return { x, y, vx, vy, ground }
}

/** Ledges Boo can reach from where it stands with one jump, nearest first. */
export function reachable(body, ledges) {
  if (!body.ground) return []
  const feet = body.y + GHOST.h
  const centre = body.x + GHOST.w / 2
  return ledges
    .filter(l => l !== body.ground && l.y < feet - 20 && feet - l.y < JUMP_HEIGHT * 0.85)
    .map(l => ({ ledge: l, dist: Math.max(0, l.x1 - centre, centre - l.x2) }))
    .filter(r => r.dist < 260)
    .sort((a, b) => a.dist - b.dist)
    .map(r => r.ledge)
}
