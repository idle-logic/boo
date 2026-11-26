// Graveyard effects: Boo is born from a grave, the new app rises out of the
// ground, and the old app sinks into it and leaves a tombstone.
// Pixel art drawn here in code, in the same chunky style as Boo.

import { pose } from './lib/sprites.js'
import { burst, SPARKLE } from './boo.js'

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
const pause = ms => new Promise(r => setTimeout(r, reduceMotion ? 0 : ms))
export const DIRT = ['#5b3a24', '#7a5236', '#946a48', '#3e2716']
const PX = 4

function canvas(w, h, draw) {
  const c = document.createElement('canvas')
  c.width = w * PX
  c.height = h * PX
  const g = c.getContext('2d')
  draw((x, y, colour) => {
    g.fillStyle = colour
    g.fillRect(x * PX, y * PX, PX, PX)
  })
  return c
}

/** A small headstone with a carved cross, 12 x 16 pixels. */
function tombArt() {
  const W = 12
  const H = 16
  const r = W / 2
  const inside = (x, y) => x >= 0 && x < W && y >= 0 && y < H && (y >= r || (x + 0.5 - r) ** 2 + (y + 0.5 - r) ** 2 <= r * r)
  return canvas(W, H, set => {
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        if (!inside(x, y)) continue
        const edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1)
        set(x, y, edge ? '#2b2b3a' : x <= 2 ? '#c9cede' : x >= W - 3 ? '#7a8098' : '#a2a8bc')
      }
    for (let y = 4; y <= 10; y++) set(5, y, '#5d6278'), set(6, y, '#5d6278')
    for (let x = 3; x <= 8; x++) set(x, 6, '#5d6278')
  })
}

/** A dirt mound, w pixels wide. cracks: 0 to 1. */
function moundArt(w, cracks = 0, seed = 3) {
  const H = 6
  let s = seed
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280)
  return canvas(w, H, set => {
    for (let x = 0; x < w; x++) {
      const t = Math.abs(x - (w - 1) / 2) / (w / 2)
      const top = Math.round(1 + t * t * (H - 2))
      for (let y = top; y < H; y++) set(x, y, y === top ? '#3e2716' : rnd() < 0.18 ? '#946a48' : '#7a5236')
    }
    // Cracks spread out from the middle.
    const reach = Math.round((w / 2) * cracks)
    let y = 3
    for (let i = 0; i < reach; i++) {
      y = Math.max(2, Math.min(H - 1, y + (rnd() < 0.5 ? -1 : 1)))
      set(Math.floor(w / 2) + i, y, '#1b1008')
      set(Math.floor(w / 2) - i, Math.max(2, Math.min(H - 1, 5 - y + 2)), '#1b1008')
    }
  })
}

function place(el, { left, top, z = 99990 }) {
  Object.assign(el.style, { position: 'fixed', left: `${Math.round(left)}px`, top: `${Math.round(top)}px`, zIndex: String(z), pointerEvents: 'none', imageRendering: 'pixelated' })
  document.body.appendChild(el)
  return el
}

function quake(el, ms = 600) {
  if (reduceMotion) return
  el.animate(
    [{ transform: 'translateX(0)' }, { transform: 'translateX(-3px)' }, { transform: 'translateX(3px)' }, { transform: 'translateX(-2px)' }, { transform: 'translateX(2px)' }, { transform: 'translateX(0)' }],
    { duration: ms, iterations: 1 },
  )
}

async function crack(el, w, ms = 700, seed = 3) {
  const steps = 7
  for (let i = 1; i <= steps; i++) {
    const art = moundArt(w, i / steps, seed)
    el.getContext('2d').clearRect(0, 0, el.width, el.height)
    el.getContext('2d').drawImage(art, 0, 0)
    await pause(ms / steps)
  }
}

/**
 * Boo is born: a grave on the desktop floor, the ground cracks, dirt flies and
 * Boo rises out. Resolves with the top-left where Boo now floats.
 */
export async function booIsBorn({ centreX, floor }) {
  const tomb = place(tombArt(), { left: centreX - 92, top: floor - 16 * PX })
  const moundW = 26
  const mound = place(moundArt(moundW), { left: centreX - (moundW * PX) / 2, top: floor - 6 * PX })
  const spriteBox = document.createElement('div')
  Object.assign(spriteBox.style, { width: '64px', height: '120px', overflow: 'hidden' })
  place(spriteBox, { left: centreX - 32, top: floor - 120 - 6, z: 99991 })
  const { grid, palette } = pose('happyA')
  const ghost = canvas(16, 16, set => grid.forEach((row, y) => row.forEach((k, x) => k && set(x, y, palette[k]))))
  Object.assign(ghost.style, { position: 'absolute', left: '0', top: '120px', width: '64px', height: '64px', imageRendering: 'pixelated' })
  spriteBox.appendChild(ghost)
  for (const el of [tomb, mound]) el.animate?.([{ opacity: 0 }, { opacity: 1 }], { duration: reduceMotion ? 0 : 400, fill: 'both' })

  await pause(500)
  quake(mound)
  quake(tomb)
  await crack(mound, moundW)
  burst(centreX, floor - 10, 46, DIRT, 0.75, 1200)
  const rise = ghost.animate([{ top: '120px' }, { top: '40px', offset: 0.8 }, { top: '46px' }], { duration: reduceMotion ? 0 : 1300, easing: 'cubic-bezier(.2,.9,.3,1)', fill: 'forwards' })
  await pause(250)
  burst(centreX, floor - 14, 24, DIRT, 0.55, 1200)
  await (rise.finished ?? pause(1300))
  burst(centreX, floor - 60, 18, SPARKLE, 0.35, 250)
  const at = { x: centreX - 32, y: floor - 120 - 6 + 46 }
  // The real Boo takes over from the drawing; the grave fades a moment later.
  setTimeout(() => spriteBox.remove(), 60)
  setTimeout(() => {
    for (const el of [tomb, mound]) {
      const fade = el.animate?.([{ opacity: 1 }, { opacity: 0 }], { duration: 900, fill: 'forwards' })
      fade ? (fade.onfinish = () => el.remove()) : el.remove()
    }
  }, 3200)
  return at
}

