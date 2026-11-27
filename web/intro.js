// The opening: a graveyard at night. The ground shakes and cracks, dirt flies,
// and Boo rises out of the grave. Then the night lifts and the work begins.
// Click anywhere (or press a key) to skip.

import { pose } from './lib/sprites.js'
import { burst, SPARKLE } from './ghost.js'

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
const DIRT = ['#5b3a24', '#7a5236', '#946a48', '#3e2716']
const PX = 6

function canvas(w, h, draw) {
  const c = document.createElement('canvas')
  c.width = w * PX
  c.height = h * PX
  const g = c.getContext('2d')
  draw((x, y, colour) => ((g.fillStyle = colour), g.fillRect(x * PX, y * PX, PX, PX)))
  return c
}

/** A headstone with a carved cross, 12 x 16 pixels. */
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
        set(x, y, edge ? '#1c1c2b' : x <= 2 ? '#b9bfd4' : x >= W - 3 ? '#6a7089' : '#8f96ad')
      }
    for (let y = 4; y <= 10; y++) set(5, y, '#4d526a'), set(6, y, '#4d526a')
    for (let x = 3; x <= 8; x++) set(x, 6, '#4d526a')
  })
}

/** A dirt mound, w pixels wide, with cracks from 0 to 1. */
function moundArt(w, cracks = 0) {
  const H = 6
  let s = 3
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280)
  return canvas(w, H, set => {
    for (let x = 0; x < w; x++) {
      const t = Math.abs(x - (w - 1) / 2) / (w / 2)
      const top = Math.round(1 + t * t * (H - 2))
      for (let y = top; y < H; y++) set(x, y, y === top ? '#3e2716' : rnd() < 0.18 ? '#946a48' : '#6b4630')
    }
    const reach = Math.round((w / 2) * cracks)
    let y = 3
    for (let i = 0; i < reach; i++) {
      y = Math.max(2, Math.min(H - 1, y + (rnd() < 0.5 ? -1 : 1)))
      set(Math.floor(w / 2) + i, y, '#140b05')
      set(Math.floor(w / 2) - i, Math.max(2, Math.min(H - 1, 7 - y)), '#140b05')
    }
  })
}

const shake = el =>
  el.animate?.([{ transform: 'translateX(0)' }, { transform: 'translateX(-4px)' }, { transform: 'translateX(4px)' }, { transform: 'translateX(-3px)' }, { transform: 'translateX(3px)' }, { transform: 'translateX(0)' }], { duration: 550 })

/**
 * Play the opening. Resolves with where Boo floats at the end (top-left and
 * size), so the real Boo can take over from the drawing in the same spot.
 */
export function playIntro() {
  const scene = document.createElement('div')
  scene.className = 'intro'
  scene.setAttribute('role', 'img')
  scene.setAttribute('aria-label', 'Night in a graveyard. The ground cracks and Boo the ghost rises from a grave.')
  scene.innerHTML = `
    <div class="intro-sky"><i class="moon"></i><i class="fog f1"></i><i class="fog f2"></i></div>
    <div class="intro-title"><h1>Boo</h1><p>Switch software. Lose nothing.</p></div>
    <div class="intro-ground"></div>
    <div class="intro-grave"></div>
    <p class="intro-skip">Click to skip</p>`
  document.body.appendChild(scene)
  // The static night sky in the page held the screen until now.
  document.getElementById('intro-cover')?.remove()
  // A sky full of stars, some twinkling.
  const sky = scene.querySelector('.intro-sky')
  for (let i = 0; i < 90; i++) {
    const star = document.createElement('b')
    star.className = `star${i % 4 === 0 ? ' tw' : ''}`
    Object.assign(star.style, { left: `${Math.random() * 100}%`, top: `${Math.random() * 62}%`, width: `${Math.random() < 0.2 ? 3 : 2}px`, animationDelay: `${(Math.random() * 3).toFixed(2)}s` })
    sky.appendChild(star)
  }

  const grave = scene.querySelector('.intro-grave')
  const tomb = tombArt()
  tomb.className = 'intro-tomb'
  const moundW = 30
  const mound = moundArt(moundW)
  mound.className = 'intro-mound'
  const clip = document.createElement('div')
  clip.className = 'intro-clip'
  const { grid, palette } = pose('happyA')
  const ghost = canvas(16, 16, set => grid.forEach((row, y) => row.forEach((k, x) => k && set(x, y, palette[k]))))
  ghost.className = 'intro-ghost'
  clip.appendChild(ghost)
  const glow = document.createElement('div')
  glow.className = 'intro-glow'
  grave.append(glow, tomb, clip, mound)

  let skipped = false
  const timers = []
  const wait = ms => new Promise(r => timers.push(setTimeout(r, skipped || reduceMotion ? 0 : ms)))

  const where = () => {
    const r = ghost.getBoundingClientRect()
    return { x: r.left, y: r.top, size: r.width }
  }

  async function play() {
    await wait(700)
    shake(mound)
    shake(tomb)
    const g = mound.getContext('2d')
    for (let i = 1; i <= 7; i++) {
      g.clearRect(0, 0, mound.width, mound.height)
      g.drawImage(moundArt(moundW, i / 7), 0, 0)
      await wait(85)
    }
    const m = mound.getBoundingClientRect()
    burst(m.left + m.width / 2, m.top + 6, 60, DIRT, 0.9, 1100)
    scene.classList.add('risen')
    await wait(350)
    burst(m.left + m.width / 2, m.top + 6, 30, DIRT, 0.6, 1100)
    await wait(900)
    const at = where()
    burst(at.x + at.size / 2, at.y + at.size / 2, 26, SPARKLE, 0.45, 220)
    scene.classList.add('titled')
    await wait(1500)
  }

  return new Promise(resolve => {
    const finish = () => {
      if (scene.classList.contains('leaving')) return
      skipped = true
      scene.classList.add('risen', 'titled', 'leaving')
      const at = where()
      setTimeout(() => scene.remove(), reduceMotion ? 0 : 700)
      resolve(at)
    }
    scene.addEventListener('click', finish)
    addEventListener('keydown', finish, { once: true })
    if (reduceMotion || new URLSearchParams(location.search).get('intro') === '0') return finish()
    play().then(finish)
  })
}
