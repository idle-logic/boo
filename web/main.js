// Haunt in the browser. Act one: Boo looks around Slotly, finds what the team
// does by hand, and runs those workarounds for them inside Slotly. Act two:
// when they are ready, Boo switches them to Idle with nothing lost.

import { BUSINESS, slotlyRecords } from './data.js'
import { createSlotly } from './slotly.js'
import { createIdleStore, mountIdle } from './idle.js'
import { createHands } from './hands.js'
import { createGhost, burst, SPARKLE, CONFETTI } from './ghost.js'
import { playIntro } from './intro.js'
import { survey } from './survey.js'
import { readOldApp, readWithRules, findingsFor, cleanName } from './interpret.js'
import { FEATURES, createFeatures } from './features.js'
import { idleRecords, move, prove } from './switch.js'
import { askBoo } from './ai.js'

const $ = id => document.getElementById(id)
const pause = ms => new Promise(r => setTimeout(r, ms))
const params = new URLSearchParams(location.search)
const speed = Number(params.get('speed')) || 1
const esc = t => String(t ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])

const old = { business: BUSINESS, ...slotlyRecords() }
let features = null
const slotly = createSlotly($('slotly'), old, { booked: a => features?.booked(a) })
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
boo.hide()
playIntro().then(async at => {
  boo.place(at.x, at.y)
  boo.show()
  boo.mode('happy')
  await boo.flyTo(startSpot().x, startSpot().y, 900, { size: 88, arc: 60 })
  boo.mode('idle')
  boo.say("Hi, I'm Boo! Let me have a look around.", 6000)
})
async function goHome(text) {
  const h = homeSpot()
  boo.mode('idle')
  await boo.flyTo(h.x, h.y, 600, { size: 34 })
  if (text) boo.say(text, 3000)
}
const reader = createHands($('slotly'), { name: 'Boo', ghost: boo, onHide: () => goHome() })
boo.workSize = 44

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
  views[lane] = { el, view, ghost, key: null }
  views[lane].hands = createHands(el, { name: a.name, ghost, away: () => park(lane), onHide: () => mergeIntoBoo(ghost) })
}
// A ghost you are not watching works from the row of the thing it is moving.
const slotFor = lane => document.querySelector(`#moving [data-key="${views[lane].key}"] .ghost-slot`)
function park(lane) {
  const { ghost } = views[lane]
  const s = slotFor(lane)
  if (!s || !s.offsetParent) return
  const r = rect(s)
  ghost.show()
  ghost.mode('work')
  const far = Math.hypot(ghost.box.x - (r.left - 2), ghost.box.y - (r.top - 4)) > 24
  if (far && !ghost.flying) return ghost.flyTo(r.left - 2, r.top - 4, 450, { size: 28 })
  if (!ghost.flying) ghost.place(r.left - 2, r.top - 4)
}
setInterval(() => {
  for (const [lane, v] of Object.entries(views)) if (!v.ghost.hidden && !v.ghost.flying && !v.el.classList.contains('on') && Math.abs(v.ghost.box.size - 28) < 1) park(lane)
}, 100)
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
async function split(lanes) {
  boo.react('happy', 'Splitting up. We go faster as a crew.', 2600)
  for (const lane of lanes) {
    const g = views[lane].ghost
    const b = boo.box
    g.appear(b.x, b.y)
    g.mode('work')
    burst(boo.centre().x, boo.centre().y, 10, SPARKLE, 0.35, 250)
    boo.poke()
    await pause(160)
    if (views[lane].el.classList.contains('on')) {
      const r = rect($('idle-views'))
      g.flyTo(r.left + r.width / 2 - 20, r.top + 60, 600)
    } else park(lane)
  }
}
function watch(lane) {
  for (const [id, v] of Object.entries(views)) v.el.classList.toggle('on', id === lane)
  document.querySelectorAll('[data-watch]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.watch === lane)))
  const a = AGENTS[lane]
  $('watching').innerHTML = `<span style="--c:${a.css}"></span>${a.name}`
}
document.querySelectorAll('[data-watch]').forEach(b => b.addEventListener('click', () => watch(b.dataset.watch)))
watch('people')

// ------------------------------------------------------------- the panel: one calm thing at a time

const feedLines = []
const show = id => {
  for (const x of ['found', 'live', 'confirm', 'moving', 'proof', 'receipt']) $(x).hidden = x !== id
  $(id).scrollIntoView?.({ block: 'nearest', behavior: 'smooth' })
}
const gem = (on, model) => (on ? `<span class="gem" title="${esc(model || 'Gemini')}">✦ Gemini</span>` : '')
const ui = {
  now(title, sub = '') {
    $('now').hidden = false
    $('now-title').textContent = title
    $('now-sub').textContent = sub
  },
  log(text, kind = '') {
    const li = document.createElement('li')
    li.textContent = text
    if (kind) li.className = kind
    $('feed').prepend(li)
    feedLines.push(text)
  },
  ask({ title, detail, choices }) {
    const box = $('question')
    box.hidden = false
    box.innerHTML = `<p class="h-eyebrow">Boo needs you</p><h2>${esc(title)}</h2><p>${esc(detail)}</p><div class="row">${choices.map(([v, label], i) => `<button type="button" class="h-btn${i ? '' : ' primary'}" data-v="${i}">${esc(label)}</button>`).join('')}</div>`
    box.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    const r = rect(box)
    boo.mode('alert')
    boo.flyTo(r.right - 48, r.top - 30, 600, { size: 40 }).then(() => boo.say('Wait! Look at this.', 2400))
    return new Promise(resolve => {
      box.querySelectorAll('[data-v]').forEach(b =>
        b.addEventListener('click', () => {
          box.hidden = true
          boo.react('happy', 'Thank you!', 1500)
          resolve(choices[Number(b.dataset.v)][0])
        }),
      )
    })
  },
  feature(key, text) {
    const row = document.querySelector(`#live [data-feature="${key}"]`)
    if (!row) return
    row.classList.add('fired')
    row.querySelector('em').textContent = String(Number(row.querySelector('em').textContent || 0) + 1)
    row.querySelector('small').textContent = text
    ui.log(text)
  },
  refreshOld: () => slotly.render(),
  working(lane, key) {
    views[lane].key = key
  },
  progress(key, done, total) {
    const row = document.querySelector(`#moving [data-key="${key}"]`)
    if (!row) return
    row.querySelector('.bar i').style.width = `${total ? (done / total) * 100 : 100}%`
    row.querySelector('em').textContent = `${done} of ${total}`
    row.classList.toggle('done', done === total)
  },
  proof(matched, checks, diff) {
    $('proof-num').textContent = matched
    $('proof-of').textContent = `of ${checks} checks match`
    $('proof-bar').style.width = `${checks ? (matched / checks) * 100 : 0}%`
    $('proof').classList.toggle('bad', matched < checks)
    $('proof-diff').hidden = !diff
    if (diff) $('proof-diff').textContent = diff
  },
}

// ------------------------------------------------------------- act one: look around, then haunt it

let seen = null
let read = null
let findings = null

async function lookAround() {
  $('start').disabled = true
  boo.react('happy', "Let's see what's in here.", 1400)
  await pause(400)
  $('start-card').hidden = true
  seen = await survey({ r: reader, ui, speed, business: BUSINESS })
  ui.now('Gemini is reading the notes, names and descriptions', `${seen.customers.length} customers, ${seen.services.length} services, ${seen.appointments.length} appointments`)
  boo.mode('look')
  boo.say('Reading between the lines...', 3000)
  read = await readOldApp(seen)
  findings = findingsFor(seen, read)
  ui.log(read.by === 'ai' ? `Gemini (${read.model}) read the records. ${read.aiCount} of its answers matched the original text and were used.` : 'Gemini was busy, so plain rules read the records.')
  showFindings()
}

function showFindings() {
  const by = read.by === 'ai'
  const hand = findings.filter(f => !['stays', 'breaks', 'phones'].includes(f.key))
  ui.now(`Boo found ${hand.length} things your team does by hand`, 'Because Slotly cannot do them')
  $('found').innerHTML = `<h2>What your team works around ${gem(by, read.model)}</h2>
    <ul class="h-finds">${hand.map(f => `<li><b>${esc(f.title)}</b><span class="n">${f.count}</span><code>${esc(f.from[0])}</code></li>`).join('')}</ul>
    <h3>Boo can do these for you in Slotly, from today</h3>
    <ul class="h-feats">${FEATURES.filter(x => findings.some(f => f.key === x.from)).map(x => `<li><label><input type="checkbox" value="${x.key}" checked /> <b>${esc(x.name)}</b><small>${esc(x.what)}</small></label></li>`).join('')}</ul>
    <button type="button" class="h-btn primary" id="haunt-it">Turn them on</button>`
  show('found')
  goHome(`I found ${hand.length} workarounds.`)
  $('haunt-it').addEventListener('click', hauntIt)
}

async function hauntIt() {
  const enabled = new Set([...$('found').querySelectorAll('input:checked')].map(i => i.value))
  features = createFeatures({ r: reader, boo, read, data: old, ui, enabled })
  $('live').innerHTML = `<h2>Running inside Slotly</h2>
    <ul class="h-live">${FEATURES.filter(x => enabled.has(x.key)).map(x => `<li data-feature="${x.key}"><b>${esc(x.name)}</b><em></em><small>Waiting for a booking</small></li>`).join('')}</ul>
    <button type="button" class="h-btn primary" id="morning">Watch a busy morning at the front desk</button>
    <button type="button" class="h-btn" id="to-idle" hidden>Ready to leave Slotly? Switch to Idle</button>`
  show('live')
  ui.now('Boo is on watch', 'Book something in Slotly, or watch a busy morning')
  boo.react('happy', "I'm on it.", 1800)
  $('morning').addEventListener('click', busyMorning)
  $('to-idle').addEventListener('click', confirmSwitch)
}

/** Three bookings at the front desk, made the normal way. Boo jumps in where it helps. */
async function busyMorning() {
  $('morning').disabled = true
  const desk = createHands($('slotly'), { name: 'Front desk', colour: '#475569', pace: { move: 420, type: 30 } })
  const rawName = c => seen.customers[c.src].name
  const allergic = read.clients.find(c => /PPD/i.test(c.alert))
  const pkg = read.clients.find(c => c.packages.some(p => /blow/i.test(p.name)))
  const vip = read.clients.find(c => c.vip && !c.alert && c !== pkg)
  const plan = [
    allergic && { customer: rawName(allergic), service: 'Root colour', staff: 'Jasmine Koh', date: '2026-12-03', time: '14:00' },
    pkg && { customer: rawName(pkg), service: 'Blow-dry', staff: 'Hana Lim', date: '2026-12-03', time: '11:00' },
    vip && { customer: rawName(vip), service: 'Balayage', staff: 'Hana Lim', date: '2026-12-04', time: '10:00' },
  ].filter(Boolean)
  for (const b of plan) {
    ui.now('The front desk is booking', `${cleanName(b.customer)}, ${b.service}`)
    await desk.press('[data-new]')
    await desk.fill({ Customer: b.customer, Service: b.service, Staff: b.staff, Date: b.date, Time: b.time })
    await desk.submit()
    desk.hide()
    await pause(400)
    await features.idle
    await pause(900)
  }
  desk.remove()
  const s = features.stats
  ui.now('A quiet morning for the front desk', `Boo did ${s.steps} steps for them${s.caught ? ` and caught ${s.caught} allergy before it became a problem` : ''}.`)
  goHome('That was easy.')
  $('morning').hidden = true
  $('to-idle').hidden = false
}

// ------------------------------------------------------------- act two: switch to Idle

function confirmSwitch() {
  // Boo saw and did everything since it looked around, so it reads Slotly's diary as it is now.
  seen.appointments = old.appointments.map(a => ({ ...a }))
  Object.assign(read, (({ bookings, cleanups, breaks }) => ({ bookings, cleanups, breaks }))(readWithRules(seen)))
  findings = findingsFor(seen, read)
  ui.now('Before anything moves: is this right?', 'Each one shows what Slotly had, and what it becomes in Idle')
  $('confirm').innerHTML = `<h2>How your workarounds become Idle's standard way ${gem(read.by === 'ai', read.model)}</h2>
    <ol class="h-map">${findings
      .map(
        (f, i) => `<li data-i="${i}"><b>${esc(f.title)}</b><span class="n">${f.count}</span>${f.sub ? `<small>${esc(f.sub)}</small>` : ''}
        <div class="map"><code>${f.from.map(esc).join('<br>')}</code><span class="arrow" aria-hidden="true">→</span><code class="to">${f.to.map(esc).join('<br>')}</code></div>
        <div class="choices">${f.choices.map(([, label], k) => `<button type="button" data-c="${k}" aria-pressed="${k === 0}">${esc(label)}</button>`).join('')}</div></li>`,
      )
      .join('')}</ol>
    <button type="button" class="h-btn primary" id="go">That's right. Start the move</button>`
  $('confirm').querySelectorAll('[data-i]').forEach(li =>
    li.querySelectorAll('[data-c]').forEach(b =>
      b.addEventListener('click', () => {
        const f = findings[Number(li.dataset.i)]
        f.value = f.choices[Number(b.dataset.c)][0]
        li.querySelectorAll('[data-c]').forEach(x => x.setAttribute('aria-pressed', String(x === b)))
      }),
    ),
  )
  show('confirm')
  $('go').addEventListener('click', switchToIdle)
}

async function switchToIdle() {
  const d = Object.fromEntries(findings.map(f => [f.key, f.value]))
  const records = idleRecords(read, d)
  $('tab-idle').hidden = false
  $('tab-idle').classList.add('on')
  $('pane-idle').hidden = false
  $('watch-pick').hidden = false
  $('viewport').classList.add('split')
  const rows = [
    ['terms', 'Cancellation rules', records.policies ? 1 : 0],
    ['services', 'Services', records.services.length],
    ['retail', 'Products', records.products.length],
    ['merge', 'Team', records.staff.length],
    ['clients', 'Clients', records.clients.length],
    ['packages', 'Packages', records.packages.length],
    ['bookings', 'Bookings', records.bookings.length],
  ].filter(r => r[2])
  $('moving').innerHTML = `<h2>Moving into Idle</h2><ul class="h-move">${rows.map(([k, label, n]) => `<li data-key="${k}"><span class="ghost-slot"></span><b>${label}</b><em>0 of ${n}</em><div class="bar"><i></i></div></li>`).join('')}</ul>`
  show('moving')
  ui.now('Three ghosts are moving everything', 'Click Setup, Clients or Bookings above Idle to watch one')
  await split(['setup', 'people', 'books'])
  await move({ records, lanes: [views.setup, views.people, views.books], store, ui, speed })
  show('proof')
  watch('proof')
  await split(['proof'])
  const result = await prove({ seen, read, records, d, p: views.proof.hands, ui, speed })
  done(result, d)
}

function done(result, d) {
  ui.now('Maple & Mint now runs on Idle', `${result.matched} of ${result.checks} checks match`)
  const salesFile = d.stays !== false
  $('receipt').innerHTML = `
    <p class="h-eyebrow">Switch complete</p>
    <h2>Nothing lost, and no more workarounds.</h2>
    <ul>${result.lines.map(l => `<li>${esc(l)}</li>`).join('')}</ul>
    <p class="h-check"><b>${result.matched} of ${result.checks}</b> checks match.</p>
    ${salesFile ? '<button type="button" class="h-btn" id="sales-file">Download Slotly sales history (CSV)</button>' : ''}
    <form class="h-ask" id="ask-form"><label for="ask-q">Ask Boo about your salon ${gem(true)}</label>
      <div class="row"><input id="ask-q" placeholder="Who has an allergy and a booking soon?" autocomplete="off" /><button class="h-btn primary">Ask</button></div>
      <p class="h-answer" id="ask-a" aria-live="polite"></p></form>
    <p class="h-roadmap">For Slotly's makers: the ${findings.filter(f => !['stays', 'breaks'].includes(f.key)).length} workarounds above are the features their customers have been faking.</p>`
  show('receipt')
  $('sales-file')?.addEventListener('click', () => {
    const csv = `Month,Revenue\n${seen.sales.map(([m, v]) => `${m} 2026,${v}`).join('\n')}\n`
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = 'slotly-sales-history.csv'
    a.click()
  })
  $('ask-form').addEventListener('submit', async e => {
    e.preventDefault()
    const q = $('ask-q').value.trim()
    if (!q) return
    $('ask-a').textContent = 'Asking Gemini...'
    boo.mode('look')
    const a = await askBoo(q, store)
    $('ask-a').textContent = a.answer
    boo.say(a.answer, 6000)
    boo.mode('idle')
  })
  const r = rect($('receipt'))
  boo.mode('happy')
  boo.flyTo(r.right - 70, r.top - 40, 700, { size: 56 }).then(() => {
    burst(boo.centre().x, boo.centre().y, 80, CONFETTI, 1, 700)
    boo.say('All moved. Nothing lost!', 5000)
  })
}

$('start').addEventListener('click', lookAround)
$('haunt-toggle').addEventListener('click', () => {
  const open = $('haunt').hidden
  $('haunt').hidden = !open
  $('haunt-toggle').setAttribute('aria-pressed', String(open))
})

window.__haunt = { store, old, views, ui, feed: feedLines, boo, get read() { return read }, get findings() { return findings }, get features() { return features } }