/** Dirt along the ground under a window, for rising and sinking. */
function groundUnder(win) {
  const r = win.getBoundingClientRect()
  const w = Math.max(30, Math.round((r.width * 0.96) / PX))
  const mound = place(moundArt(w, 0, 7), { left: r.left + r.width / 2 - (w * PX) / 2, top: r.bottom - 6 * PX + 4, z: 99989 })
  return { r, w, mound }
}

function dustAlong(r, count = 5) {
  for (let i = 0; i < count; i++) burst(r.left + 20 + Math.random() * (r.width - 40), r.bottom - 6, 10, DIRT, 0.5, 1300)
}

/** The new app climbs out of the ground. */
export async function riseWindow(win) {
  win.hidden = false
  win.classList.remove('minimised')
  const h = win.getBoundingClientRect().height
  const hiddenFrame = { transform: `translateY(${h}px)`, clipPath: `inset(0 0 ${h}px 0)` }
  if (reduceMotion) return
  const { r, w, mound } = groundUnder(win)
  const hold = win.animate([hiddenFrame, hiddenFrame], { duration: 1, fill: 'forwards' })
  mound.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300 })
  await pause(300)
  quake(mound, 700)
  await crack(mound, w, 700, 7)
  dustAlong(r, 7)
  hold.cancel()
  const up = win.animate([hiddenFrame, { transform: 'translateY(0)', clipPath: 'inset(0 0 0 0)' }], { duration: 1900, easing: 'cubic-bezier(.25,.8,.25,1)' })
  const dust = setInterval(() => dustAlong(r, 2), 260)
  await up.finished
  clearInterval(dust)
  burst(r.left + r.width / 2, r.top + 10, 30, SPARKLE, 0.5, 200)
  win.classList.add('risen')
  setTimeout(() => win.classList.remove('risen'), 2400)
  mound.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 800, fill: 'forwards' }).onfinish = () => mound.remove()
}

/** The old app sinks into its grave. A tombstone is left on the desktop. */
export async function sinkWindow(win, { name, years, words, desktop }) {
  const { r, w, mound } = groundUnder(win)
  if (!reduceMotion) {
    mound.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300 })
    await pause(300)
    quake(win, 500)
    await crack(mound, w, 500, 7)
    const h = r.height
    const down = win.animate([{ transform: 'translateY(0)', clipPath: 'inset(0 0 0 0)' }, { transform: `translateY(${h}px)`, clipPath: `inset(0 0 ${h}px 0)` }], { duration: 2600, easing: 'cubic-bezier(.55,.05,.7,.4)', fill: 'forwards' })
    const dust = setInterval(() => dustAlong(r, 2), 220)
    await down.finished
    clearInterval(dust)
    dustAlong(r, 8)
    win.hidden = true
    down.cancel()
  } else win.hidden = true

  // The headstone.
  const d = desktop.getBoundingClientRect()
  const stone = document.createElement('div')
  stone.className = 'tombstone'
  stone.setAttribute('role', 'img')
  stone.setAttribute('aria-label', `Here lies ${name}, ${years}. ${words}`)
  stone.innerHTML = `<span class="rip">RIP</span><strong></strong><span class="years"></span><em></em>`
  stone.querySelector('strong').textContent = name
  stone.querySelector('.years').textContent = years
  stone.querySelector('em').textContent = words
  Object.assign(stone.style, { left: `${Math.round(r.left - d.left + r.width / 2 - 85)}px`, top: `${Math.round(r.bottom - d.top - 150)}px` })
  desktop.appendChild(stone)
  stone.animate?.([{ transform: 'translateY(40px)', clipPath: 'inset(0 0 40px 0)', opacity: 0.4 }, { transform: 'translateY(0)', clipPath: 'inset(0 0 0 0)', opacity: 1 }], { duration: reduceMotion ? 0 : 900, easing: 'ease-out' })
  if (!reduceMotion) mound.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 1600, delay: 600, fill: 'forwards' }).onfinish = () => mound.remove()
  else mound.remove()
  return stone
}
