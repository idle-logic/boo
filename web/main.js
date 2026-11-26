// Haunt in the browser: Slotly on the left, Idle on the right, Haunt in the
// side panel. Boo reads the old app, splits into a crew of ghosts to move
// everything into Idle, then they prove nothing was lost and merge back.

import { BUSINESS, SERVICES, STAFF, POLICIES, PRODUCTS, REPORT, makeClients, makeBookings } from './data.js'
import { createSlotly } from './slotly.js'
import { createIdleStore, mountIdle } from './idle.js'
import { createHands } from './hands.js'
import { createGhost, burst, SPARKLE, CONFETTI } from './ghost.js'
import { runSwitch } from './switch.js'

const $ = id => document.getElementById(id)
const pause = ms => new Promise(r => setTimeout(r, ms))
const params = new URLSearchParams(location.search)
const speed = Number(params.get('speed')) || 1 // ?speed=0.3 for a quick look

const clients = makeClients()
const old = { business: BUSINESS, clients, services: SERVICES.map(s => ({ ...s })), products: PRODUCTS, staff: STAFF, policies: POLICIES, bookings: makeBookings(clients), report: REPORT }
createSlotly($('slotly'), old)
const store = createIdleStore(BUSINESS)

// ------------------------------------------------------------- Boo and the crew

const rect = el => el.getBoundingClientRect()
const startSpot = () => {
  const r = rect($('boo-spot'))
  return { x: r.left + r.width / 2 - 44, y: r.top + 58 }
}
const homeSpot = () => {
  const r = rect($('boo-home'))
  return { x: r.left - 4, y: r.top - 8 }
}

const boo = createGhost({ size: 88, at: startSpot(), title: 'Boo, the Haunt ghost' })
boo.say("Hi, I'm Boo! I can move your whole salon into Idle.", 6000)
addEventListener('resize', () => {
  if (!$('start-card').hidden) boo.place(startSpot().x, startSpot().y)
})

async function goHome(text, mode = 'idle') {
  const h = homeSpot()
  boo.mode(mode)
  await boo.flyTo(h.x, h.y, 600, { size: 34 })
  if (text) boo.say(text, 3000)
}

const AGENTS = {
  setup: { name: 'Setup ghost', colour: 'sky', css: '#5b8def' },
  people: { name: 'Clients ghost', colour: 'mint', css: '#22a06b' },
  books: { name: 'Bookings ghost', colour: 'peach', css: '#e8784a' },
  proof: { name: 'Proof ghost', colour: 'sky', css: '#5b8def' },
}
const views = {}
for (const [lane, a] of Object.entries(AGENTS)) {
  const el = document.createElement('div')
  el.className = 'idle-view'
  el.dataset.view = lane
  $('idle-views').appendChild(el)
  const view = mountIdle(el, store, { page: 'home' })
  const ghost = createGhost({ colour: a.colour, size: 40, label: a.name.split(' ')[0], title: a.name })
  ghost.hide()
  const slot = () => document.querySelector(`.h-lane[data-lane="${lane}"] .ghost-slot`)
  const hands = createHands(el, {
    name: a.name,
    ghost,
    // When you are watching another agent, this one works from its row in the panel.
    away: () => park(lane),
    onHide: () => mergeIntoBoo(ghost),
  })
  views[lane] = { el, view, hands, ghost, slot }
}

// Parked workers stay in their rows as the panel moves and scrolls.
setInterval(() => {
  for (const v of Object.values(views)) {
    if (v.ghost.hidden || v.ghost.flying || v.el.classList.contains('on') || Math.abs(v.ghost.box.size - 28) > 1) continue
    const s = v.slot()
    if (!s || !s.offsetParent) continue
    const r = rect(s)
    v.ghost.place(r.left - 2, r.top - 4)
  }
}, 100)

/** A worker you are not watching works from its row in the panel. */
function park(lane) {
  const { ghost, slot } = views[lane]
  const s = slot()
  if (!s || !s.offsetParent) return
  const r = rect(s)
  const far = Math.hypot(ghost.box.x - (r.left - 2), ghost.box.y - (r.top - 4)) > 24
  ghost.show()
  ghost.mode('work')
  // Fly over the first time, then just keep it in its row (the panel may scroll).
  if (far && !ghost.flying) return ghost.flyTo(r.left - 2, r.top - 4, 450, { size: 28 })
  if (!ghost.flying) ghost.place(r.left - 2, r.top - 4)
}

