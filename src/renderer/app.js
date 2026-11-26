// Boo's page: draws the ghost, runs the physics each frame, shows what it says,
// and lets you grab and throw it. Everything else on screen stays clickable.

import { pose, POSES, LANTERN, SIZE } from './sprites.js'
import { GHOST, ledgesFromWindows, step } from './world.js'
import { Brain } from './brain.js'

const api = window.haunt
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

const booEl = document.getElementById('boo')
const spriteEl = document.getElementById('sprite')
const lanternEl = document.getElementById('lantern')
const bubbleEl = document.getElementById('bubble')
const fxEl = document.getElementById('fx')
const sprite = spriteEl.getContext('2d')
const fx = fxEl.getContext('2d')

// ---------------------------------------------------------------- pixel art

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

const SCALE = GHOST.w / SIZE
const art = Object.fromEntries(Object.keys(POSES).map(name => {
  const { grid, palette } = pose(name)
  return [name, paint(grid, palette, SCALE)]
}))
{
  const lantern = paint(LANTERN.grid, LANTERN.palette, 4)
  lanternEl.getContext('2d').drawImage(lantern, 0, 0)
}

let drawn = { pose: '', flip: null }
function drawPose(name, flip) {
  if (drawn.pose === name && drawn.flip === flip) return
  sprite.setTransform(1, 0, 0, 1, 0, 0)
  sprite.clearRect(0, 0, GHOST.w, GHOST.h)
  if (flip) sprite.setTransform(-1, 0, 0, 1, GHOST.w, 0)
  sprite.drawImage(art[name], 0, 0)
  drawn = { pose: name, flip }
}

// ---------------------------------------------------------------- world

let world = { x: 0, y: 0, w: window.innerWidth, h: window.innerHeight }
let ledges = []
let lastWindows = []
let cursor = null

api?.onGeometry(g => {
  world = g
  ledges = ledgesFromWindows(lastWindows, world)
})
api?.onWindows(windows => {
  lastWindows = windows
  ledges = ledgesFromWindows(windows, world)
  // If the ledge Boo stands on moved or vanished, let it fall.
  if (body.ground && !body.ground.floor) {
    const same = ledges.find(l => l.y === body.ground.y && l.x1 <= body.x + GHOST.w / 2 && l.x2 >= body.x + GHOST.w / 2)
    body = { ...body, ground: same ?? null }
  }
})
api?.onCursor(p => {
  cursor = p
})

const brain = new Brain()
let body = { x: Math.round(world.w * 0.72), y: -GHOST.h, vx: 0, vy: 0, ground: null }
api?.onEvent(event => {
  brain.handle(event, performance.now())
  if (event.type === 'done') burst(body.x + GHOST.w / 2, body.y + 10, 46, CONFETTI)
  if (event.type === 'needs-you') burst(body.x + GHOST.w / 2, body.y + GHOST.h / 2, 12, SPARKLE)
})
setTimeout(() => brain.handle({ type: 'say', text: 'Boo! I will keep an eye on Kiro.' }, performance.now()), 900)

// ---------------------------------------------------------------- particles

const CONFETTI = ['#ff6fae', '#ffb347', '#36c27a', '#9b6bff', '#5bc8ff', '#fff3b0']
const SPARKLE = ['#9b6bff', '#c9b6ff', '#ffffff']
const DUST = ['#d9d0f7', '#bfb3e8']
let particles = []

function burst(x, y, count, colours, spread = 1) {
  if (reduceMotion) return
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2
    const v = (80 + Math.random() * 260) * spread
    particles.push({
      x, y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v - 220 * spread,
      life: 0.9 + Math.random() * 0.8,
      size: Math.random() < 0.3 ? 6 : 4,
      colour: colours[Math.floor(Math.random() * colours.length)],
    })
  }
}

function resizeFx() {
  fxEl.width = window.innerWidth
  fxEl.height = window.innerHeight
}
window.addEventListener('resize', resizeFx)
resizeFx()

function drawParticles(dt) {
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
}

// ---------------------------------------------------------------- grab and throw

let held = null // { dx, dy, trail: [{x, y, t}], startX, startY }
let interactive = false

function setInteractive(on) {
  if (on === interactive) return
  interactive = on
  api?.setInteractive(on)
}

function overBoo(x, y) {
  const r = booEl.getBoundingClientRect()
  if (x >= r.left - 4 && x <= r.right + 4 && y >= r.top - 4 && y <= r.bottom + 4) return true
  if (!bubbleEl.hidden) {
    const b = bubbleEl.getBoundingClientRect()
    if (x >= b.left && x <= b.right && y >= b.top && y <= b.bottom + 12) return true
  }
  return false
}

window.addEventListener('mousemove', e => {
  cursor = { x: e.clientX, y: e.clientY }
  if (held) {
    body = { x: e.clientX - held.dx, y: e.clientY - held.dy, vx: 0, vy: 0, ground: null }
    held.trail.push({ x: e.clientX, y: e.clientY, t: performance.now() })
    held.trail = held.trail.filter(p => performance.now() - p.t < 90)
    return
  }
  setInteractive(overBoo(e.clientX, e.clientY))
})

booEl.addEventListener('mousedown', e => {
  e.preventDefault()
  held = { dx: e.clientX - body.x, dy: e.clientY - body.y, trail: [], startX: e.clientX, startY: e.clientY }
  booEl.classList.add('held')
  brain.handle({ type: 'grab' }, performance.now())
})

