// A small desktop: icons, windows, taskbar and notifications.
// Windows live inside the desktop's own stacking layer, so however often you
// click them they can never rise above the ghosts or the taskbar.

import { icon } from './icons.js'

const $ = id => document.getElementById(id)

export function createDesktop() {
  document.querySelectorAll('[data-icon]').forEach(el => (el.innerHTML = icon(el.dataset.icon, el.classList.contains('app-glyph') ? 13 : 22)))
  const desktop = $('desktop')
  const windows = [...desktop.querySelectorAll('.window')]
  const byName = name => windows.find(w => w.dataset.app === name)
  const running = $('running')
  let z = 1
  const restore = new WeakMap()

  // Keep the layer numbers small: renumber in order whenever one gets big.
  function raise(win) {
    if (z > 500) {
      ;[...windows].sort((a, b) => Number(a.style.zIndex) - Number(b.style.zIndex)).forEach((w, i) => (w.style.zIndex = String(i + 1)))
      z = windows.length
    }
    win.style.zIndex = String(++z)
    renderTaskbar()
  }

  const top = () => windows.filter(w => !w.hidden && !w.classList.contains('minimised')).sort((a, b) => Number(b.style.zIndex) - Number(a.style.zIndex))[0]

  function open(name) {
    const win = byName(name)
    if (!win) return null
    win.hidden = false
    win.classList.remove('minimised')
    raise(win)
    return win
  }
  function close(win) {
    win.hidden = true
    renderTaskbar()
  }
  function minimise(win) {
    win.classList.add('minimised')
    renderTaskbar()
  }
  function maximise(win) {
    if (win.classList.toggle('maximised')) {
      restore.set(win, { left: win.style.left, top: win.style.top })
      win.style.left = '0px'
      win.style.top = '0px'
    } else {
      const r = restore.get(win)
      if (r) Object.assign(win.style, r)
    }
    raise(win)
  }

  function renderTaskbar() {
    const active = top()
    running.innerHTML = ''
    for (const win of windows) {
      if (win.hidden) continue
      const b = document.createElement('button')
      b.type = 'button'
      b.className = `task${win === active ? ' active' : ''}${win.classList.contains('minimised') ? ' min' : ''}`
      b.textContent = win.dataset.app
      b.addEventListener('click', () => {
        if (win === top()) minimise(win)
        else open(win.dataset.app)
      })
      running.appendChild(b)
    }
  }

  // Window controls and dragging.
  for (const win of windows) {
    win.addEventListener('pointerdown', () => raise(win))
    win.querySelector('[data-close]')?.addEventListener('click', e => (e.stopPropagation(), close(win)))
    win.querySelector('[data-min]')?.addEventListener('click', e => (e.stopPropagation(), minimise(win)))
    win.querySelector('[data-max]')?.addEventListener('click', e => (e.stopPropagation(), maximise(win)))
    const bar = win.querySelector('[data-drag]')
    bar.addEventListener('dblclick', e => {
      if (!e.target.closest('button')) maximise(win)
    })
    bar.addEventListener('pointerdown', e => {
      if (e.target.closest('button') || win.classList.contains('maximised') || window.innerWidth <= 900) return
      bar.setPointerCapture(e.pointerId)
      const r = win.getBoundingClientRect()
      const d = desktop.getBoundingClientRect()
      const dx = e.clientX - r.left
      const dy = e.clientY - r.top
      const move = ev => {
        win.style.left = `${Math.max(-r.width + 90, Math.min(d.width - 90, ev.clientX - d.left - dx))}px`
        win.style.top = `${Math.max(0, Math.min(d.height - 36, ev.clientY - d.top - dy))}px`
      }
      const up = () => {
        bar.removeEventListener('pointermove', move)
        bar.removeEventListener('pointerup', up)
      }
      bar.addEventListener('pointermove', move)
      bar.addEventListener('pointerup', up)
    })
  }

  // Desktop icons: click to select, double-click or Enter to open.
  desktop.querySelectorAll('.icon').forEach(icon => {
    icon.addEventListener('click', () => {
      desktop.querySelectorAll('.icon').forEach(i => i.classList.toggle('selected', i === icon))
    })
    icon.addEventListener('dblclick', () => open(icon.dataset.open))
    icon.addEventListener('keydown', e => {
      if (e.key === 'Enter') open(icon.dataset.open)
    })
  })

  // Clock. During the demo day the shop's own clock takes over.
  let held = false
  const tick = () => {
    if (held) return
    const now = new Date()
    $('clock').textContent = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    $('date').textContent = now.toLocaleDateString([], { day: 'numeric', month: 'short' })
  }
  tick()
  setInterval(tick, 30_000)

  /** Lay windows out like someone's working desktop. */
  function arrange() {
    if (window.innerWidth <= 900) return
    const W = desktop.clientWidth
    const place = (name, left, top) => {
      const w = byName(name)
      if (!w.classList.contains('maximised')) Object.assign(w.style, { left: `${left}px`, top: `${top}px` })
    }
    const right = W - 372
    place('Boo', right, 16)
    place('Idle DMs', 104, 24)
    place('Idle Bookings', Math.min(right - 500, 104 + 250), 70)
    place('Idle Back office', Math.min(right - 470, 104 + 120), 300)
    place('ClinicMaster 98', 150, 200)
    place('Graveyard', 220, 120)
  }
  // ?solo=<app> shows just that app, full screen, the way it looks on its own.
  const solo = new URLSearchParams(location.search).get('solo')
  if (solo && byName(solo)) {
    document.body.classList.add('solo')
    for (const w of windows) w.hidden = w.dataset.app !== solo
    const w = byName(solo)
    w.classList.add('maximised')
    Object.assign(w.style, { left: '0px', top: '0px' })
    document.title = `${solo} - Tuesday Grooming`
  } else {
    arrange()
    window.addEventListener('resize', arrange)
    ;['Idle DMs', 'Idle Back office', 'Idle Bookings', 'Boo'].forEach(open)
  }

  // ------------------------------------------------------------- notifications

  const toasts = $('toasts')
  /** Show a notification from an app. Returns its element, or null on small screens. */
  function toast({ app, title, text }) {
    const t = document.createElement('div')
    t.className = 'toast'
    t.innerHTML = `<strong></strong><span></span><small></small>`
    t.querySelector('strong').textContent = title
    t.querySelector('span').textContent = text
    t.querySelector('small').textContent = app
    toasts.prepend(t)
    ;[...toasts.children].slice(4).forEach(old => old.remove())
    return t
  }

  return {
    windows,
    byName,
    open,
    raise,
    /** Windows a ghost can stand on, front to back. */
    standable: () => windows.filter(w => !w.hidden && !w.classList.contains('minimised')).sort((a, b) => Number(b.style.zIndex) - Number(a.style.zIndex)),
    /** Bring a window to the front for work, unless it is minimised by the person. */
    focusFor: win => {
      if (win.hidden || win.classList.contains('minimised')) open(win.dataset.app)
      else raise(win)
    },
    /** Keep only one window open in front: the one that needs attention. */
    focusOn(name) {
      for (const w of windows) if (w.dataset.app !== name && w.dataset.app !== 'Boo') minimise(w)
      open(name)
    },
    toast,
    holdClock(on) {
      held = on
    },
  }
}
