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
import { readWithRules, findingsFor, mergeReading, askGeminiToRead, cleanName } from './interpret.js'
import { idleRecords, crewsFor, move, prove } from './switch.js'
import { chatBoo, recordsFor, thinkAboutNotes } from './ai.js'
import { applyEdits, cleanEdits, storeFrom } from './edits.js'
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
  speak("Boo! Sorry. Press Play and I'll haunt your old software for you.")
})

// ------------------------------------------------------------- Boo off duty: roams, reacts to you, can be grabbed and thrown

let pet = null
let lineAt = 0
const PET_LINES = ['Boo!', 'Hehe, that tickles.', 'I live in old software. It is very dusty.', 'Press the purple button and I get to work.', 'I only haunt the boring bits.', 'Wheee!', 'I have seen things in your notes field.', 'Every database has ghosts. I am the nice one.', 'Your team works so hard. Let me help.']
const standables = () =>
  [...document.querySelectorAll('.pop > section, .sl-toolbar, .idl-head')].filter(el => !el.closest('[hidden]') && el.getClientRects().length)

/**
 * Netlify adds a "Powered by Netlify" badge to the live site. Boo treats it as
 * solid: it can stand on it or bump into it, never slip behind it.
 */
function netlifyBadge() {
  const ours = el => el.matches('.browser, .ghost-layer, .boo-layer, .intro, .wk-dim, .wk-link, .agent-cursor, .ghost-bubble, script')
  for (const el of document.body.children) {
    if (ours(el)) continue
    const text = `${el.id} ${el.className?.baseVal ?? el.className} ${el.getAttribute('href') ?? ''} ${el.getAttribute('src') ?? ''} ${el.getAttribute('title') ?? ''} ${(el.textContent ?? '').slice(0, 80)}`
    if (!/netlify/i.test(text)) continue
    const r = el.getBoundingClientRect()
    if (r.width > 20 && r.height > 10 && r.width < 600) return { left: r.left, top: r.top, right: r.right, bottom: r.bottom }
  }
  // Not found as an element (it can live in its own frame): use where it always sits.
  return /netlify\.app$/i.test(location.hostname) ? { left: innerWidth - 285, top: innerHeight - 82, right: innerWidth - 20, bottom: innerHeight - 20 } : null
}

// The badge arrives after the page loads. When it is there, the chat box moves up out of its way.
let badgeChecks = 0
const badgeWatch = setInterval(() => {
  const b = netlifyBadge()
  document.body.classList.toggle('has-badge', Boolean(b))
  if (b) document.body.style.setProperty('--badge-room', `${Math.round(innerHeight - b.top + 8)}px`)
  if (++badgeChecks > 20) clearInterval(badgeWatch)
}, 1000)

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
    onClick: () => openChat(),
    obstacles: () => [netlifyBadge()].filter(Boolean),
    // Left alone for a while, Boo naps in the bottom-left corner.
    nap: { after: 25000, spot: world => ({ x: world.x + 10, y: world.y + world.h - 64 }) },
  })
  holdStill()
}

/** Boo flies to the side of the popup that is waiting for you and offers to talk. */
function perch(text) {
  if (!pet || $('pop').hidden) return
  const r = rect($('pop'))
  if (!r.width) return
  // Far enough out that Boo's speech bubble clears the popup too.
  const out = 110
  const roomLeft = r.left - out - 64 - 16 > 0
  const x = roomLeft ? r.left - out : Math.min(innerWidth - 8, r.right + 64 + 8 + out)
  pet.handle({ type: 'guide', x, y: r.bottom - 70, h: 0, text })
  pet.handle({ type: 'wait', text })
}