/** A worker zooms back into Boo with a sparkle. */
async function mergeIntoBoo(ghost) {
  if (ghost.hidden) return
  const b = boo.box
  ghost.mode('happy')
  await ghost.flyTo(b.x + 4, b.y, 650, { size: 22, arc: 30 })
  const c = boo.centre()
  burst(c.x, c.y, 14, SPARKLE, 0.35, 200)
  await ghost.vanish()
  ghost.hide()
  boo.poke()
}

/** Boo splits: each worker pops out of Boo. */
async function split(lanes) {
  boo.react('happy', 'Splitting up! We go faster as a crew.', 2600)
  for (const lane of lanes) {
    const g = views[lane].ghost
    const b = boo.box
    g.appear(b.x, b.y)
    g.mode('work')
    const c = boo.centre()
    burst(c.x, c.y, 10, SPARKLE, 0.35, 250)
    boo.poke()
    await pause(160)
    // Off to work: into Idle if you are watching it, otherwise to its row in the panel.
    if (views[lane].el.classList.contains('on')) {
      const r = rect($('idle-views'))
      g.flyTo(r.left + r.width / 2 - 20, r.top + 60, 600)
    } else park(lane)
  }
}

const reader = createHands($('slotly'), { name: 'Boo', ghost: boo, onHide: () => goHome() })
boo.workSize = 44

// ------------------------------------------------------------- the side panel

