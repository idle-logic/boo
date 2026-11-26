// Boo and its crew: pixel ghosts that fly over the apps and do the work.
// The same hand-drawn sprites as the desktop Boo, without the physics: here
// they float, fly to what they are using, and split and merge.

import { pose, LANTERN } from './lib/sprites.js'

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
export const SPARKLE = ['#9b6bff', '#c9b6ff', '#ffffff']
export const CONFETTI = ['#ff6fae', '#ffb347', '#36c27a', '#9b6bff', '#5bc8ff', '#fff3b0']
const ease = t => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2)

function paint(grid, palette, scale) {
  const c = document.createElement('canvas')
  c.width = grid[0].length * scale
  c.height = grid.length * scale
  const g = c.getContext('2d')
  grid.forEach((row, y) => row.forEach((k, x) => k && ((g.fillStyle = palette[k]), g.fillRect(x * scale, y * scale, scale, scale))))
  return c
}

// ------------------------------------------------------------- one shared layer for ghosts and sparkles

let shared = null
function layer() {
  if (shared) return shared
  const el = document.createElement('div')
  el.className = 'ghost-layer'
  const fx = document.createElement('canvas')
  fx.className = 'ghost-fx'
  el.appendChild(fx)
  document.body.appendChild(el)
  const g = fx.getContext('2d')
  const size = () => ((fx.width = innerWidth), (fx.height = innerHeight))
  addEventListener('resize', size)
  size()
  let bits = []
  let last = performance.now()
  const loop = now => {
    const dt = Math.min(0.05, (now - last) / 1000)
    last = now
    g.clearRect(0, 0, fx.width, fx.height)
    bits = bits.filter(b => (b.life -= dt) > 0)
    for (const b of bits) {
      b.vy += b.gravity * dt
      b.x += b.vx * dt
      b.y += b.vy * dt
      g.globalAlpha = Math.min(1, b.life * 2)
      g.fillStyle = b.colour
      g.fillRect(Math.round(b.x), Math.round(b.y), b.size, b.size)
    }
    g.globalAlpha = 1
    requestAnimationFrame(loop)
  }
  requestAnimationFrame(loop)
  shared = {
    el,
    burst(x, y, count, colours, spread = 1, gravity = 700) {
      if (reduceMotion) return
      for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2
        const v = (60 + Math.random() * 220) * spread
        bits.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 160 * spread, gravity, life: 0.7 + Math.random() * 0.7, size: Math.random() < 0.3 ? 5 : 3, colour: colours[Math.floor(Math.random() * colours.length)] })
      }
    },
  }
  return shared
}

export const burst = (...args) => layer().burst(...args)

// ------------------------------------------------------------- one ghost

const MODES = {
  idle: ['idleA', 'idleB'],
  work: ['workA', 'workB'],
  look: ['look', 'look'],
  happy: ['happyA', 'happyB'],
  alert: ['knockA', 'knockB'],
  scared: ['scaredA', 'scaredB'],
}

/**
 * A ghost. colour: 'normal' (Boo), 'mint', 'peach' or 'sky'. size in px.
 * at: top-left to appear at. label: a small name tag, or none.
 */