/** Back to work: the working ghost appears exactly where the roaming one was. */
function busy() {
  if (!$('chat-pop').hidden && !wantNeeds) closeChat()
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

const CSS = { sky: '#5b8def', mint: '#22a06b', peach: '#e8784a' }
const AGENTS = {
  setup: { name: 'Services ghost', colour: 'sky' },
  people: { name: 'Clients ghost 1', colour: 'mint' },
  books: { name: 'Bookings ghost 1', colour: 'peach' },
  proof: { name: 'Proof ghost', colour: 'sky' },
}
const views = {}
/** A ghost with its own Idle tab. Made when needed, so the swarm can be as big as the job. */
function lane(id, name, colour) {
  if (views[id]) return views[id]
  AGENTS[id] = AGENTS[id] ?? { name: name ?? 'Ghost', colour: colour ?? ['mint', 'peach', 'sky'][Object.keys(views).length % 3] }
  const a = AGENTS[id]
  const el = document.createElement('div')
  el.className = 'idle-view'
  el.dataset.view = id
  $('idle-views').appendChild(el)
  const view = mountIdle(el, store, { page: 'home' })
  const ghost = createGhost({ colour: a.colour, size: 40, label: a.name.replace(' ghost', ''), title: a.name })
  ghost.hide()
  views[id] = { el, view, ghost }
  views[id].hands = createHands(el, { name: a.name, ghost, away: () => swarm(id), onHide: () => mergeIntoBoo(ghost) })
  return views[id]
}
for (const id of Object.keys(AGENTS)) lane(id)

/** Ghosts you are not watching swarm over Idle while they work in their own tabs. */
function swarm(id) {
  const g = views[id].ghost
  const now = performance.now()
  if (g.flying || now - (g.hop ?? 0) < 450) return
  g.hop = now
  const r = rect($('idle-views'))
  if (!r.width) return
  g.show()
  g.mode('work')
  g.flyTo(r.left + 30 + Math.random() * (r.width - 110), r.top + 50 + Math.random() * (r.height - 160), 420, { size: 30, arc: 16 })
}
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
/** Boo bursts into a crew: every ghost pops out at once. */
async function split(ids) {
  boo.react('happy', ids.length > 2 ? `Splitting into ${ids.length}! Many hands.` : 'Splitting up.', 2600)
  for (const id of ids) {
    const g = lane(id).ghost
    const b = boo.box
    g.appear(b.x, b.y)
    g.mode('work')
    burst(boo.centre().x, boo.centre().y, 8, SPARKLE, 0.4, 250)
    boo.poke()
    await pause(60)
    if (views[id].el.classList.contains('on')) {
      const r = rect($('idle-views'))
      g.flyTo(r.left + r.width / 2 - 20, r.top + 60, 600)
    } else swarm(id)
  }
}
function watch(id) {
  for (const [k, v] of Object.entries(views)) v.el.classList.toggle('on', k === id)
  document.querySelectorAll('[data-watch]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.watch === id)))
  const a = AGENTS[id]
  $('watching').innerHTML = `<span style="--c:${CSS[a.colour] ?? '#5b8def'}"></span>${a.name}`
}
document.querySelectorAll('[data-watch]').forEach(b => b.addEventListener('click', () => watch(b.dataset.watch)))
watch('people')

// ------------------------------------------------------------- the panel: one calm thing at a time

const feedLines = []
// One popup at a time, floating over the apps. Where it sits depends on what you need to see.
const POP_AT = { collected: 'right', tour: 'right', found: 'center', live: 'center', confirm: 'center', moving: 'left', proof: 'left', receipt: 'center' }
const show = id => {
  for (const x of ['start-card', 'collected', 'tour', 'found', 'live', 'confirm', 'moving', 'proof', 'receipt']) $(x).hidden = x !== id
  $('pop').dataset.pos = POP_AT[id] ?? 'center'
}
const gem = (on, model) => (on ? `<span class="gem" title="${esc(model || 'Gemini')}">✦ Gemini</span>` : '')
const ui = {
  /** What Boo is doing right now, in one plain line: in the panel and as a caption over the apps. */
  now(title, sub = '', { wait = false } = {}) {
    $('now').hidden = false
    $('now-title').textContent = title
    $('now-sub').textContent = sub
    $('now').classList.toggle('working', !wait)
    $('caption').hidden = false
    $('caption').classList.toggle('working', !wait)
    $('cap-title').textContent = title
    $('cap-sub').textContent = sub
  },
  log(text) {
    feedLines.push(text)
  },
  /** One part of Slotly is read: it ticks into the running list. */
  async collected({ title }) {
    if ($('collected').hidden) {
      $('collected').innerHTML = `<p class="h-eyebrow">Read from Slotly</p><ul class="h-tally"></ul>`
      show('collected')
    }
    const li = document.createElement('li')
    li.textContent = title.replace(/^Collected /, '')
    $('collected').querySelector('.h-tally').appendChild(li)
    await pause(350 * speed)
  },
  /** A ghost finished one record in Idle. Shown when you are watching that ghost. */
  moved(lane, what, done, total) {
    if (views[lane].el.classList.contains('on')) ui.now(`Added ${what}`, `${done} of ${total}`)
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
  progress(key, done, total) {
    const row = document.querySelector(`#moving [data-key="${key}"]`)
    if (!row) return
    row.querySelector('.bar i').style.width = `${total ? (done / total) * 100 : 100}%`
    row.querySelector('em').textContent = `${done} of ${total}`
    row.classList.toggle('done', done === total)
  },
  proof(matched, checks, diff, label) {
    if (label) ui.now('Checking', `${label} ${diff ? '✗' : '✓'}`)
    $('proof-num').textContent = matched
    $('proof-of').textContent = `of ${checks} checks match`
    $('proof-bar').style.width = `${checks ? (matched / checks) * 100 : 0}%`
    $('proof').classList.toggle('bad', matched < checks)
    $('proof-diff').hidden = !diff
    if (diff) $('proof-diff').textContent = diff
  },
}

// ------------------------------------------------------------- telling the story plainly

/** A title over the apps as each act begins. Plays by itself. */
async function actBanner(n, plain, act, key) {
  chapter(key)
  const el = $('act-banner')
  el.innerHTML = `<span>Phase ${n} of 5</span><b>${esc(plain)}</b><small>${esc(act)}</small>`
  el.hidden = false
  el.classList.remove('out')
  ui.now(`Phase ${n} of 5 · ${plain}`, act)
  await pause(1900 * speed)
  el.classList.add('out')
  await pause(350)
  el.hidden = true
}

/** Put a "Next" button on a popup and wait until it is pressed. Boo roams while it waits. */
async function nextButton(sectionId, label) {
  const b = document.createElement('button')
  b.type = 'button'
  b.className = 'h-btn primary h-next'
  b.textContent = label
  $(sectionId).appendChild(b)
  free()
  perch('Questions? Tap me.')
  await new Promise(r => b.addEventListener('click', r, { once: true }))
  b.remove()
  busy()
}

/** Wait a moment, or less if you click the button. */
function moment(ms, button) {
  return Promise.race([pause(ms * speed), new Promise(r => button?.addEventListener('click', r, { once: true }))])
}

/** The three chapters at the top of the panel. */
function chapter(name) {
  const order = ['read', 'find', 'clean', 'move', 'verify']
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
  document.querySelector('.browser').appendChild(dim) // same layer as the popups, so the popup stays lit
  // The line: from the right edge of the ring to the left edge of the card.
  const c = rect(card)
  const x1 = Math.min(r.right + 4, pane.right - 6)
  const y1 = r.top + r.height / 2
  const x2 = c.left - 2
  const y2 = c.top + 46
  const link = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  link.setAttribute('class', 'wk-link')
  link.innerHTML = `<path d="M ${x1} ${y1} C ${x1 + (x2 - x1) * 0.5} ${y1}, ${x2 - (x2 - x1) * 0.5} ${y2}, ${x2} ${y2}" /><circle cx="${x1}" cy="${y1}" r="5" /><circle cx="${x2}" cy="${y2}" r="5" />`
  document.querySelector('.browser').appendChild(link)
  card.classList.add('linked')
  return () => {
    dim.remove()
    link.remove()
    card.classList.remove('linked')
  }
}

/** A small piece of Idle's own screen, showing where a workaround will live once it is clean. */
function idlePreview(key, { c, p, svc, mins }) {
  const initials = n => n.split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase()
  if (key === 'packages') {
    return `<div class="idlp"><div class="idlp-bar">Idle · Packages</div><div class="idlp-row">
      <span class="idlp-av">${initials(c.name)}</span><div class="idlp-main"><b>${esc(c.name)}</b><span>${esc(p.name)} · paid $${p.paid}</span>
      <div class="idlp-meter"><i style="width:${Math.round((p.left / p.of) * 100)}%"></i></div><small>${p.left} of ${p.of} left · expires Nov 2027</small></div></div></div>`
  }
  if (key === 'alerts') {
    return `<div class="idlp"><div class="idlp-bar">Idle · Clients</div><div class="idlp-row">
      <span class="idlp-av">${initials(c.name)}</span><div class="idlp-main"><b>${esc(c.name)}${c.vip ? ' <em class="idlp-tag">VIP</em>' : ''}</b>
      <span class="idlp-alert">⚠ ${esc(c.alert)}</span></div></div></div>`
  }
  return `<div class="idlp"><div class="idlp-bar">Idle · Services</div><div class="idlp-row">
    <span class="idlp-av sq">✂</span><div class="idlp-main"><b>${esc(svc?.name ?? 'Colour')}</b><span>${svc?.minutes ?? ''} min · $${svc?.price ?? ''} <em class="idlp-chip">+${mins} min buffer after</em></span>
    </div></div></div>`
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
        return { el: reader.look('aside textarea'), real: `${c.name} · ${p.name} · ${p.left} of ${p.of} left · paid $${p.paid}`, from: p.from, idle: idlePreview('packages', { c, p }) }
      },
    },
    {
      key: 'alerts',
      say: 'An allergy typed into a name.',
      async find() {
        const c = read.clients.find(x => /ALLERGY/.test(seen.customers[x.src].name))
        const row = await customerRow(c.src)
        return { el: row.cells[0], real: `${c.name} · health alert: ${c.alert}`, from: seen.customers[c.src].name, idle: idlePreview('alerts', { c }) }
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
        return { el: row, real: `${c.after} · ${svc?.buffer ?? c.mins} min clean-up after, added automatically`, from: [...row.cells].map(td => reader.text(td)).join('  '), idle: idlePreview('cleanup', { svc, mins: svc?.buffer ?? c.mins }) }
      },
    },
  ]
  reader.pace.move = 420
  for (const [i, stop] of stops.entries()) {
    const f = findings.find(x => x.key === stop.key)
    if (!f) continue
    const { el, from, idle } = await stop.find()
    boo.say(stop.say, 3200)
    $('tour').innerHTML = `<p class="h-eyebrow">Hidden data ${i + 1} of ${stops.length}</p>
      <h2>${esc(f.title)}</h2>
      <dl><div><dt>Old app</dt><dd><code>${esc(from)}</code></dd></div>
      <div><dt>New app ${gem(read.by === 'ai', read.model)}</dt><dd>${idle}</dd></div></dl>
      <button type="button" class="h-btn primary" id="tour-next">Next</button>`
    show('tour')
    const er = rect(el)
    $('pop').dataset.pos = er.left + er.width / 2 > innerWidth / 2 ? 'left' : 'right'
    await pause(250)
    const unring = mark(el, 'Workaround', $('tour'))
    ui.now(f.title, `${f.count} found`, { wait: true })
    free()
    perch('Did I read that right? Tap me.')
    await new Promise(r => $('tour-next').addEventListener('click', r, { once: true }))
    busy()
    unring()
    if (reader.look('aside [data-close]')) await reader.press('aside [data-close]')
  }
  await reader.press('[data-nav]', 'Appointments')
  reader.hide()
}

