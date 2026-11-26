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
import { readOldApp, readWithRules, findingsFor } from './interpret.js'
import { idleRecords, move, prove } from './switch.js'
import { askBoo } from './ai.js'
import { createBoo as createPet } from './pet.js'

const $ = id => document.getElementById(id)
const pause = ms => new Promise(r => setTimeout(r, ms))
const params = new URLSearchParams(location.search)
const speed = Number(params.get('speed')) || 1
const esc = t => String(t ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])

const old = { business: BUSINESS, ...slotlyRecords() }
const slotly = createSlotly($('slotly'), old)
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
playIntro().then(at => {
  boo.place(at.x, at.y)
  free()
  speak("Hi, I'm Boo! Click me, or throw me around.")
})

// ------------------------------------------------------------- Boo off duty: roams, reacts to you, can be grabbed and thrown

let pet = null
let lineAt = 0
const PET_LINES = ['Boo!', 'Hehe, that tickles.', 'I live in your software now.', 'Press the purple button and I get to work.', 'I only haunt the boring bits.', 'Wheee!', 'Your team works so hard. Let me help.']
const standables = () =>
  [...document.querySelectorAll('#haunt .h-card, #haunt .h-start, #haunt .h-receipt, #haunt .h-proof, .sl-toolbar, .idl-head')].filter(el => !el.closest('[hidden]') && el.getClientRects().length)

/** Boo is off duty: the roaming ghost takes over from where the working ghost is. */
function free() {
  if (pet) return
  const b = boo.box
  boo.hide()
  pet = createPet({
    windows: standables,
    bounds: () => ({ x: 0, y: 0, w: innerWidth, h: innerHeight - 12 }),
    at: { x: b.x, y: b.y },
    pop: false,
    onClick: () => pet?.handle({ type: 'say', text: PET_LINES[lineAt++ % PET_LINES.length] }),
  })
}

/** Back to work: the working ghost appears exactly where the roaming one was. */
function busy() {
  if (!pet) return
  const b = pet.box
  pet.destroy()
  pet = null
  boo.place(b.x, b.y)
  boo.show()
}

