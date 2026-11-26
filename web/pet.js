// Boo off duty: the roaming ghost from the desktop app, inside the page. It
// walks along the tops of the cards and the bottom of the screen, its eyes
// follow your pointer, and you can click it, grab it, throw it, or
// double-click to tuck it away. Same pixel art, physics and behaviour as the
// desktop Boo. When there is work, the flying ghost in ghost.js takes over.

import { pose, LANTERN, SIZE, canGaze, gazeToward } from './lib/sprites.js'
import { GHOST, ledgesFromWindows, step } from './lib/world.js'
import { Brain } from './lib/brain.js'

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

export const CONFETTI = ['#ff6fae', '#ffb347', '#36c27a', '#9b6bff', '#5bc8ff', '#fff3b0']
export const SPARKLE = ['#9b6bff', '#c9b6ff', '#ffffff']
const DUST = ['#d9d0f7', '#bfb3e8']

function paint(grid, palette, scale) {
  const c = document.createElement('canvas')
  c.width = grid[0].length * scale
  c.height = grid.length * scale
  const g = c.getContext('2d')
  grid.forEach((row, y) =>
    row.forEach((key, x) => {
      if (!key) return
      g.fillStyle = palette[key]
      g.fillRect(x * scale, y * scale, scale, scale)
    }),
  )
  return c
}

// ------------------------------------------------------------- shared layer and particles

let shared = null
function layer() {
  if (shared) return shared
  const el = document.createElement('div')
  el.className = 'boo-layer'
  const fxEl = document.createElement('canvas')
  fxEl.className = 'boo-fx'
  fxEl.setAttribute('aria-hidden', 'true')
  el.appendChild(fxEl)
  document.body.appendChild(el)
  const fx = fxEl.getContext('2d')
  const resize = () => {
    fxEl.width = window.innerWidth
    fxEl.height = window.innerHeight
  }
  window.addEventListener('resize', resize)
  resize()
  let particles = []
  let cursor = null
  window.addEventListener('pointermove', e => (cursor = { x: e.clientX, y: e.clientY }))
  let last = performance.now()
  const loop = now => {
    const dt = Math.min(0.05, (now - last) / 1000)
    last = now
    fx.clearRect(0, 0, fxEl.width, fxEl.height)
    particles = particles.filter(p => (p.life -= dt) > 0)
    for (const p of particles) {
      p.vy += (p.gravity ?? 900) * dt
      p.x += p.vx * dt
      p.y += p.vy * dt
      fx.globalAlpha = Math.min(1, p.life * 2)
      fx.fillStyle = p.colour
      fx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size)
    }
    fx.globalAlpha = 1
    requestAnimationFrame(loop)
  }
  requestAnimationFrame(loop)
  shared = {
    el,
    get cursor() {
      return cursor
    },
    burst(x, y, count, colours, spread = 1, gravity = 900) {
      if (reduceMotion) return
      for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2
        const v = (80 + Math.random() * 260) * spread
        particles.push({
          x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 220 * spread, gravity,
          life: 0.9 + Math.random() * 0.8, size: Math.random() < 0.3 ? 6 : 4,
          colour: colours[Math.floor(Math.random() * colours.length)],
        })
      }
    },
  }
  return shared
}

/** Sparkles, confetti and dust anywhere on the page. */
export function burst(...args) {
  layer().burst(...args)
}

// ------------------------------------------------------------- one ghost

/**
 * Create a ghost on the page.
 * windows(): elements to stand on, front to back. bounds(): the area to live in.
 * colour: 'normal' (Boo) or a worker colour ('mint', 'peach', 'sky').
 * size: drawn size, 1 is full. interactive: can be clicked, grabbed and thrown.
 * at: where it appears, top-left { x, y }. pop: grow from nothing there (false when it is already visible, like after rising from the grave).
 */