// ------------------------------------------------------------- what only AI could read, and Boo's plan

let thought = null
async function onlyAiCouldRead(unclear) {
  if (!unclear.length) return
  ui.now('Reading the notes no rule can read', 'Gemini is working on them', { wait: false })
  thought = await Promise.race([thinking, pause(15000).then(() => null)])
  const c = read.clients.find(x => x.src === unclear[0].src)
  await reader.click(await customerRow(c.src))
  const el = reader.look('aside textarea')
  const rows = thought?.notes?.length
    ? thought.notes.slice(0, 5).map(n => `<li><code>${esc(n.text)}</code><span class="arrow">→</span><b>${esc(n.meaning)}</b></li>`).join('')
    : unclear.slice(0, 5).map(u => `<li><code>${esc(u.text)}</code><span class="arrow">→</span><b>?</b></li>`).join('')
  $('tour').innerHTML = `<p class="h-eyebrow">Only AI could read these ${gem(Boolean(thought?.notes?.length), thought?.model)}</p>
    <h2>${unclear.length} notes in no fixed shape</h2>
    <ul class="h-ai">${rows}</ul>
    ${thought?.notes?.length ? '' : '<p class="h-hint">The spirits are busy. Tell Boo what these mean.</p>'}
    <button type="button" class="h-btn primary" id="tour-next">Next</button>`
  show('tour')
  const er = rect(el)
  $('pop').dataset.pos = er.left + er.width / 2 > innerWidth / 2 ? 'left' : 'right'
  await pause(250)
  const unring = mark(el, 'No rule can read this', $('tour'))
  ui.now(thought ? 'Gemini read what no rule could' : 'Boo needs your help with these', `${unclear.length} notes`, { wait: true })
  free()
  perch(thought ? 'Got one wrong? Tap me.' : 'Tap me and tell me what these mean.')
  await new Promise(r => $('tour-next').addEventListener('click', r, { once: true }))
  busy()
  unring()
  if (reader.look('aside [data-close]')) await reader.press('aside [data-close]')
  await reader.press('[data-nav]', 'Appointments')
  reader.hide()
}