window.addEventListener('mouseup', e => {
  if (!held) return
  const moved = Math.hypot(e.clientX - held.startX, e.clientY - held.startY)
  const first = held.trail[0]
  booEl.classList.remove('held')
  if (moved < 5) {
    held = null
    brain.handle({ type: 'letgo' }, performance.now())
    booClicked()
    return
  }
  const dt = first ? Math.max(16, performance.now() - first.t) / 1000 : 1
  const vx = first ? (e.clientX - first.x) / dt : 0
  const vy = first ? (e.clientY - first.y) / dt : 0
  body = { ...body, vx: clampV(vx), vy: clampV(vy), ground: null }
  held = null
  brain.handle({ type: 'drop' }, performance.now())
  setInteractive(overBoo(e.clientX, e.clientY))
})
const clampV = v => Math.max(-1600, Math.min(1600, v))

bubbleEl.addEventListener('mousedown', e => {
  e.preventDefault()
  booClicked()
})

// One click: Boo reacts, and the app hears about it (a migration may be waiting).
// Two quick clicks: Boo tucks itself away in the corner.
let clickTimer = null
function booClicked() {
  if (clickTimer) {
    clearTimeout(clickTimer)
    clickTimer = null
    brain.handle({ type: 'tuck' }, performance.now())
    return
  }
  clickTimer = setTimeout(() => {
    clickTimer = null
    brain.handle({ type: 'click' }, performance.now())
    api?.clicked()
  }, 260)
}

// ---------------------------------------------------------------- frame loop

let last = performance.now()
let squash = 0 // >0 squashed on landing, <0 stretched in a jump
let tuck = 0 // 0 normal size, 1 tucked away small
let bubbleText = ''
let bubbleTone = ''

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000)
  last = now

  const out = brain.update({ body, ledges, bounds: world, cursor, now })
  const before = body
  if (!held) {
    // A thrown ghost keeps its throw until it lands.
    const intent = !body.ground && Math.abs(body.vx) > 300 ? { ...out.intent, move: 0, speed: Math.abs(body.vx) } : out.intent
    body = step(body, intent, ledges, world, dt)
  }

  if (!before.ground && body.ground && before.vy > 300) {
    squash = Math.min(0.35, before.vy / 2600)
    burst(body.x + GHOST.w / 2, body.y + GHOST.h - 4, 6, DUST, 0.25)
  }
  if (before.ground && !body.ground && body.vy < 0) squash = -0.22
  squash *= Math.pow(0.0005, dt)

  // Ghosts bob gently while standing still.
  const bob = body.ground && !reduceMotion && out.pose !== 'sleep' ? Math.sin(now / 380) * 2 : 0
  const shake = out.shake && !reduceMotion ? (Math.random() - 0.5) * out.shake * 2 : 0
  // Tucked away, Boo shrinks into the corner.
  tuck += ((out.tucked ? 1 : 0) - tuck) * Math.min(1, dt * 8)
  const small = 1 - tuck * 0.45
  const sx = (1 + squash * 0.6) * small
  const sy = (1 - squash) * small
  booEl.style.transform = `translate(${Math.round(body.x + shake)}px, ${Math.round(body.y + bob * (1 - tuck))}px) scale(${sx.toFixed(3)}, ${sy.toFixed(3)})`
  booEl.style.transformOrigin = out.tucked ? '100% 100%' : '50% 100%'
  booEl.style.opacity = String(1 - tuck * 0.15)
  drawPose(out.pose, out.flip)

  // The lantern swings at Boo's front while Kiro works.
  lanternEl.classList.toggle('on', out.lantern)
  if (out.lantern) {
    const lx = out.flip ? body.x - 14 : body.x + GHOST.w - 10
    const swing = reduceMotion ? 0 : Math.sin(now / 160) * 2
    lanternEl.style.transform = `translate(${Math.round(lx)}px, ${Math.round(body.y + 30 + bob + swing)}px)`
  }

  // Sparkles trail behind Boo when it flies.
  if (out.intent.fly && Math.hypot(body.vx, body.vy) > 10 && Math.random() < 0.5) burst(body.x + GHOST.w / 2, body.y + GHOST.h - 8, 1, SPARKLE, 0.15)

  renderBubble(out.bubble)
  drawParticles(dt)
  requestAnimationFrame(frame)
}

function renderBubble(bubble) {
  if (!bubble) {
    if (!bubbleEl.hidden) bubbleEl.hidden = true
    bubbleText = ''
    return
  }
  if (bubble.text !== bubbleText || bubble.tone !== bubbleTone) {
    bubbleText = bubble.text
    bubbleTone = bubble.tone
    bubbleEl.textContent = bubble.text
    bubbleEl.className = bubble.tone
    bubbleEl.hidden = false
    // Restart the pop animation.
    bubbleEl.style.animation = 'none'
    void bubbleEl.offsetWidth
    bubbleEl.style.animation = ''
  }
  const w = bubbleEl.offsetWidth
  const h = bubbleEl.offsetHeight
  const centre = body.x + GHOST.w / 2
  let left = centre - w / 2
  left = Math.max(world.x + 6, Math.min(world.x + world.w - w - 6, left))
  let top = body.y - h - 16
  if (top < world.y + 6) top = body.y + GHOST.h + 14
  bubbleEl.style.left = `${Math.round(left)}px`
  bubbleEl.style.top = `${Math.round(top)}px`
  bubbleEl.style.setProperty('--tail-x', `${Math.round(Math.max(14, Math.min(w - 14, centre - left)))}px`)
}

requestAnimationFrame(frame)
