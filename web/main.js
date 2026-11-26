// Haunt in the browser: Slotly on the left, Idle on the right, Haunt in the
// side panel. Press Start and watch the switch happen.

import { BUSINESS, SERVICES, STAFF, POLICIES, makeClients, makeBookings } from './data.js'
import { createSlotly } from './slotly.js'
import { createIdleStore, mountIdle } from './idle.js'
import { createHands } from './hands.js'
import { runSwitch } from './switch.js'

const $ = id => document.getElementById(id)
const params = new URLSearchParams(location.search)
const speed = Number(params.get('speed')) || 1 // ?speed=0.3 for a quick check

const clients = makeClients()
const old = { business: BUSINESS, clients, services: SERVICES.map(s => ({ ...s })), staff: STAFF, policies: POLICIES, bookings: makeBookings(clients) }
createSlotly($('slotly'), old)

const store = createIdleStore(BUSINESS)
const AGENTS = {
  setup: ['Setup agent', '#7c5cff'],
  people: ['Clients agent', '#0f9d6b'],
  books: ['Bookings agent', '#e0731f'],
  proof: ['Proof agent', '#2563eb'],
}
const views = {}
for (const [lane, [name, colour]] of Object.entries(AGENTS)) {
  const el = document.createElement('div')
  el.className = 'idle-view'
  el.dataset.view = lane
  $('idle-views').appendChild(el)
  const view = mountIdle(el, store, { page: lane === 'proof' ? 'home' : 'home' })
  views[lane] = { el, view, hands: createHands(el, { name, colour }) }
}
const reader = createHands($('slotly'), { name: 'Haunt', colour: '#7c5cff' })

// ------------------------------------------------------------- the side panel

function watch(lane) {
  for (const [id, v] of Object.entries(views)) v.el.classList.toggle('on', id === lane)
  document.querySelectorAll('[data-watch]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.watch === lane)))
  const [name, colour] = AGENTS[lane]
  $('watching').innerHTML = `<span style="--c:${colour}"></span>Watching ${name}`
}
document.querySelectorAll('[data-watch]').forEach(b => b.addEventListener('click', () => watch(b.dataset.watch)))
watch('people')

const feedLines = []
const ui = {
  phase(name, state, detail = '') {
    const li = document.querySelector(`[data-step="${name}"]`)
    li.dataset.state = state
    li.querySelector('small').textContent = detail
    if (name === 'plan' && state === 'now') $('plan').hidden = false
    if (name === 'move' && state === 'now') {
      $('lanes').hidden = false
      $('plan').hidden = true
    }
    if (name === 'prove' && state === 'now') {
      $('proof').hidden = false
      $('lanes').hidden = true
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
    if (dd.textContent !== String(n)) {
      dd.textContent = n
      dd.parentElement.classList.remove('bump')
      void dd.offsetWidth
      dd.parentElement.classList.add('bump')
    }
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
    return new Promise(resolve => {
      for (const c of choices) {
        const b = document.createElement('button')
        b.type = 'button'
        b.className = `h-btn${c.primary ? ' primary' : ''}`
        b.textContent = c.label
        b.addEventListener('click', () => {
          box.hidden = true
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
  watch,
  done(s) {
    clearInterval(ticking)
    const money = n => `$${n.toLocaleString('en', { minimumFractionDigits: 0 })}`
    $('receipt').hidden = false
    $('receipt').innerHTML = `
      <p class="h-eyebrow">Switch complete in ${Math.floor(s.seconds / 60)}:${String(s.seconds % 60).padStart(2, '0')}</p>
      <h2>Maple &amp; Mint now runs on Idle.</h2>
      <ul>
        <li><b>${s.clients}</b> clients, with ${s.alerts} health alerts and ${money(s.credit)} store credit</li>
        <li><b>${s.packages}</b> prepaid packages worth ${money(s.prepaid)}, sessions left intact</li>
        <li><b>${s.services}</b> services and <b>${s.team}</b> team members${s.merged ? ' (one duplicate merged)' : ''}</li>
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
    })
  },
}

// ------------------------------------------------------------- start

let ticking = null
async function start() {
  $('start').disabled = true
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
    window.__haunt.error = err.message
  }
}
$('start').addEventListener('click', start)
$('haunt-toggle').addEventListener('click', () => {
  const open = $('haunt').hidden
  $('haunt').hidden = !open
  $('haunt-toggle').setAttribute('aria-pressed', String(open))
})

window.__haunt = { store, old, views, ui, feed: feedLines, start }