/** Boo's plan, written by Gemini from what Boo found and what you said matters. */
async function showPlan() {
  const steps = thought?.plan?.length
    ? thought.plan
    : [`Move every client and their history`, `Turn notes into proper fields`, `Check every dollar of credit and prepaid`, `Lay the old app to rest`]
  $('tour').innerHTML = `<p class="h-eyebrow">Boo's plan ${gem(Boolean(thought?.plan?.length), thought?.model)}</p>
    <h2>${needs ? `Because you said: “${esc(needs.slice(0, 60))}”` : 'Here is what I will do'}</h2>
    <ol class="h-plan-steps">${steps.map(t => `<li>${esc(t)}</li>`).join('')}</ol>
    <button type="button" class="h-btn primary" id="tour-next">Next: clean it</button>`
  show('tour')
  $('pop').dataset.pos = 'center'
  ui.now("Boo's plan", 'Next: clean it', { wait: true })
  free()
  perch('Want a change? Tap me.')
  await new Promise(r => $('tour-next').addEventListener('click', r, { once: true }))
  busy()
}

// ------------------------------------------------------------- act one: look around, then haunt it

let needs = ''
let wantNeeds = null
let pendingEdits = [] // changes asked for before Boo has read the data
const editLog = [] // every change made, so a fresh reading can keep them
let movedWith = null // the decisions used for the move
let changedWhileMoving = false
const isQuestion = m => /\?\s*$/.test(m) || /^\s*(what|how|who|whom|which|when|where|why|do|does|did|is|are|can|could|tell|show|list|give|any)\b/i.test(m)
let startNeeds = null
let thinking = null // Gemini reading the notes no rule can read, and writing Boo's plan
let seen = null
let read = null
let findings = null