function watch(lane) {
  for (const [id, v] of Object.entries(views)) {
    v.el.classList.toggle('on', id === lane)
  }
  document.querySelectorAll('[data-watch]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.watch === lane)))
  const a = AGENTS[lane]
  $('watching').innerHTML = `<span style="--c:${a.css}"></span>Watching the ${a.name}`
}
document.querySelectorAll('[data-watch]').forEach(b => b.addEventListener('click', () => watch(b.dataset.watch)))
watch('people')

const feedLines = []
const ui = {
  phase(name, state, detail = '') {
    const li = document.querySelector(`[data-step="${name}"]`)
    li.dataset.state = state
    li.querySelector('small').textContent = detail
    if (name === 'plan' && state === 'now') {
      $('plan').hidden = false
      boo.mode('look')
      boo.say('Thinking about where everything goes...', 2400)
    }
    if (name === 'move' && state === 'now') {
      $('lanes').hidden = false
      $('plan').hidden = true
      split(['setup', 'people', 'books'])
    }
    if (name === 'prove' && state === 'now' && detail.startsWith('Same')) {
      $('proof').hidden = false
      $('lanes').hidden = true
      split(['proof'])
      boo.say("Now let's prove nothing was lost.", 2600)
    }
  },
  feed(text, kind = '') {
    const li = document.createElement('li')
    li.textContent = text
    if (kind) li.className = kind
    $('feed').prepend(li)
    feedLines.push(text)
    ;[...$('feed').children].slice(6).forEach(x => x.remove())
  },
  count(key, n) {
    const dd = document.querySelector(`[data-count="${key}"] dd`)
    if (!dd || dd.textContent === String(n)) return
    dd.textContent = n
    dd.parentElement.classList.remove('bump')
    void dd.offsetWidth
    dd.parentElement.classList.add('bump')
  },
  planItems(items) {
    $('plan').innerHTML = items.map(t => `<li>${t.replace(/[<>&]/g, '')}</li>`).join('')
  },
  question({ title, detail, choices }) {
    const box = $('question')
    box.hidden = false
    box.innerHTML = `<p class="h-eyebrow">Needs you</p><h2></h2><p></p><div class="row"></div>`
    box.querySelector('h2').textContent = title
    box.querySelector('p:not(.h-eyebrow)').textContent = detail
    box.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    // Boo comes over and knocks.
    setTimeout(() => {
      const r = rect(box)
      boo.mode('alert')
      boo.flyTo(r.right - 48, r.top - 30, 600, { size: 40 }).then(() => boo.say('Quick question!', 2600))
    }, 400)
    return new Promise(resolve => {
      for (const c of choices) {
        const b = document.createElement('button')
        b.type = 'button'
        b.className = `h-btn${c.primary ? ' primary' : ''}`
        b.textContent = c.label
        b.addEventListener('click', () => {
          box.hidden = true
          boo.react('happy', 'Thank you!', 1600)
          goHome()
          resolve(c.value)
        })
        box.querySelector('.row').appendChild(b)
      }
    })
  },
  lane(id, done, total, note = '') {
    const row = document.querySelector(`.h-lane[data-lane="${id}"]`)
    row.querySelector('.bar i').style.width = `${total ? (done / total) * 100 : 0}%`
    row.querySelector('em').textContent = note || `${done} of ${total}`
    row.classList.toggle('waiting', Boolean(note))
    row.classList.toggle('done', done === total && !note)
  },
  proof(matched, checks, diff) {
    $('proof-num').textContent = matched
    $('proof-of').textContent = `of ${checks} checks match`
    $('proof-bar').style.width = `${checks ? (matched / checks) * 100 : 0}%`
    $('proof').classList.toggle('bad', matched < checks)
    if (diff) {
      $('proof-diff').hidden = false
      $('proof-diff').textContent = diff
    } else if (matched === checks) $('proof-diff').hidden = true
  },
  boo(what, text) {
    boo.react({ mismatch: 'scared', found: 'look', fixed: 'happy' }[what] ?? 'idle', text, 3000)
  },
  watch,
  async done(s) {
    clearInterval(ticking)
    const money = n => `$${n.toLocaleString('en')}`
    $('receipt').hidden = false
    $('receipt').innerHTML = `
      <p class="h-eyebrow">Switch complete in ${Math.floor(s.seconds / 60)}:${String(s.seconds % 60).padStart(2, '0')}</p>
      <h2>Maple &amp; Mint now runs on Idle.</h2>
      <ul>
        <li><b>${s.clients}</b> clients with their visit history, ${s.alerts} health alerts and ${money(s.credit)} store credit</li>
        <li><b>${s.packages}</b> prepaid packages worth ${money(s.prepaid)}, sessions left intact</li>
        <li><b>${s.services}</b> services, <b>${s.products}</b> products and <b>${s.team}</b> team members${s.merged ? ' (one duplicate merged)' : ''}</li>
        <li><b>${s.bookings}</b> upcoming bookings and <b>4</b> cancellation rules</li>
      </ul>
      <p class="h-check"><b>${s.matched} of ${s.checks}</b> checks match.${s.fixed ? ` ${s.fixed} differences found and fixed on the way.` : ''} Slotly was never changed.</p>
      <button type="button" class="h-btn primary" id="open-idle">Open Idle</button>`
    $('receipt').scrollIntoView({ block: 'start', behavior: 'smooth' })
    $('open-idle').addEventListener('click', () => {
      $('pane-slotly').hidden = true
      $('tab-slotly').classList.remove('on')
      views.proof.view.state.page = 'home'
      views.proof.view.render()
      watch('proof')
      $('watching').textContent = ''
      boo.react('happy', 'Welcome home!', 2000)
    })
    // Everyone back together, and a little party.
    await pause(700)
    const r = rect($('receipt'))
    boo.mode('happy')
    await boo.flyTo(r.right - 70, r.top - 40, 700, { size: 56 })
    const c = boo.centre()
    burst(c.x, c.y, 80, CONFETTI, 1, 700)
    boo.say('All moved. Nothing lost!', 5000)
  },
}

// ------------------------------------------------------------- start

let ticking = null
async function start() {
  $('start').disabled = true
  boo.react('happy', "Let's go!", 1200)
  await pause(500)
  $('start-card').hidden = true
  $('steps').hidden = false
  $('counts').hidden = false
  $('clock').hidden = false
  const t0 = performance.now()
  ticking = setInterval(() => {
    const s = Math.round((performance.now() - t0) / 1000)
    $('clock').textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
  }, 500)
  // Idle opens beside Slotly, in split view.
  $('tab-idle').hidden = false
  $('tab-idle').classList.add('on')
  $('pane-idle').hidden = false
  $('viewport').classList.add('split')
  ui.feed('Opened Idle beside Slotly.')
  try {
    window.__haunt.result = await runSwitch({ oldHands: reader, idleLanes: [views.setup, views.people, views.books], proofHands: views.proof.hands, store, ui, speed })
  } catch (err) {
    clearInterval(ticking)
    ui.feed(`Stopped: ${err.message}`, 'warn')
    boo.react('scared', 'Oh no, I got stuck.', 4000)
    window.__haunt.error = err.message
  }
}
$('start').addEventListener('click', start)
$('haunt-toggle').addEventListener('click', () => {
  const open = $('haunt').hidden
  $('haunt').hidden = !open
  $('haunt-toggle').setAttribute('aria-pressed', String(open))
})

window.__haunt = { store, old, views, ui, feed: feedLines, start, boo }
