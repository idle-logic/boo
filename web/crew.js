// Boo's crew. When there is more than one thing to do, Boo splits into small
// worker ghosts. Each takes one job, works it in the apps, then zooms back and
// merges into Boo. Only one ghost works in an app at a time, so they never
// type over each other.

import { createBoo, burst, SPARKLE } from './boo.js'
import { runAgent } from './lib/agent.js'
import { domAdapter } from './adapter.js'

const COLOURS = ['mint', 'peach', 'sky']
const MAX_WORKERS = 3
const pause = ms => new Promise(r => setTimeout(r, ms))

export function createCrew({ desktop, mother, think, context = () => '', onJobDone = () => {}, onChange = () => {} }) {
  const queue = []
  const workers = new Set()
  const busyApps = new Set()
  let colourAt = 0

  const ghostOptions = () => ({
    windows: desktop.standable,
    bounds: () => {
      const d = document.getElementById('desktop').getBoundingClientRect()
      return { x: 0, y: 0, w: d.width, h: d.height }
    },
  })

  /** A small ghost splits off from Boo. */
  function split() {
    const at = mother.box
    const ghost = createBoo({
      ...ghostOptions(),
      colour: COLOURS[colourAt++ % COLOURS.length],
      size: 0.62,
      interactive: false,
      at: { x: at.x, y: at.y },
    })
    const c = mother.centre()
    burst(c.x, c.y, 10, SPARKLE, 0.35, 300)
    mother.gulp()
    return ghost
  }

  /** Fly a ghost to a spot (top-left of its box) and wait until it gets there. */
  async function flyTo(ghost, x, y, timeout = 2500) {
    ghost.handle({ type: 'goto', x, y })
    const start = performance.now()
    while (performance.now() - start < timeout) {
      const b = ghost.box
      if (Math.hypot(b.x - x, b.y - y) < 8) return
      await pause(50)
    }
  }

  /** Zoop back into Boo and disappear. */
  async function merge(ghost) {
    const m = mother.box
    await flyTo(ghost, m.x, m.y, 3000)
    const c = mother.centre()
    burst(c.x, c.y, 12, SPARKLE, 0.3, 200)
    await ghost.vanish()
    ghost.destroy()
    mother.gulp()
  }

  /** A worker catches a notification before it bothers anyone. */
  async function catchToast(toastEl) {
    if (!toastEl) return
    const ghost = split()
    workers.add(ghost)
    onChange()
    const r = toastEl.getBoundingClientRect()
    await flyTo(ghost, r.left + r.width / 2 - 32, r.top + r.height / 2 - 40, 2200)
    toastEl.classList.add('caught')
    setTimeout(() => toastEl.remove(), 450)
    await pause(250)
    await merge(ghost)
    workers.delete(ghost)
    onChange()
  }

  /**
   * Add a job. job: { title, goal, apps: ['Messages', ...], kind, hint? }
   * Resolves with the agent's result when the job is done.
   */
  function add(job) {
    return new Promise(resolve => {
      queue.push({ ...job, resolve, queuedAt: performance.now() })
      onChange()
      pump()
    })
  }

  function pump() {
    for (const job of [...queue]) {
      if (workers.size >= MAX_WORKERS) return
      if (job.apps.some(a => busyApps.has(a))) continue
      queue.splice(queue.indexOf(job), 1)
      start(job)
    }
  }

  async function start(job) {
    job.apps.forEach(a => busyApps.add(a))
    const ghost = split()
    ghost.job = job
    workers.add(ghost)
    onChange()
    const hands = domAdapter({
      // Like a person, a ghost opens the apps it needs if they are minimised or closed.
      windows: () =>
        desktop.windows.filter(w => {
          if (!job.apps.includes(w.dataset.app)) return false
          if (w.hidden || w.classList.contains('minimised')) desktop.open(w.dataset.app)
          return true
        }),
      beforeAct: async el => {
        desktop.focusFor(el.closest('.window'))
        el.scrollIntoView({ block: 'nearest', inline: 'nearest' })
        const r = el.getBoundingClientRect()
        ghost.handle({ type: 'guide', x: r.left, y: r.top, h: r.height, text: '' })
        await pause(420)
      },
    })
    let result
    try {
      result = await runAgent({
        goal: [context(), job.goal, job.hint ? `You have done this kind of job before. What worked last time:\n${job.hint}` : '']
          .filter(Boolean)
          .join('\n\n'),
        adapter: hands,
        think,
        approve: async () => true, // routine work; real decisions go to "Needs you" before a job starts
        onStep: s => job.onStep?.(s),
      })
    } catch (err) {
      result = { ok: false, summary: err?.message ?? 'Something went wrong.', history: [] }
    }
    job.apps.forEach(a => busyApps.delete(a))
    ghost.handle({ type: 'release' })
    onJobDone(job, result)
    job.resolve(result)
    pump()
    await merge(ghost)
    workers.delete(ghost)
    onChange()
  }

  return {
    add,
    catchToast,
    /** A ghost for special work (exploring, proving). Merge it back when done. */
    split,
    flyTo,
    merge,
    get working() {
      return [...workers].filter(g => g.job).map(g => g.job)
    },
    get queued() {
      return queue.length
    },
    get idle() {
      return workers.size === 0 && queue.length === 0
    },
  }
}