async function lookAround() {
  $('start').disabled = true
  $('start-card').hidden = true
  $('pop').dataset.pos = 'right'
  stage = 'asking'
  free()
  needs = await new Promise(resolve => {
    const said = []
    // Boo answers each thing you say, then waits until you press Start.
    wantNeeds = async message => {
      // A question gets answered from the data; anything else is what matters to you.

      $('chat-chips').hidden = true
      const reply = $('chat-reply')
      reply.hidden = false
      reply.innerHTML = `<b>You:</b> ${esc(message)}<br><i>Boo is thinking...</i>`
      const out = await chatBoo({ message, stage: STAGES.asking, decisions: [], records: recordsNow() })
      const text = out.model ? out.reply : 'Got it. I will keep that in mind the whole way.'
      const notes = honest(text, act(out))
      if (!isQuestion(message) && !notes.applied) said.push(message)
      reply.innerHTML = `<b>You:</b> ${esc(message)}<br><b>Boo${out.model ? ` ${gem(true, out.model)}` : ''}:</b> ${esc(text)}${notes.map(n => `<br><em>${esc(n)}</em>`).join('')}`
      $('chat-q').placeholder = 'Anything else? Tell Boo'
      $('chat-start').hidden = false
      placeChat()
    }
    startNeeds = () => resolve(said.join('; '))
    openChat({ question: 'Before I start: what matters most to you in this switch?', chips: ["Don't lose any money", 'Keep health info safe', "Don't mess up the schedule"] })
  })
  wantNeeds = null
  startNeeds = null
  $('chat-start').hidden = true
  closeChat()
  stage = 'reading'
  busy()
  await actBanner(1, 'Collect the data', 'Act I · Rise of the Dead', 'read')
  seen = await survey({ r: reader, ui, speed, business: BUSINESS })
  ui.now('Data collected', 'Next: analyse it', { wait: true })
  await nextButton('collected', 'Next: analyse it')
  await actBanner(2, 'Analyse it', 'Act II · Ghosts in the Notes', 'find')
  stage = 'touring'
  // Boo starts with its own reading; Gemini reads everything in the background and is merged in when it answers.
  read = readWithRules(seen)
  if (pendingEdits.length) {
    const r = applyEdits(read, pendingEdits)
    editLog.push(...pendingEdits)
    pendingEdits = []
    if (r.done.length) speak(`Done: ${r.done[0]}${r.done.length > 1 ? ` and ${r.done.length - 1} more` : ''}`, 4000)
  }
  findings = findingsFor(seen, read)
  const records = seen.customers.length + seen.services.length + seen.staff.length
  $('gem-chip').hidden = false
  $('gem-chip').textContent = `✦ Gemini is reading ${records} records…`
  const gemini = askGeminiToRead(seen).then(ai => {
    if (!ai) return ($('gem-chip').textContent = '✦ The spirits are busy · Boo read it all alone')
    const merged = mergeReading(seen, read, ai)
    if (merged.by === 'ai') {
      Object.assign(read, merged)
      $('gem-chip').textContent = `✦ Gemini read ${records} records · ${merged.aiCount} answers checked and used`
      $('gem-chip').classList.add('done')
    }
  })
  const unclear = read.clients.flatMap(c => (c.unclear ?? []).map(text => ({ src: c.src, text })))
  thinking = thinkAboutNotes({ unclear, needs, found: findings.map(f => `${f.title} (${f.count})`) })
  await tour()
  await onlyAiCouldRead(unclear)
  await showPlan()
  // Give Gemini a few more seconds if it is still reading, then carry on either way.
  await Promise.race([gemini, pause(6000 * speed)])
  await actBanner(3, 'Clean it', 'Act III · The Exorcism', 'clean')
  standardise()
}

/** One screen: how each piece of hidden data gets cleaned. Carries on by itself unless you step in. */
function standardise() {
  stage = 'deciding'
  seen.appointments = old.appointments.map(a => ({ ...a }))
  Object.assign(read, (({ bookings, cleanups, breaks }) => ({ bookings, cleanups, breaks }))(readWithRules(seen)))
  applyEdits(read, editLog.filter(e => e.target === 'booking'))
  findings = findingsFor(seen, read)
  if (thought?.notes?.length) {
    const n = thought.notes.find(x => x.kind !== 'note') ?? thought.notes[0]
    findings.splice(findings.length - 1, 0, { key: 'unclear', title: 'Notes only AI could read', count: thought.notes.length, from: [n.text], to: [n.meaning], choices: [[true, 'Use what Gemini read'], [false, 'Keep them as notes']], value: true, why: '', but: '' })
  }
  const list = findings.filter(f => f.key !== 'stays')
  $('confirm').innerHTML = `<h2>Is this right? ${gem(read.by === 'ai', read.model)}</h2>
    <div class="h-map-head"><span>Old app</span><span></span><span>New app</span></div>
    <ol class="h-map">${list
      .map(
        f => `<li data-i="${findings.indexOf(f)}"><b>${esc(f.title)}</b><span class="n">${f.count}</span>
        <div class="map"><code>${esc(f.from[0])}</code><span class="arrow" aria-hidden="true">→</span><code class="to">${esc(f.to[0])}</code></div>
        ${['packages', 'merge', 'unclear'].includes(f.key) ? `<div class="choices">${f.choices.map(([, label], k) => `<button type="button" data-c="${k}" aria-pressed="${k === 0}">${esc(label)}</button>`).join('')}</div>` : ''}</li>`,
      )
      .join('')}</ol>
    <p class="h-hint">Anything else wrong? Tap Boo and tell it.</p>
    <button type="button" class="h-btn primary" id="go">Looks right, clean it</button>`
  show('confirm')
  ui.now('Is this right?', 'Anything wrong? Tap Boo and say it', { wait: true })
  free()
  perch('Anything wrong? Tap me and tell me.')
  $('go').addEventListener('click', clean, { once: true })
}
$('confirm').addEventListener('click', e => {
  const b = e.target.closest('[data-c]')
  const li = b?.closest('[data-i]')
  if (!b || !li) return
  const f = findings[Number(li.dataset.i)]
  f.value = f.choices[Number(b.dataset.c)][0]
  li.querySelectorAll('[data-c]').forEach(x => x.setAttribute('aria-pressed', String(x === b)))
})