export function createGhost({ colour = 'normal', size = 48, at = { x: 0, y: 0 }, label = '', title = 'Boo' } = {}) {
  const host = layer().el
  const el = document.createElement('div')
  el.className = 'ghost'
  el.setAttribute('role', 'img')
  el.setAttribute('aria-label', title)
  const sprite = document.createElement('canvas')
  const lantern = paint(LANTERN.grid, LANTERN.palette, 3)
  lantern.className = 'ghost-lantern'
  const tag = document.createElement('span')
  tag.className = 'ghost-tag'
  tag.textContent = label
  tag.hidden = !label
  const bubble = document.createElement('div')
  bubble.className = 'ghost-bubble'
  bubble.hidden = true
  el.append(lantern, sprite, tag)
  host.append(el, bubble)

  let x = at.x
  let y = at.y
  let s = size
  let scale = 0 // grows in when it appears
  let targetScale = 1
  let mode = 'idle'
  let flip = false
  let flight = null
  let squash = 0
  let alive = true
  let bubbleUntil = 0
  let mood = null
  let moodUntil = 0
  const cache = new Map()

  function art(name) {
    const px = Math.max(1, Math.round(s / 16))
    const key = `${name}:${px}`
    if (!cache.has(key)) {
      const { grid, palette } = pose(name, [0, 0], colour)
      cache.set(key, paint(grid, palette, px))
    }
    return cache.get(key)
  }

  function frame(now) {
    if (!alive) return
    if (flight) {
      const t = Math.min(1, (now - flight.t0) / flight.ms)
      const k = ease(t)
      x = flight.x0 + (flight.x1 - flight.x0) * k
      y = flight.y0 + (flight.y1 - flight.y0) * k - Math.sin(Math.PI * k) * flight.arc
      if (flight.s1 !== undefined) s = flight.s0 + (flight.s1 - flight.s0) * k
      if (t >= 1) {
        const done = flight.done
        flight = null
        done()
      }
    }
    scale += (targetScale - scale) * 0.2
    squash *= 0.85
    const shown = mood && now < moodUntil ? mood : mode
    const frames = MODES[shown] ?? MODES.idle
    const blink = shown === 'idle' && now % 3200 < 130
    const name = blink ? 'blink' : frames[Math.floor(now / (shown === 'work' ? 180 : 320)) % 2]
    const img = art(name)
    if (sprite.width !== img.width) {
      sprite.width = img.width
      sprite.height = img.height
    }
    const g = sprite.getContext('2d')
    g.setTransform(1, 0, 0, 1, 0, 0)
    g.clearRect(0, 0, sprite.width, sprite.height)
    if (flip) g.setTransform(-1, 0, 0, 1, sprite.width, 0)
    g.drawImage(img, 0, 0)
    sprite.style.width = sprite.style.height = `${Math.round(s)}px`
    const bob = reduceMotion || flight ? 0 : Math.sin(now / (shown === 'happy' ? 140 : 420)) * (shown === 'happy' ? 4 : 2.5)
    el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y + bob)}px) scale(${(scale * (1 + squash * 0.3)).toFixed(3)}, ${(scale * (1 - squash * 0.3)).toFixed(3)})`
    lantern.hidden = shown !== 'work' || s < 30
    lantern.style.left = flip ? '-10px' : `${Math.round(s - 6)}px`
    lantern.style.top = `${Math.round(s * 0.45)}px`
    if (!bubble.hidden) {
      if (now > bubbleUntil) bubble.hidden = true
      const w = bubble.offsetWidth
      const left = Math.max(8, Math.min(innerWidth - w - 8, x + s / 2 - w / 2))
      let top = y - bubble.offsetHeight - 10
      if (top < 8) top = y + s + 10
      bubble.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`
    }
    requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)

  return {
    /** The size it works at. Parked ghosts are smaller and grow back when they fly in. */
    workSize: size,
    get box() {
      return { x, y, size: s }
    },
    centre: () => ({ x: x + s / 2, y: y + s / 2 }),
    /** Fly so the top-left lands at (tx, ty). Resolves on arrival. */
    flyTo(tx, ty, ms = 500, { size: newSize, arc } = {}) {
      if (Math.abs(tx - x) > 2) flip = tx < x
      if (reduceMotion) ms = 1
      return new Promise(done => {
        flight?.done()
        const dist = Math.hypot(tx - x, ty - y)
        flight = { t0: performance.now(), ms: Math.max(1, ms), x0: x, y0: y, x1: tx, y1: ty, s0: s, s1: newSize, arc: arc ?? Math.min(40, dist / 8), done }
      })
    },
    place(tx, ty) {
      flight?.done()
      flight = null
      x = tx
      y = ty
    },
    mode(m) {
      mode = m
    },
    /** Show a feeling for a moment, whatever it is doing. */
    react(m, text, ms = 2600) {
      mood = m
      moodUntil = performance.now() + ms
      if (text) this.say(text, ms)
    },
    /** Pop into being at a spot. */
    appear(ax, ay) {
      this.place(ax, ay)
      scale = 0
      targetScale = 1
      el.hidden = false
    },
    say(text, ms = 2600) {
      bubble.textContent = text
      bubble.hidden = false
      bubbleUntil = performance.now() + ms
    },
    poke() {
      squash = 1
      const c = this.centre()
      burst(c.x, c.y, 6, SPARKLE, 0.25, 200)
    },
    face(left) {
      flip = left
    },
    hide() {
      el.hidden = true
      bubble.hidden = true
    },
    show() {
      el.hidden = false
    },
    get flying() {
      return Boolean(flight)
    },
    get hidden() {
      return el.hidden
    },
    vanish() {
      targetScale = 0
      return new Promise(r => setTimeout(r, 260))
    },
    destroy() {
      alive = false
      el.remove()
      bubble.remove()
    },
  }
}
