// The browser demo: Boo runs a small shop's front desk and back office
// across three apps, talks to you about the business, and moves clients out
// of old software. The thinking happens on the server (/api/think).

import { createBoo } from './boo.js'
import { createApps } from './apps.js'
import { domAdapter } from './adapter.js'
import { runAgent } from './lib/agent.js'
import { parseCsv, heuristicValues, recordName } from './lib/mapping.js'

const $ = id => document.getElementById(id)
const pause = ms => new Promise(r => setTimeout(r, ms))
const TASKBAR = 44
const wide = () => window.innerWidth > 1100

// ------------------------------------------------------------- windows

const allWindows = [...document.querySelectorAll('.window')]
const appWindows = () => allWindows.filter(w => w.classList.contains('app'))
let z = 10

function arrange() {
  if (!wide()) return
  const W = window.innerWidth
  const at = (name, left, top) => {
    const w = winFor(name)
    w.style.left = `${left}px`
    w.style.top = `${top}px`
  }
  at('Boo', 16, 16)
  at('Messages', 372, 84)
  at('Bloom Booking', Math.round(372 + (W - 372 - 16 - 400) / 2), 28)
  at('Back office', W - 416, 290)
}

const winFor = name => allWindows.find(w => w.dataset.app === name)

function focusWindow(win) {
  win.hidden = false
  win.style.zIndex = String(++z)
}

allWindows.forEach(win => {
  win.style.zIndex = String(++z)
  win.addEventListener('pointerdown', () => (win.style.zIndex = String(++z)))
  const bar = win.querySelector('[data-drag]')
  bar.addEventListener('pointerdown', e => {
    if (!wide() || e.target.closest('button')) return
    bar.setPointerCapture(e.pointerId)
    const r = win.getBoundingClientRect()
    const dx = e.clientX - r.left
    const dy = e.clientY - r.top
    const move = ev => {
      win.style.left = `${Math.max(-r.width + 80, Math.min(window.innerWidth - 80, ev.clientX - dx))}px`
      win.style.top = `${Math.max(0, Math.min(window.innerHeight - TASKBAR - 40, ev.clientY - dy))}px`
    }
    const up = () => {
      bar.removeEventListener('pointermove', move)
      bar.removeEventListener('pointerup', up)
    }
    bar.addEventListener('pointermove', move)
    bar.addEventListener('pointerup', up)
  })
})
document.querySelectorAll('[data-open]').forEach(b => b.addEventListener('click', () => focusWindow(winFor(b.dataset.open))))
$('legacy-close').addEventListener('click', () => (winFor('ClinicMaster 98').hidden = true))
arrange()
window.addEventListener('resize', arrange)

// ------------------------------------------------------------- the apps and Boo

const apps = createApps({ onChange: () => renderJobs() })

const boo = createBoo({
  windows: () => allWindows.filter(w => !w.hidden).sort((a, b) => Number(b.style.zIndex) - Number(a.style.zIndex)),
  bounds: () => ({ x: 0, y: 0, w: window.innerWidth, h: window.innerHeight - TASKBAR }),
  onClick: () => {},
})

/** Where on screen an element is, for Boo to hover beside. */
const spot = el => {
  const r = el.getBoundingClientRect()
  return { x: r.left, y: r.top, h: r.height }
}

const hands = domAdapter({
  windows: appWindows,
  beforeAct: async (el, action) => {
    focusWindow(el.closest('.window'))
    el.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    boo.handle({ type: 'guide', ...spot(el), text: currentThought || 'Working' })
    await pause(action.type === 'type' ? 380 : 520)
  },
})

// ------------------------------------------------------------- talking

const chat = $('chat')
const speakBox = $('speak')

function log(kind, text) {
  const li = document.createElement('li')
  li.className = kind
  li.textContent = text
  chat.appendChild(li)
  chat.scrollTop = chat.scrollHeight
  return li
}