/** The cleaning, quickly, one kind at a time. */
async function clean() {
  stage = 'cleaning'
  // What Gemini read in the notes becomes real data, if you agreed.
  if (thought?.notes?.length && findings.find(f => f.key === 'unclear')?.value !== false) {
    for (const n of thought.notes) {
      const c = read.clients.find(x => x.src === n.src)
      if (!c) continue
      if (n.kind === 'credit' && n.amount) c.credit += n.amount
      if (n.kind === 'prepaid' && n.sessions) c.packages.push({ name: `${n.sessions} ${n.service || 'sessions'}`, left: n.sessions, of: n.sessions, paid: n.amount, from: n.text })
      if (n.kind === 'flag' && n.flag) c.alert = c.alert ? `${c.alert} · ${n.flag}` : n.flag
    }
  }
  busy()
  const done = findings.filter(f => f.key !== 'stays')
  $('live').innerHTML = `<h2>Cleaning</h2><ol class="h-clean">${done.map(f => `<li data-k="${f.key}"><b>${esc(f.title)}</b><em>${f.count}</em></li>`).join('')}</ol>`
  show('live')
  boo.mode('work')
  for (const f of done) {
    const row = $('live').querySelector(`[data-k="${f.key}"]`)
    row.classList.add('now')
    row.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    const r = rect(row)
    boo.flyTo(r.left - 46, r.top - 6, 300, { size: 36 })
    ui.now('Cleaning', f.title)
    await pause(480 * speed)
    row.classList.replace('now', 'clean')
    burst(r.left + 20, r.top + 10, 8, SPARKLE, 0.3, 200)
  }
  boo.react('happy', 'All clean!', 1400)
  ui.now('Data cleaned', 'Next: migrate it', { wait: true })
  await nextButton('live', 'Next: migrate it')
  await actBanner(4, 'Migrate it', 'Act IV · Back from the Dead', 'move')
  switchToIdle()
}

async function switchToIdle() {
  stage = 'moving'
  busy()
  const d = Object.fromEntries(findings.map(f => [f.key, f.value]))
  movedWith = d
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
  $('moving').innerHTML = `<h2>Moving, all at once</h2><ul class="h-move">${rows.map(([k, label, n]) => `<li data-key="${k}"><b>${label}</b><em>0 of ${n}</em><div class="bar"><i></i></div></li>`).join('')}</ul>`
  show('moving')
  const crews = crewsFor(records)
  ui.now('Moving', `${crews.length} ghosts at once`)
  for (const c of crews) lane(c.id, c.name)
  await split(crews.map(c => c.id))
  await move({ crews, lane, store, ui, speed })
  await actBanner(5, 'Verify it', 'Act V · Rest in Peace', 'verify')
  show('proof')
  watch('proof')
  await split(['proof'])
  const result = await prove({ seen, read, records, d, p: views.proof.hands, ui, speed })
  done(result, d)
}

const DIRT = ['#5b3a24', '#7a5236', '#946a48', '#3e2716']

/** The old app sinks into a grave and leaves a headstone. The new app takes the whole window. */
async function layToRest() {
  const pane = $('pane-slotly')
  if (pane.hidden) return
  const r = rect(pane)
  const dust = setInterval(() => {
    for (let i = 0; i < 3; i++) burst(r.left + 20 + Math.random() * (r.width - 40), r.bottom - 8, 8, DIRT, 0.55, 1300)
  }, 200)
  pane.animate([{ transform: 'translate(-3px, 0)' }, { transform: 'translate(3px, 0)' }, { transform: 'translate(0, 0)' }], { duration: 300, iterations: 2 })
  await pause(600)
  const down = pane.animate([{ transform: 'translateY(0)', clipPath: 'inset(0 0 0 0)' }, { transform: `translateY(${r.height}px)`, clipPath: `inset(0 0 ${r.height}px 0)` }], { duration: 2400, easing: 'cubic-bezier(.55,.05,.7,.4)', fill: 'forwards' })
  await down.finished
  clearInterval(dust)
  pane.hidden = true
  down.cancel()
  $('tab-slotly').hidden = true
  $('viewport').classList.remove('split')
  const stone = document.createElement('div')
  stone.className = 'tombstone'
  stone.setAttribute('role', 'img')
  stone.setAttribute('aria-label', 'Here lies Slotly, 2011 to 2026. Its data lives on in Idle.')
  stone.innerHTML = '<span class="rip">RIP</span><strong>Slotly</strong><span class="years">2011 – 2026</span><em>Its data lives on in Idle</em>'
  $('viewport').appendChild(stone)
  burst(r.left + 120, r.bottom - 120, 30, SPARKLE, 0.5, 200)
  $('caption').hidden = true
}

