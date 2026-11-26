// Boo inside a web page. Same pixel art, physics and brain as the desktop app,
// but the "screen" is this page and the windows are elements on it.

import { pose, LANTERN, SIZE, canGaze, gazeToward } from './lib/sprites.js'
import { GHOST, ledgesFromWindows, step } from './lib/world.js'
import { Brain } from './lib/brain.js'

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

const CONFETTI = ['#ff6fae', '#ffb347', '#36c27a', '#9b6bff', '#5bc8ff', '#fff3b0']
const SPARKLE = ['#9b6bff', '#c9b6ff', '#ffffff']
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

/**
 * Create Boo on the page.
 * opts.windows(): elements Boo can stand on, front to back.
 * opts.bounds(): { x, y, w, h } of the area Boo lives in.
 * opts.onClick(): called when Boo or its bubble is clicked.
 */
export function createBoo({ windows, bounds, onClick = () => {} }) {
  const layer = document.createElement('div')
  layer.className = 'boo-layer'
  layer.innerHTML = `
    <canvas class="boo-fx" aria-hidden="true"></canvas>
    <canvas class="boo-lantern" width="24" height="32" aria-hidden="true"></canvas>
    <button class="boo" type="button" aria-label="Boo the ghost. Click to talk, double-click to tuck away, drag to throw.">
      <canvas width="64" height="64"></canvas>
    </button>
    <div class="boo-bubble" role="status" aria-live="polite" hidden></div>`
  document.body.appendChild(layer)

  const booEl = layer.querySelector('.boo')
  const sprite = booEl.querySelector('canvas').getContext('2d')
  const lanternEl = layer.querySelector('.boo-lantern')
  const bubbleEl = layer.querySelector('.boo-bubble')
  const fxEl = layer.querySelector('.boo-fx')
  const fx = fxEl.getContext('2d')

  const SCALE = GHOST.w / SIZE
  // Each pose and eye direction is painted once, the first time it is needed.
  const artCache = new Map()
  function art(name, gaze) {
    const key = `${name}:${gaze}`
    if (!artCache.has(key)) {
      const { grid, palette } = pose(name, gaze)
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
  let world = bounds()
  let body = { x: world.x + world.w * 0.62, y: world.y, vx: 0, vy: 0, ground: null }
  let ledges = []
  let cursor = null
  let particles = []

  function burst(x, y, count, colours, spread = 1) {
    if (reduceMotion) return
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2
      const v = (80 + Math.random() * 260) * spread
      particles.push({
        x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 220 * spread,
        life: 0.9 + Math.random() * 0.8, size: Math.random() < 0.3 ? 6 : 4,
        colour: colours[Math.floor(Math.random() * colours.length)],
      })
    }
  }

  function readWorld() {
    world = bounds()
    const rects = windows().map(el => {
      const r = el.getBoundingClientRect()
      return { x: r.left, y: r.top, w: r.width, h: r.height }
    })
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
  window.addEventListener('pointermove', e => {
    cursor = { x: e.clientX, y: e.clientY }
  })

  function resizeFx() {
    fxEl.width = window.innerWidth
    fxEl.height = window.innerHeight
  }
  window.addEventListener('resize', resizeFx)
  resizeFx()

  let last = performance.now()
  let squash = 0
  let tuck = 0
  let bubbleKey = ''

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000)
    last = now
    readWorld()

    const out = brain.update({ body, ledges, bounds: world, cursor, now })
    const before = body
    if (!held) {
      const intent = !body.ground && Math.abs(body.vx) > 300 ? { ...out.intent, move: 0, speed: Math.abs(body.vx) } : out.intent
      body = step(body, intent, ledges, world, dt)
    }
    if (!before.ground && body.ground && before.vy > 300) {
      squash = Math.min(0.35, before.vy / 2600)
      burst(body.x + GHOST.w / 2, body.y + GHOST.h - 4, 6, DUST, 0.25)
    }
    if (before.ground && !body.ground && body.vy < 0) squash = -0.22
    squash *= Math.pow(0.0005, dt)
    tuck += ((out.tucked ? 1 : 0) - tuck) * Math.min(1, dt * 8)

    const bob = body.ground && !reduceMotion && out.pose !== 'sleep' ? Math.sin(now / 380) * 2 * (1 - tuck) : 0
    const shake = out.shake && !reduceMotion ? (Math.random() - 0.5) * out.shake * 2 : 0
    const small = 1 - tuck * 0.45
    booEl.style.transformOrigin = out.tucked ? '100% 100%' : '50% 100%'
    booEl.style.transform = `translate(${Math.round(body.x + shake)}px, ${Math.round(body.y + bob)}px) scale(${((1 + squash * 0.6) * small).toFixed(3)}, ${((1 - squash) * small).toFixed(3)})`
    // The eyes follow your pointer when it is near.
    const gaze = canGaze(out.pose) ? gazeToward({ x: body.x + GHOST.w / 2, y: body.y + GHOST.h * 0.4 }, cursor, out.flip) : [0, 0]
    drawPose(out.pose, out.flip, gaze)

    lanternEl.classList.toggle('on', out.lantern)
    if (out.lantern) {
      const lx = out.flip ? body.x - 14 : body.x + GHOST.w - 10
      lanternEl.style.transform = `translate(${Math.round(lx)}px, ${Math.round(body.y + 30 + bob + (reduceMotion ? 0 : Math.sin(now / 160) * 2))}px)`
    }
    if (out.intent.fly && Math.hypot(body.vx, body.vy) > 10 && Math.random() < 0.5) burst(body.x + GHOST.w / 2, body.y + GHOST.h - 8, 1, SPARKLE, 0.15)

    // Bubble.
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
        bubbleEl.className = `boo-bubble ${b.tone}`
        bubbleEl.hidden = false
      }
      const w = bubbleEl.offsetWidth
      const h = bubbleEl.offsetHeight
      const centre = body.x + GHOST.w / 2
      const left = Math.max(world.x + 6, Math.min(world.x + world.w - w - 6, centre - w / 2))
      let top = body.y - h - 16
      if (top < world.y + 6) top = body.y + GHOST.h + 14
      bubbleEl.style.left = `${Math.round(left)}px`
      bubbleEl.style.top = `${Math.round(top)}px`
      bubbleEl.style.setProperty('--tail-x', `${Math.round(Math.max(14, Math.min(w - 14, centre - left)))}px`)
    }

    // Particles.
    fx.clearRect(0, 0, fxEl.width, fxEl.height)
    particles = particles.filter(p => (p.life -= dt) > 0)
    for (const p of particles) {
      p.vy += 900 * dt
      p.x += p.vx * dt
      p.y += p.vy * dt
      fx.globalAlpha = Math.min(1, p.life * 2)
      fx.fillStyle = p.colour
      fx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size)
    }
    fx.globalAlpha = 1

    requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)

  return {
    /** Tell Boo something: the same events the desktop app takes. */
    handle(event) {
      brain.handle(event, performance.now())
      if (event.type === 'done') burst(body.x + GHOST.w / 2, body.y + 10, 46, CONFETTI)
    },
    get mode() {
      return brain.mode
    },
    /** Ask the person something. Resolves true for Yes, false for No. */
    ask(text) {
      if (asking) asking.resolve(false)
      return new Promise(resolve => {
        asking = { resolve }
        brain.handle({ type: 'wait', text }, performance.now())
      })
    },
    /** Answer the open question from elsewhere, like Boo's window. */
    answer(yes) {
      answerAsk(yes)
    },
    get asking() {
      return Boolean(asking)
    },
  }
}