function speak(text) {
  if (!speakBox.checked || !('speechSynthesis' in window)) return
  speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text.replace(/[^\p{L}\p{N}\s.,!?'$:-]/gu, ''))
  u.pitch = 1.6
  u.rate = 1.05
  const voice = speechSynthesis.getVoices().find(v => /^en(-|_)/i.test(v.lang) && /female|zira|samantha|aria|jenny/i.test(v.name))
  if (voice) u.voice = voice
  speechSynthesis.speak(u)
}

/** Boo says something to you: bubble, chat, and out loud. */
function booSays(text, tone = 'say') {
  log('from-boo', text)
  boo.handle({ type: tone === 'done' ? 'done' : 'say', text })
  speak(text)
}

// ------------------------------------------------------------- the brain

let currentThought = ''
let running = false
const queue = []

async function think(input) {
  const res = await fetch('/api/think', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data.action) throw new Error(data.error || 'My brain is busy right now. Try again in a minute.')
  return data
}

async function approve(description) {
  if ($('autopilot').checked) return true
  const question = `${description}?`
  const li = log('from-boo ask', question)
  const row = document.createElement('div')
  row.className = 'row'
  row.innerHTML = '<button type="button" data-answer="yes">Yes</button><button type="button" data-answer="no">No</button>'
  li.appendChild(row)
  speak(question.replace(/"/g, ''))
  row.addEventListener('click', e => {
    const b = e.target.closest('[data-answer]')
    if (b) boo.answer(b.dataset.answer === 'yes')
  })
  const yes = await boo.ask(question)
  row.remove()
  li.append(yes ? ' Yes.' : ' No.')
  return yes
}

/** Run one goal with the agent. Goals queue up and run one at a time. */
function run(goal, { label, onDone } = {}) {
  return new Promise(resolve => {
    queue.push({ goal, label, onDone, resolve })
    if (!running) next()
  })
}

async function next() {
  const job = queue.shift()
  if (!job) {
    running = false
    return
  }
  running = true
  if (job.label) log('step', job.label)
  boo.handle({ type: 'start', text: job.label || 'On it' })
  const result = await runAgent({
    goal: job.goal,
    adapter: hands,
    think,
    approve,
    onStep: s => {
      currentThought = s.thought || s.description
      if (s.kind === 'act') log('step', s.thought || s.description)
      if (s.kind === 'say') booSays(s.action.text)
    },
  })
  boo.handle({ type: 'release' })
  currentThought = ''
  if (result.ok) booSays(result.summary, job.onDone ? 'say' : 'done')
  else {
    log('from-boo', result.summary)
    boo.handle({ type: 'fail', text: result.summary })
    speak(result.summary)
  }
  job.onDone?.(result)
  job.resolve(result)
  next()
}

// ------------------------------------------------------------- what Boo noticed

function jobsFromState(state) {
  const jobs = []
  for (const [name, chatState] of state.chats) {
    const last = chatState.messages.at(-1)
    if (last?.from === 'them') {
      jobs.push({
        key: `chat:${name}`,
        text: `New message from ${name}`,
        goal: `Handle the newest message from ${name} in Messages. Open their chat, read it, check the calendar, their client notes and the store rules, do what they ask if the store can, then reply to them in the chat.`,
      })
    }
  }
  const low = state.stock.filter(s => s.count < s.low && !s.ordered)
  if (low.length) {
    jobs.push({ key: 'stock', text: `${low.map(s => s.item).join(' and ')} running low`, goal: 'Some stock is running low. Open Back office, go to Stock, and reorder anything marked low.' })
  }
  const unanswered = state.reviews.filter(r => !r.reply)
  if (unanswered.length) {
    jobs.push({
      key: 'reviews',
      text: `${unanswered.length} review${unanswered.length > 1 ? 's' : ''} waiting for a reply`,
      goal: 'Open Back office, go to Reviews, and reply to each review that has no reply yet, then post it. Thank kind reviews warmly by name. For a complaint, apologise and say what the shop will do about it. Two short sentences each.',
    })
  }
  if (!state.payrollRun) {
    jobs.push({ key: 'payroll', text: 'Payroll due Friday', goal: 'Open Back office, go to Staff and payroll, check the hours, then run payroll for this week.' })
  }
  return jobs
}

const doing = new Set()
function renderJobs() {
  const jobs = jobsFromState(apps.state)
  const list = $('jobs')
  list.innerHTML = ''
  if (jobs.length === 0) {
    list.innerHTML = '<li class="empty">All caught up.</li>'
  }
  for (const job of jobs) {
    const li = document.createElement('li')
    li.className = doing.has(job.key) ? 'doing' : ''
    li.innerHTML = `<span></span><button type="button" class="btn">${doing.has(job.key) ? 'Doing' : 'Handle it'}</button>`
    li.querySelector('span').textContent = job.text
    li.querySelector('button').disabled = doing.has(job.key)
    li.querySelector('button').addEventListener('click', () => handle(job))
    list.appendChild(li)
  }
  $('handle-all').disabled = jobs.every(j => doing.has(j.key)) || jobs.length === 0
}

function handle(job) {
  if (doing.has(job.key)) return
  doing.add(job.key)
  renderJobs()
  return run(job.goal, { label: job.text }).finally(() => {
    doing.delete(job.key)
    renderJobs()
  })
}

$('handle-all').addEventListener('click', () => jobsFromState(apps.state).forEach(handle))

// ------------------------------------------------------------- asking Boo

function ask(question) {
  question = question.trim()
  if (!question) return
  log('from-you', question)
  $('ask').value = ''
  run(
    `The person at the shop asked you: "${question}". If it is a question, look in the apps to find the answer. You may click tabs and days to look, but do not change anything they did not ask for. Then finish with done and put the answer in text, in one or two short, friendly sentences with the actual numbers or names. If it is a request, do it.`,
    { onDone: () => {} },
  )
}

$('ask-form').addEventListener('submit', e => {
  e.preventDefault()
  ask($('ask').value)
})
document.querySelectorAll('[data-ask]').forEach(b => b.addEventListener('click', () => ask(b.dataset.ask)))

// Talking out loud, where the browser supports it.
const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition
if (Recognition) {
  const mic = $('mic')
  mic.hidden = false
  let listening = null
  mic.addEventListener('click', () => {
    if (listening) return listening.stop()
    listening = new Recognition()
    listening.lang = 'en-US'
    listening.interimResults = false
    mic.classList.add('listening')
    boo.handle({ type: 'say', text: 'I am listening.' })
    listening.onresult = e => ask(e.results[0][0].transcript)
    listening.onend = () => {
      mic.classList.remove('listening')
      listening = null
    }
    listening.start()
  })
}

// ------------------------------------------------------------- migration from ClinicMaster 98

const EXPORT = `Full Name,HP,E-mail,DOB,Pet,Breed,Preferred Groomer,Remarks
Priya Nair,+65 8678 9012,priya.n@example.com,11/01/1995,Mango,Cavapoo,Hana,"First groom was stressful. Go slow."
Ken Wong,+65 9789 0123,ken.wong@example.com,03/06/1983,Bao,Corgi,Tom,"Sheds a lot. Deshed every 6 weeks."
Aisha Rahman,+65 8890 1234,aisha.r@example.com,27/09/1990,Simba,Persian cat,Hana,"Matting behind ears. Cat only room."
Lily Chua,+65 9901 2345,lily.chua@example.com,15/02/1998,Coco,Maltese,Hana,"Allergic to lavender products."`
const legacy = parseCsv(EXPORT)
$('legacy-head').innerHTML = legacy.headers.map(h => `<th>${h}</th>`).join('')
$('legacy-rows').innerHTML = legacy.rows.map(r => `<tr>${legacy.headers.map(h => `<td>${r[h]}</td>`).join('')}</tr>`).join('')
$('legacy-status').textContent = `${legacy.rows.length} records`

async function typeInto(el, value) {
  el.focus({ preventScroll: true })
  if (el.tagName === 'SELECT') {
    const opt = [...el.options].find(o => o.text.toLowerCase() === value.toLowerCase())
    if (opt) el.value = opt.value
    return pause(250)
  }
  el.value = ''
  for (const ch of value) {
    el.value += ch
    await pause(value.length > 40 ? 6 : 18)
  }
}

let migrating = false
$('migrate').addEventListener('click', async () => {
  if (migrating) return
  migrating = true
  $('migrate').disabled = true
  const trs = [...$('legacy-rows').children]
  booSays(`Moving ${legacy.rows.length} clients out of ClinicMaster 98.`)
  await pause(1200)
  for (let i = 0; i < legacy.rows.length; i++) {
    const row = legacy.rows[i]
    trs[i].classList.add('reading')
    focusWindow(winFor('ClinicMaster 98'))
    boo.handle({ type: 'guide', ...spot(trs[i]), text: `Client ${i + 1} of ${legacy.rows.length}: ${recordName(row)}` })
    await pause(900)
    focusWindow(winFor('Bloom Booking'))
    const form = apps.showClientForm()
    const controls = [...form.querySelectorAll('input, select, textarea')]
    const fields = controls.map((el, index) => ({
      index,
      type: el.tagName === 'SELECT' ? 'ComboBox' : 'Edit',
      label: el.closest('label').childNodes[0].textContent.trim(),
      id: el.name,
      el,
    }))
    const values = heuristicValues(row, legacy.headers, fields)
    for (const f of fields) {
      if (!values[f.index]) continue
      f.el.scrollIntoView({ block: 'nearest' })
      boo.handle({ type: 'guide', ...spot(f.el), text: `${f.label}: ${values[f.index]}` })
      await pause(420)
      await typeInto(f.el, values[f.index])
    }
    const save = form.querySelector('button[type="submit"]')
    boo.handle({ type: 'guide', ...spot(save), text: `Saving ${recordName(row)}` })
    await pause(500)
    form.requestSubmit()
    trs[i].classList.remove('reading')
    trs[i].classList.add('moved')
    await pause(400)
  }
  boo.handle({ type: 'release' })
  booSays(`${legacy.rows.length} clients moved into Bloom Booking.`, 'done')
})

// ------------------------------------------------------------- start

renderJobs()
setTimeout(() => {
  const n = jobsFromState(apps.state).length
  booSays(`Boo! I am your front desk. I noticed ${n} things that need doing. Ask me anything, or let me handle them.`)
}, 1200)

const tick = () => ($('clock').textContent = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }))
tick()
setInterval(tick, 30_000)