function done(result, d) {
  stage = 'done'
  // Anything you changed while it was moving goes in now.
  if (changedWhileMoving) storeFrom(idleRecords(read, movedWith), store)
  for (const li of document.querySelectorAll('#chapters [data-ch]')) li.dataset.state = 'done'
  // The end is quiet: the new app with its clients, one card, the headstone. Nothing else.
  $('caption').hidden = true
  $('gem-chip').hidden = true
  $('watch-pick').hidden = true
  $('watching').hidden = true
  $('chapters').hidden = true
  watch('people')
  $('receipt').innerHTML = `
    <p class="h-eyebrow">Back from the dead</p>
    <h2>Slotly died. Its data lives on.</h2>
    <p class="h-check"><b>${result.matched}/${result.checks}</b> checks match</p>
    <details class="h-moved"><summary>What moved</summary><ul>${result.lines.map(l => `<li>${esc(l)}</li>`).join('')}</ul></details>`
  show('receipt')
  setTimeout(() => layToRest(), 1800 * speed)
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

// ------------------------------------------------------------- the chat bar: ask Boo, or change the plan

/** After a correction: work out the findings again, keep the owner's choices, redraw what is on screen. */
function refreshFindings() {
  if (!findings) return
  const chosen = Object.fromEntries(findings.map(f => [f.key, f.value]))
  findings = findingsFor(seen, read)
  for (const f of findings) if (f.key in chosen) f.value = chosen[f.key]
  if (!$('confirm').hidden) {
    $('confirm').querySelectorAll('[data-i]').forEach(li => {
      const f = findings[Number(li.dataset.i)]
      const to = li.querySelector('code.to')
      if (f && to) to.innerHTML = f.to.map(esc).join('<br>')
    })
  }
}

let stage = 'start'
const STAGES = {
  start: 'Not started. Boo has not looked at Slotly yet.',
  asking: 'Boo asked what matters most. Answer questions from the data; otherwise say how Boo will protect what they said.',
  reading: 'Boo is reading Slotly.',
  touring: 'Boo has read Slotly and is showing the owner the workarounds it found. The owner can correct anything Boo read.',
  found: 'Boo has read Slotly and found the workarounds. The clean-up plan can still change.',
  deciding: 'The owner is choosing how each workaround is cleaned. The plan can change.',
  cleaning: 'The data is being cleaned. The plan is locked.',
  moving: 'The clean data is moving into Idle. The plan is locked.',
  done: 'Everything is in Idle. The owner can still fix any client, service or team member, and it changes in Idle.',
}
/** Do what Boo was asked: a clean-up decision, and any changes to the data. Returns what happened, in plain words. */
function act(out) {
  const notes = []
  notes.applied = false
  if (out.change) {
    const said = changeDecision(out.change)
    notes.push(said)
    notes.applied = said.startsWith('Changed')
  }
  const edits = cleanEdits(out.edits).map(e => (['client', 'booking'].includes(e.target) ? { ...e, name: cleanName(e.name) } : e))
  if (!edits.length) return notes
  if (!read) {
    pendingEdits.push(...edits)
    notes.applied = true
    notes.push('Noted. I will make that change as soon as I have read the data.')
    return notes
  }
  const r = applyEdits(read, edits)
  editLog.push(...edits)
  if (r.done.length) {
    if (stage === 'done') storeFrom(idleRecords(read, movedWith), store)
    else if (stage === 'moving') changedWhileMoving = true
    else refreshFindings()
  }
  notes.push(...r.done.map(x => `Done: ${x}`), ...r.failed.map(x => `Not changed: ${x}`))
  notes.applied ||= r.done.length > 0
  return notes
}
/** Boo never gets to claim a change that did not happen. */
function honest(reply, notes) {
  if (notes.applied || notes.length || !/\b(updated|changed|added|removed|set|cancell?ed|deleted|moved|made|marked|raised)\b/i.test(reply)) return notes
  return ['Nothing was changed. Tell me exactly what to change, like "Balayage costs $260".']
}

/** A clean-up decision, changed from the chat. Package expiry can be any number of months. */
function changeDecision(change) {
  const f = findings?.find(x => x.key === change.key)
  if (!f || !['touring', 'found', 'deciding', 'cleaning'].includes(stage)) return 'Everything has moved, so the clean-up choices are locked.'
  let k = change.option
  if (change.months) {
    const at = new Date(Date.UTC(2026, 10, 26))
    at.setUTCMonth(at.getUTCMonth() + change.months)
    const day = at.toISOString().slice(0, 10)
    k = f.choices.findIndex(c => c[0] === day)
    if (k < 0) k = f.choices.push([day, `Yes, expire in ${change.months} months`]) - 1
  }
  f.value = f.choices[k][0]
  const li = document.querySelector(`#confirm [data-i="${findings.indexOf(f)}"]`)
  const box = li?.querySelector('.choices')
  if (box) box.innerHTML = f.choices.map(([, label], i) => `<button type="button" data-c="${i}" aria-pressed="${i === k}">${esc(label)}</button>`).join('')
  li?.classList.add('changed')
  return `Changed: ${f.title} → ${f.choices[k][1]}`
}

function recordsNow() {
  const counts = { customers: old.customers.length, services: old.services.length, staff: old.staff.length, appointments: old.appointments.length }
  if (read) Object.assign(counts, { cleanClients: read.clients.length, realServices: read.services.length, products: read.products.length, realBookings: read.bookings.length, packages: read.clients.reduce((a, c) => a + c.packages.length, 0) })
  if (stage === 'done') Object.assign(counts, { inIdle: { clients: store.clients.length, services: store.services.length, products: store.products.length, team: store.staff.length, packages: store.packages.length, bookings: store.bookings.length } })
  const out = { counts, oldApp: { customers: old.customers, services: old.services, staff: old.staff, appointments: old.appointments, terms: old.terms, sales: old.sales } }
  if (read) out.cleaned = cleanedNow()
  if (stage === 'done') out.newApp = JSON.parse(recordsFor(store))
  return JSON.stringify(out)
}
function cleanedNow() {
  return {
    clients: read.clients.map(c => ({ name: c.name, vip: c.vip || undefined, alert: c.alert || undefined, credit: c.credit || undefined, packages: c.packages.length ? c.packages.map(p => `${p.name}, ${p.left} of ${p.of} left, paid $${p.paid}`) : undefined, visits: c.visits })),
    bookings: read.bookings.map(b => ({ date: b.date, time: b.time, client: b.client, service: b.service, with: b.staff })),
    services: read.services.map(s => ({ name: s.name, category: s.category, minutes: s.minutes, price: s.price, deposit: s.deposit || undefined, buffer: s.buffer || undefined })),
    products: read.products,
    staff: read.staff.map(s => ({ name: s.name, does: s.does })),
  }
}
$('chat-form').addEventListener('submit', async e => {
  e.preventDefault()
  const message = $('chat-q').value.trim()
  if (!message) return
  $('chat-q').value = ''
  if (wantNeeds) return wantNeeds(message)
  const reply = $('chat-reply')
  reply.hidden = false
  reply.innerHTML = `<b>You:</b> ${esc(message)}<br><i>Boo is thinking...</i>`
  const open = findings && ['touring', 'found', 'deciding', 'cleaning'].includes(stage)
  const out = await chatBoo({ message, stage: STAGES[stage], decisions: open ? findings : [], records: recordsNow() })
  const note = honest(out.reply, act(out)).join(' · ')
  reply.innerHTML = `<b>You:</b> ${esc(message)}<br><b>Boo ${gem(true, out.model)}:</b> ${esc(out.reply)}${note ? `<br><em>${esc(note)}</em>` : ''}`
  speak(out.reply, 5000)
})
$('haunt-toggle').addEventListener('click', () => openChat())

/** The chat opens next to Boo, wherever Boo is. question/chips: Boo asking you something. */
function openChat({ question = '', chips = [] } = {}) {
  const box = $('chat-pop')
  box.hidden = false
  $('chat-ask').textContent = question || "Hi! Ask me anything, or tell me what I got wrong."
  $('chat-chips').innerHTML = chips.map(c => `<button type="button">${esc(c)}</button>`).join('')
  $('chat-chips').hidden = !chips.length
  $('chat-reply').hidden = true
  $('chat-q').placeholder = question ? 'Or type your own…' : 'Ask Boo, or tell it what to fix'
  box.style.right = 'auto'
  holdStill()
  cancelAnimationFrame(chatFollow)
  const follow = () => {
    placeChat()
    if (!box.hidden) chatFollow = requestAnimationFrame(follow)
  }
  follow()
  $('chat-q').focus({ preventScroll: true })
}

/** While Boo is talking to you, it stays put under its bubble. */
function holdStill() {
  if (!pet || $('chat-pop').hidden) return
  const b = pet.box
  pet.handle({ type: 'goto', x: b.x, y: b.y })
}
let chatFollow = 0
/** The bubble sits just above Boo (or below, near the top) and follows if you drag Boo. */
function placeChat() {
  const box = $('chat-pop')
  const b = pet ? pet.box : boo.box
  const frame = rect(document.querySelector('.browser'))
  const w = box.offsetWidth || 360
  const h = box.offsetHeight || 200
  const bx = b.x - frame.left
  const by = b.y - frame.top
  const fit = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
  let left = fit(bx - w / 2 + 32, 10, frame.width - w - 10)
  let top
  let side = 'above'
  if (by - h - 14 >= 50) top = by - h - 14
  else if (by + 80 + h <= frame.height - 10) (top = by + 80), (side = 'below')
  else {
    // No room above or below: sit beside Boo, fully inside the window.
    side = bx + 64 + 16 + w <= frame.width - 10 ? 'right' : 'left'
    left = side === 'right' ? bx + 64 + 16 : fit(bx - w - 16, 10, frame.width - w - 10)
    top = fit(by + 32 - h / 2, 50, frame.height - h - 10)
  }
  box.style.left = `${left}px`
  box.style.top = `${fit(top, 10, frame.height - h - 10)}px`
  box.dataset.side = side
  box.classList.toggle('below', side === 'below')
  // The tail points at Boo even when the bubble is pushed in from an edge.
  box.style.setProperty('--tail', `${fit(bx + 32 - left, 24, w - 24)}px`)
}
function closeChat() {
  $('chat-pop').hidden = true
  cancelAnimationFrame(chatFollow)
  pet?.handle({ type: 'release' })
}
$('chat-close').addEventListener('click', closeChat)
$('chat-start').addEventListener('click', () => startNeeds?.())
$('chat-chips').addEventListener('click', e => {
  const c = e.target.closest('button')
  if (!c) return
  $('chat-q').value = c.textContent
  $('chat-form').requestSubmit()
})

window.__haunt = { store, old, views, ui, feed: feedLines, boo, get read() { return read }, get findings() { return findings } }