/** Say something, whichever Boo is out. */
function speak(text, ms = 3200) {
  if (pet) pet.handle({ type: 'say', text })
  else boo.say(text, ms)
}
async function goHome(text) {
  if (pet) return text && speak(text)
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
  for (const x of ['collected', 'tour', 'found', 'live', 'confirm', 'moving', 'proof', 'receipt']) $(x).hidden = x !== id
  $(id).scrollIntoView?.({ block: 'nearest', behavior: 'smooth' })
}
const gem = (on, model) => (on ? `<span class="gem" title="${esc(model || 'Gemini')}">✦ Gemini</span>` : '')
const ui = {
  /** What Boo is doing right now, in one plain line: in the panel and as a caption over the apps. */
  now(title, sub = '') {
    $('now').hidden = false
    $('now-title').textContent = title
    $('now-sub').textContent = sub
    $('caption').hidden = false
    $('cap-title').textContent = title
    $('cap-sub').textContent = sub
  },
  log(text) {
    feedLines.push(text)
  },
  /** One part of Slotly is read: show everything collected, and wait until you say move on. */
  async collected({ title, head, rows, next }) {
    ui.now(`${title} from Slotly`, 'Have a look, then move to the next step')
    $('collected').innerHTML = `<p class="h-eyebrow">Act I · Rise of the Dead</p><h2>${esc(title)}</h2>
      <div class="h-list"><table><thead><tr>${head.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead>
      <tbody>${rows.map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
      <button type="button" class="h-btn primary" id="collected-next">${esc(next)}</button>`
    show('collected')
    free()
    await new Promise(r => $('collected-next').addEventListener('click', r, { once: true }))
    $('collected').hidden = true
    busy()
  },
  /** A ghost finished one record in Idle. Shown when you are watching that ghost. */
  moved(lane, what, done, total) {
    if (views[lane].el.classList.contains('on')) ui.now(`${AGENTS[lane].name} added ${what} to Idle`, `${done} of ${total}`)
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
  feature(key, text, said) {
    if (said) ui.now(said, text)
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
  proof(matched, checks, diff, label) {
    if (label) ui.now('Checking Idle against what Slotly had', `${label} ${diff ? '✗' : '✓'} (${checks} checked, ${matched} match)`)
    $('proof-num').textContent = matched
    $('proof-of').textContent = `of ${checks} checks match`
    $('proof-bar').style.width = `${checks ? (matched / checks) * 100 : 0}%`
    $('proof').classList.toggle('bad', matched < checks)
    $('proof-diff').hidden = !diff
    if (diff) $('proof-diff').textContent = diff
  },
}

// ------------------------------------------------------------- telling the story plainly

/** The three chapters at the top of the panel. */
function chapter(name) {
  const order = ['read', 'find', 'clean', 'move']
  for (const li of document.querySelectorAll('#chapters [data-ch]')) {
    const i = order.indexOf(li.dataset.ch)
    li.dataset.state = i < order.indexOf(name) ? 'done' : i === order.indexOf(name) ? 'now' : ''
  }
}

/**
 * Ring a piece of Slotly's screen, dim the rest of Slotly (never the panel),
 * and draw a line from the ring to the card that explains it.
 * Returns a function that takes it all away.
 */
function mark(el, label, card) {
  const r = rect(el)
  const pane = rect(el.closest('.pane') ?? document.body)
  const dim = document.createElement('div')
  dim.className = 'wk-dim'
  Object.assign(dim.style, { left: `${pane.left}px`, top: `${pane.top}px`, width: `${pane.width}px`, height: `${pane.height}px` })
  const box = { x: r.left - pane.left - 4, y: r.top - pane.top - 4, w: r.width + 8, h: r.height + 8 }
  // Four dark panels around the spot, inside Slotly only. The panel on the right stays bright.
  for (const [x, y, w, h] of [
    [0, 0, pane.width, box.y],
    [0, box.y + box.h, pane.width, pane.height - box.y - box.h],
    [0, box.y, box.x, box.h],
    [box.x + box.w, box.y, pane.width - box.x - box.w, box.h],
  ]) {
    const shade = document.createElement('i')
    shade.className = 'wk-shade'
    Object.assign(shade.style, { left: `${x}px`, top: `${y}px`, width: `${Math.max(0, w)}px`, height: `${Math.max(0, h)}px` })
    dim.appendChild(shade)
  }
  const ring = document.createElement('div')
  ring.className = 'wk-mark'
  Object.assign(ring.style, { left: `${box.x}px`, top: `${box.y}px`, width: `${box.w}px`, height: `${box.h}px` })
  ring.innerHTML = `<span>${esc(label)}</span>`
  dim.appendChild(ring)
  document.body.appendChild(dim)
  // The line: from the right edge of the ring to the left edge of the card.
  const c = rect(card)
  const x1 = Math.min(r.right + 4, pane.right - 6)
  const y1 = r.top + r.height / 2
  const x2 = c.left - 2
  const y2 = c.top + 46
  const link = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  link.setAttribute('class', 'wk-link')
  link.innerHTML = `<path d="M ${x1} ${y1} C ${x1 + (x2 - x1) * 0.5} ${y1}, ${x2 - (x2 - x1) * 0.5} ${y2}, ${x2} ${y2}" /><circle cx="${x1}" cy="${y1}" r="5" /><circle cx="${x2}" cy="${y2}" r="5" />`
  document.body.appendChild(link)
  card.classList.add('linked')
  return () => {
    dim.remove()
    link.remove()
    card.classList.remove('linked')
  }
}

/** Page through Slotly's customer list, as a person would, until this customer is on screen. */
async function customerRow(src) {
  await reader.press('[data-nav]', 'Customers')
  const row = () => reader.all('tbody tr[data-customer]').find(tr => Number(tr.dataset.customer) === src)
  for (let tries = 0; !row() && tries < 10; tries++) {
    const first = Number(reader.all('tbody tr[data-customer]')[0]?.dataset.customer ?? 0)
    await reader.press(`[data-page="${src < first ? -1 : 1}"]`)
  }
  return row()
}

/** Show and tell: Boo walks to three real workarounds in Slotly and says what each really is. */
async function tour() {
  const stops = [
    {
      key: 'packages',
      say: 'Look, a package hiding in the notes.',
      async find() {
        const c = read.clients.find(x => x.packages.length)
        await reader.click(await customerRow(c.src))
        const p = c.packages[0]
        return { el: reader.look('aside textarea'), real: `${c.name} · ${p.name} · ${p.left} of ${p.of} left · paid $${p.paid}`, from: p.from }
      },
    },
    {
      key: 'alerts',
      say: 'An allergy typed into a name.',
      async find() {
        const c = read.clients.find(x => /ALLERGY/.test(seen.customers[x.src].name))
        const row = await customerRow(c.src)
        return { el: row.cells[0], real: `${c.name} · health alert: ${c.alert}`, from: seen.customers[c.src].name }
      },
    },
    {
      key: 'cleanup',
      say: 'This is not a client. It is clean-up time.',
      async find() {
        await reader.press('[data-nav]', 'Appointments')
        const row = reader.all('tr[data-appt]').find(tr => reader.text(tr.cells[3]) === 'CLEAN UP')
        const c = read.cleanups[0]
        const svc = read.services.find(x => x.name === c.after)
        return { el: row, real: `${c.after} · ${svc?.buffer ?? c.mins} min clean-up after, added automatically`, from: [...row.cells].map(td => reader.text(td)).join('  ') }
      },
    },
  ]
  reader.pace.move = 420
  for (const [i, stop] of stops.entries()) {
    const f = findings.find(x => x.key === stop.key)
    if (!f) continue
    const { el, real, from } = await stop.find()
    boo.say(stop.say, 3200)
    const last = i === stops.length - 1
    $('tour').innerHTML = `<p class="h-eyebrow">Act II · Ghosts in the Notes · ${i + 1} of ${stops.length}</p>
      <h2>${esc(f.why)}</h2>
      <p class="h-but">${esc(f.but)}</p>
      <dl><div><dt>In Slotly today</dt><dd><code>${esc(from)}</code></dd></div>
      <div><dt>What it really is ${gem(read.by === 'ai', read.model)}</dt><dd class="real"><code>${esc(real)}</code></dd></div></dl>
      <button type="button" class="h-btn primary" id="tour-next">${last ? `See all ${findings.filter(x => x.key !== 'stays').length} workarounds` : 'Next'}</button>`
    show('tour')
    await pause(250)
    const unring = mark(el, 'Workaround', $('tour'))
    ui.now(`Workaround found: ${f.title.toLowerCase()}`, `${f.count} like this in Slotly`)
    await new Promise(r => $('tour-next').addEventListener('click', r, { once: true }))
    unring()
    if (reader.look('aside [data-close]')) await reader.press('aside [data-close]')
  }
  await reader.press('[data-nav]', 'Appointments')
  reader.hide()
}

// ------------------------------------------------------------- act one: look around, then haunt it

let seen = null
let read = null
let findings = null

async function lookAround() {
  $('start').disabled = true
  busy()
  boo.react('happy', "Let's see what's in here.", 1400)
  await pause(400)
  $('start-card').hidden = true
  seen = await survey({ r: reader, ui, speed, business: BUSINESS })
  chapter('find')
  ui.now(`Gemini is reading ${seen.customers.length} customers' names and notes`, 'To work out what your team has been doing by hand, and why')
  boo.mode('look')
  boo.say('Reading between the lines...', 3000)
  read = await readOldApp(seen)
  findings = findingsFor(seen, read)
  ui.log(read.by === 'ai' ? `Gemini (${read.model}) read the records. ${read.aiCount} of its answers matched the original text and were used.` : 'Gemini was busy, so plain rules read the records.')
  await tour()
  showFindings()
}

function showFindings() {
  const by = read.by === 'ai'
  const hand = findings.filter(f => f.key !== 'stays')
  ui.now(`Slotly's data hides ${hand.length} workarounds`, 'Each one is something Slotly cannot hold, kept somewhere it does not belong')
  $('found').innerHTML = `<p class="h-eyebrow">Act II · Ghosts in the Notes</p><h2>What's messy in Slotly's data ${gem(by, read.model)}</h2>
    <p class="h-sub">Slotly has no place for these, so your team hid them in names, notes and fake bookings. Before anything moves to Idle, they need cleaning up.</p>
    <ul class="h-finds">${hand.map(f => `<li><p>${esc(f.why)}</p><span class="n">${f.count}</span><p class="h-but">${esc(f.but)}</p><code>${esc(f.from[0])}</code></li>`).join('')}</ul>
    <button type="button" class="h-btn primary" id="to-clean">Begin Act III: The Exorcism</button>`
  show('found')
  $('caption').hidden = true
  free()
  speak(`I found ${hand.length} workarounds hiding in the data.`)
  $('to-clean').addEventListener('click', standardise)
}

/** Chapter two: the standard way for each workaround, confirmed by the owner, then the cleaning itself. */
function standardise() {
  chapter('clean')
  // Read Slotly's diary as it is now, in case anything changed while Boo was looking.
  seen.appointments = old.appointments.map(a => ({ ...a }))
  Object.assign(read, (({ bookings, cleanups, breaks }) => ({ bookings, cleanups, breaks }))(readWithRules(seen)))
  findings = findingsFor(seen, read)
  ui.now('The standard way for each workaround. Is this right?', 'Idle has a proper place for each one. Nothing is cleaned or moved until you say yes.')
  $('confirm').innerHTML = `<p class="h-eyebrow">Act III · The Exorcism</p><h2>How each workaround gets cleaned ${gem(read.by === 'ai', read.model)}</h2>
    <div class="h-map-head"><span>Messy in Slotly</span><span></span><span>Clean and standard</span></div>
    <ol class="h-map">${findings
      .map(
        (f, i) => `<li data-i="${i}"><b>${esc(f.title)}</b><span class="n">${f.count}</span><p>${esc(f.why)}</p><p class="h-but">${esc(f.but)}</p>${f.sub ? `<small>${esc(f.sub)}</small>` : ''}
        <div class="map"><code>${f.from.map(esc).join('<br>')}</code><span class="arrow" aria-hidden="true">→</span><code class="to">${f.to.map(esc).join('<br>')}</code></div>
        <div class="choices">${f.choices.map(([, label], k) => `<button type="button" data-c="${k}" aria-pressed="${k === 0}">${esc(label)}</button>`).join('')}</div></li>`,
      )
      .join('')}</ol>
    <button type="button" class="h-btn primary" id="go">Yes, clean it</button>`
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
  $('caption').hidden = true
  $('go').addEventListener('click', clean)
}

/** The cleaning, one kind of workaround at a time, so you can see each one become standard. */
async function clean() {
  busy()
  const done = findings.filter(f => f.key !== 'stays')
  $('live').innerHTML = `<p class="h-eyebrow">Act III · The Exorcism</p><h2>Cleaning Slotly's data</h2><p class="h-sub">Each workaround becomes a proper field, ready for Idle.</p>
    <ol class="h-clean">${done.map(f => `<li data-k="${f.key}"><b>${esc(f.title)}</b><em>${f.count}</em><div class="map"><code>${esc(f.from[0])}</code><span class="arrow" aria-hidden="true">→</span><code class="to">${esc(f.to[0])}</code></div></li>`).join('')}</ol>`
  show('live')
  boo.mode('work')
  for (const f of done) {
    const row = $('live').querySelector(`[data-k="${f.key}"]`)
    row.classList.add('now')
    row.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    const r = rect(row)
    boo.flyTo(r.left - 46, r.top - 6, 380, { size: 36 })
    ui.now(`Cleaning: ${f.title.toLowerCase()}`, `${f.count} found · “${f.from[0].slice(0, 60)}” becomes “${f.to[0].slice(0, 60)}”`)
    await pause(1100 * speed)
    row.classList.replace('now', 'clean')
    burst(r.left + 20, r.top + 10, 10, SPARKLE, 0.3, 200)
  }
  ui.now('Slotly\'s data is clean and standard', `${done.length} workarounds turned into proper fields. Act IV: Crossing Over is next.`)
  boo.react('happy', 'All clean!', 1600)
  await pause(1600 * speed)
  switchToIdle()
}

async function switchToIdle() {
  busy()
  chapter('move')
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
  $('moving').innerHTML = `<p class="h-eyebrow">Act IV · Crossing Over</p><h2>Moving into Idle</h2><ul class="h-move">${rows.map(([k, label, n]) => `<li data-key="${k}"><span class="ghost-slot"></span><b>${label}</b><em>0 of ${n}</em><div class="bar"><i></i></div></li>`).join('')}</ul>`
  show('moving')
  ui.now('Moving everything into Idle', 'Three ghosts work at once, through Idle\'s own screens. Click Setup, Clients or Bookings above Idle to watch one.')
  await split(['setup', 'people', 'books'])
  await move({ records, lanes: [views.setup, views.people, views.books], store, ui, speed })
  show('proof')
  watch('proof')
  await split(['proof'])
  const result = await prove({ seen, read, records, d, p: views.proof.hands, ui, speed })
  done(result, d)
}

function done(result, d) {
  for (const li of document.querySelectorAll('#chapters [data-ch]')) li.dataset.state = 'done'
  ui.now('Maple & Mint now runs on Idle', `${result.matched} of ${result.checks} checks match`)
  const salesFile = d.stays !== false
  $('receipt').innerHTML = `
    <p class="h-eyebrow">The end · Slotly can rest in peace</p>
    <h2>Cleaned, standardised, and moved. Nothing lost.</h2>
    <p class="h-check">${findings.filter(f => f.key !== 'stays').length} workarounds cleaned up. Each one is a proper field in Idle now.</p>
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
    speak(a.answer, 6000)
    boo.mode('idle')
  })
  const r = rect($('receipt'))
  boo.mode('happy')
  boo.flyTo(r.right - 70, r.top - 40, 700, { size: 56 }).then(async () => {
    burst(boo.centre().x, boo.centre().y, 80, CONFETTI, 1, 700)
    boo.say('All moved. Nothing lost!', 3000)
    await pause(3200)
    free()
  })
}

$('start').addEventListener('click', lookAround)
$('haunt-toggle').addEventListener('click', () => {
  const open = $('haunt').hidden
  $('haunt').hidden = !open
  $('haunt-toggle').setAttribute('aria-pressed', String(open))
})

window.__haunt = { store, old, views, ui, feed: feedLines, boo, get read() { return read }, get findings() { return findings } }