export function createBoo({ windows, bounds, onClick = () => {}, colour = 'normal', size = 1, interactive = true, at = null, pop = true, label = 'Boo the ghost', obstacles = () => [], nap = null }) {
  const { el: host, burst: puff, cursor: _ } = layer()
  const shared = layer()

  const lanternEl = document.createElement('canvas')
  lanternEl.className = 'boo-lantern'
  lanternEl.width = 24
  lanternEl.height = 32
  lanternEl.setAttribute('aria-hidden', 'true')
  const booEl = document.createElement(interactive ? 'button' : 'div')
  booEl.className = `boo${interactive ? '' : ' worker'}`
  if (interactive) {
    booEl.type = 'button'
    booEl.setAttribute('aria-label', `${label}. Click to talk, double-click to tuck away, drag to throw.`)
  } else booEl.setAttribute('aria-hidden', 'true')
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 64
  booEl.appendChild(canvas)
  const bubbleEl = document.createElement('div')
  bubbleEl.className = `boo-bubble${size < 1 ? ' small' : ''}`
  bubbleEl.setAttribute('role', 'status')
  bubbleEl.hidden = true
  host.append(lanternEl, booEl, bubbleEl)

  const sprite = canvas.getContext('2d')
  const SCALE = GHOST.w / SIZE
  const artCache = new Map()
  function art(name, gaze) {
    const key = `${name}:${gaze}`
    if (!artCache.has(key)) {
      const { grid, palette } = pose(name, gaze, colour)
      artCache.set(key, paint(grid, palette, SCALE))
    }
    return artCache.get(key)
  }
  lanternEl.getContext('2d').drawImage(paint(LANTERN.grid, LANTERN.palette, 4), 0, 0)

  let drawn = ''
  function drawPose(name, flip, gaze) {
    const key = `${name}${flip}${gaze}`
    if (drawn === key) return
    sprite.setTransform(1, 0, 0, 1, 0, 0)
    sprite.clearRect(0, 0, GHOST.w, GHOST.h)
    if (flip) sprite.setTransform(-1, 0, 0, 1, GHOST.w, 0)
    sprite.drawImage(art(name, gaze), 0, 0)
    drawn = key
  }

  const brain = new Brain()

  brain.tuckCorner = 'left' // in the page, Boo tucks into the bottom-left corner, where it naps
  let world = bounds()
  let body = { x: at?.x ?? world.x + world.w * 0.62, y: at?.y ?? world.y, vx: 0, vy: 0, ground: null }
  let ledges = []
  let alive = true
  let grow = at && pop ? 0 : 1 // new worker ghosts pop out of nothing
  let targetSize = size

  function readWorld() {
    world = bounds()
    const rects = [
      ...obstacles().map(o => ({ x: o.left, y: o.top, w: o.right - o.left, h: o.bottom - o.top })),
      ...windows().map(el => {
        const r = el.getBoundingClientRect()
        return { x: r.left, y: r.top, w: r.width, h: r.height }
      }),
    ]
    ledges = ledgesFromWindows(rects, world)
    if (body.ground && !body.ground.floor) {
      const c = body.x + GHOST.w / 2
      const same = ledges.find(l => Math.abs(l.y - body.ground.y) < 1 && l.x1 <= c && l.x2 >= c)
      body = { ...body, ground: same ?? null }
    }
  }

  // Grab, throw, click, double-click.
  let held = null
  let clickTimer = null
  function clicked() {
    if (clickTimer) {
      clearTimeout(clickTimer)
      clickTimer = null
      brain.handle({ type: 'tuck' }, performance.now())
      return
    }
    clickTimer = setTimeout(() => {
      clickTimer = null
      brain.handle({ type: 'click' }, performance.now())
      onClick()
    }, 260)
  }

  if (interactive) {
    booEl.addEventListener('pointerdown', e => {
      e.preventDefault()
      booEl.setPointerCapture(e.pointerId)
      held = { dx: e.clientX - body.x, dy: e.clientY - body.y, trail: [], sx: e.clientX, sy: e.clientY }
      brain.handle({ type: 'grab' }, performance.now())
    })
    booEl.addEventListener('pointermove', e => {
      if (!held) return
      body = { x: e.clientX - held.dx, y: e.clientY - held.dy, vx: 0, vy: 0, ground: null }
      held.trail.push({ x: e.clientX, y: e.clientY, t: performance.now() })
      held.trail = held.trail.filter(p => performance.now() - p.t < 90)
    })
    booEl.addEventListener('pointerup', e => {
      if (!held) return
      const moved = Math.hypot(e.clientX - held.sx, e.clientY - held.sy)
      const first = held.trail[0]
      held = null
      if (moved < 5) {
        brain.handle({ type: 'letgo' }, performance.now())
        clicked()
        return
      }
      const dt = first ? Math.max(16, performance.now() - first.t) / 1000 : 1
      const clamp = v => Math.max(-1600, Math.min(1600, v))
      body = { ...body, vx: first ? clamp((e.clientX - first.x) / dt) : 0, vy: first ? clamp((e.clientY - first.y) / dt) : 0, ground: null }
      brain.handle({ type: 'drop' }, performance.now())
    })
    booEl.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        brain.handle({ type: 'click' }, performance.now())
        onClick()
      }
    })
  }
  bubbleEl.addEventListener('click', e => {
    const answer = e.target.closest('[data-answer]')
    if (answer) {
      e.stopPropagation()
      answerAsk(answer.dataset.answer === 'yes')
      return
    }
    brain.handle({ type: 'click' }, performance.now())
    onClick()
  })

  // A question for the person, with Yes and No in the bubble.
  let asking = null
  function answerAsk(yes) {
    if (!asking) return
    const { resolve } = asking
    asking = null
    brain.bubble = null
    brain.handle({ type: 'guide-say', text: yes ? 'On it.' : 'Okay, I will not.' }, performance.now())
    resolve(yes)
  }

  let last = performance.now()
  let squash = 0
  let tuck = 0
  let bubbleKey = ''
  let lastBump = 0
  let lastHopSaid = 0
  let lastPoke = performance.now()
  let napping = false
  // Anything you do with Boo keeps it awake.
  booEl.addEventListener('pointerdown', () => {
    lastPoke = performance.now()
    napping = false
  })

  function frame(now) {
    if (!alive) return
    const dt = Math.min(0.05, (now - last) / 1000)
    last = now
    readWorld()

    const out = brain.update({ body, ledges, bounds: world, cursor: shared.cursor, now })
    const before = body
    if (!held) {
      const intent = !body.ground && Math.abs(body.vx) > 300 ? { ...out.intent, move: 0, speed: Math.abs(body.vx) } : out.intent
      body = step(body, intent, ledges, world, dt)
    }
    for (const o of held ? [] : obstacles()) {
      const inside = body.x + GHOST.w > o.left + 2 && body.x < o.right - 2 && body.y + GHOST.h > o.top + 6 && body.y < o.bottom
      if (!inside) continue
      // Came in from above: stand on it. Otherwise: bump off the nearer side.
      if (before.y + GHOST.h <= o.top + 8) {
        body = { ...body, y: o.top - GHOST.h, vy: 0 }
        continue
      }
      const fromLeft = body.x + GHOST.w / 2 < (o.left + o.right) / 2
      const edge = fromLeft ? o.left - GHOST.w : o.right
      if (body.ground) {
        // Bumped into it again: hop up and land on top of it.
        body = { ...body, x: edge, vy: -760, vx: (fromLeft ? 1 : -1) * 160, ground: null }
        squash = -0.22
        if (now - lastHopSaid > 9000) brain.handle({ type: 'say', text: 'Up we go!' }, now), (lastHopSaid = now)
        lastBump = 0
        continue
      }
      body = { ...body, x: edge, vx: (fromLeft ? -1 : 1) * Math.max(80, Math.abs(body.vx) * 0.4) }
      squash = 0.25
      if (now - lastBump > 900) puff(fromLeft ? o.left : o.right, body.y + GHOST.h / 2, 5, DUST, 0.2)
      if (now - lastBump > 7000) brain.handle({ type: 'say', text: ['Oof!', 'Hey, who put that there?', 'Ow.'][Math.floor(Math.random() * 3)] }, now)
      lastBump = now
    }
    if (nap) {
      if (brain.mode === 'wander' && !held && !napping && now - lastPoke > nap.after) {
        napping = true
        const s = nap.spot(world)
        brain.handle({ type: 'goto', x: s.x, y: s.y }, now)
      } else if (napping && brain.mode === 'goto') {
        const s = nap.spot(world)
        if (Math.hypot(body.x - s.x, body.y - s.y) < 10) {
          brain.handle({ type: 'release' }, now)
          brain.lastActivity = -Infinity // so it dozes off right here
        }
      } else if (napping && !['goto', 'wander', 'sleep'].includes(brain.mode)) napping = false
      if (napping && brain.mode === 'wander' && now - lastPoke < 500) napping = false
    }
    if (!before.ground && body.ground && before.vy > 300) {
      squash = Math.min(0.35, before.vy / 2600)
      puff(body.x + GHOST.w / 2, body.y + GHOST.h - 4, 6, DUST, 0.25)
    }
    if (before.ground && !body.ground && body.vy < 0) squash = -0.22
    squash *= Math.pow(0.0005, dt)
    tuck += ((out.tucked ? 1 : 0) - tuck) * Math.min(1, dt * 8)
    grow += (targetSize - grow) * Math.min(1, dt * 9)

    const bob = body.ground && !reduceMotion && out.pose !== 'sleep' ? Math.sin(now / 380) * 2 * (1 - tuck) : 0
    const shake = out.shake && !reduceMotion ? (Math.random() - 0.5) * out.shake * 2 : 0
    const small = (1 - tuck * 0.45) * grow
    booEl.style.transformOrigin = out.tucked ? '0% 100%' : '50% 100%'
    booEl.style.transform = `translate(${Math.round(body.x + shake)}px, ${Math.round(body.y + bob)}px) scale(${((1 + squash * 0.6) * small).toFixed(3)}, ${((1 - squash) * small).toFixed(3)})`
    const gaze = canGaze(out.pose) ? gazeToward({ x: body.x + GHOST.w / 2, y: body.y + GHOST.h * 0.4 }, shared.cursor, out.flip) : [0, 0]
    drawPose(out.pose, out.flip, gaze)

    lanternEl.classList.toggle('on', out.lantern && grow > 0.5)
    if (out.lantern) {
      const lx = out.flip ? body.x + GHOST.w * (1 - grow) / 2 - 14 * grow : body.x + GHOST.w / 2 + (GHOST.w / 2 - 10) * grow
      lanternEl.style.transform = `translate(${Math.round(lx)}px, ${Math.round(body.y + GHOST.h - (GHOST.h - 30) * grow + bob)}px) scale(${grow.toFixed(2)})`
    }
    if (out.intent.fly && Math.hypot(body.vx, body.vy) > 10 && Math.random() < 0.5) {
      puff(body.x + GHOST.w / 2, body.y + GHOST.h - 8, 1, SPARKLE, 0.15)
    }

    const b = out.bubble
    if (!b) {
      bubbleEl.hidden = true
      bubbleKey = ''
    } else {
      const key = b.text + b.tone + (asking ? 'ask' : '')
      if (key !== bubbleKey) {
        bubbleKey = key
        bubbleEl.textContent = b.text
        if (asking) {
          const row = document.createElement('span')
          row.className = 'boo-ask'
          row.innerHTML = '<button type="button" data-answer="yes">Yes</button><button type="button" data-answer="no">No</button>'
          bubbleEl.appendChild(row)
        }
        bubbleEl.className = `boo-bubble ${b.tone}${size < 1 ? ' small' : ''}`
        bubbleEl.hidden = false
      }
      const w = bubbleEl.offsetWidth
      const h = bubbleEl.offsetHeight
      const centre = body.x + GHOST.w / 2
      const left = Math.max(world.x + 6, Math.min(world.x + world.w - w - 6, centre - w / 2))
      const headTop = body.y + GHOST.h * (1 - grow)
      let top = headTop - h - 14
      if (top < world.y + 6) top = body.y + GHOST.h + 14
      bubbleEl.style.left = `${Math.round(left)}px`
      bubbleEl.style.top = `${Math.round(top)}px`
      bubbleEl.style.setProperty('--tail-x', `${Math.round(Math.max(14, Math.min(w - 14, centre - left)))}px`)
    }
    requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)

  return {
    /** Tell the ghost something: the same events the desktop app takes. */
    handle(event) {
      brain.handle(event, performance.now())
      if (event.type === 'done') puff(body.x + GHOST.w / 2, body.y + 10, 46, CONFETTI)
    },
    get mode() {
      return brain.mode
    },
    /** Centre of the ghost as drawn. */
    centre() {
      return { x: body.x + GHOST.w / 2, y: body.y + GHOST.h * (1 - grow / 2) }
    },
    /** Top-left of the physics box, for flying to. */
    get box() {
      return { x: body.x, y: body.y }
    },
    /** A little bounce, like after swallowing a worker. */
    gulp() {
      squash = 0.3
    },
    /** Shrink to nothing. Resolves when gone. */
    vanish() {
      targetSize = 0
      return new Promise(r => setTimeout(r, 260))
    },
    destroy() {
      alive = false
      booEl.remove()
      bubbleEl.remove()
      lanternEl.remove()
    },
    /** Ask the person something. Resolves true for Yes, false for No. */
    ask(text) {
      if (asking) asking.resolve(false)
      return new Promise(resolve => {
        asking = { resolve }
        brain.handle({ type: 'wait', text }, performance.now())
      })
    },
    answer(yes) {
      answerAsk(yes)
    },
    get asking() {
      return Boolean(asking)
    },
  }
}
