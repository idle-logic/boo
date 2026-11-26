// Haunt in the browser: a small business's desktop that runs itself.
// Boo catches what the apps throw at you, sends its crew to handle the routine,
// and shows you one calm sentence plus anything that truly needs you.

import { createDesktop } from './os.js'
import { createApps } from './apps.js'
import { createBoo } from './boo.js'
import { createCrew } from './crew.js'
import { TIMELINE, OPEN, CLOSE, MS_PER_MINUTE, clock, plan } from './day.js'
import { parseCsv, heuristicValues, recordName } from './lib/mapping.js'

const $ = id => document.getElementById(id)
const pause = ms => new Promise(r => setTimeout(r, ms))

const desktop = createDesktop()
const apps = createApps({ inbox: [], reviews: [], onChange: () => render() })

const bounds = () => {
  const d = $('desktop').getBoundingClientRect()
  return { x: 0, y: 0, w: d.width, h: d.height }
}
const mother = createBoo({ windows: desktop.standable, bounds, onClick: () => {} })

// ------------------------------------------------------------- the brain

// The free AI tier sometimes says "busy". Wait a little and try again before giving up.
const RETRY_WAITS_MS = [1500, 4000, 8000]

async function think(input) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch('/api/think', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    }).catch(() => null)
    const data = res ? await res.json().catch(() => ({})) : {}
    if (res?.ok && (data.action || data.actions)) return data
    const busy = !res || res.status === 429 || res.status === 503
    if (!busy || attempt >= RETRY_WAITS_MS.length) throw new Error(data.error || 'My brain is busy right now. Try again in a minute.')
    await pause(RETRY_WAITS_MS[attempt])
  }
}

/** What day it is, so "tomorrow" and "Friday" mean the right thing. */
function dateContext() {
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)
  const label = d => d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
  const long = d => d.toLocaleDateString('en-GB', { weekday: 'long' })
  return `Today is ${long(today)}, ${label(today)} in the calendar. Tomorrow is ${long(tomorrow)}, ${label(tomorrow)}. The shop is closed on Sundays.`
}

const ROUTINES = {
  message: 'answering messages',
  stock: 'reordering stock',
  review: 'replying to reviews',
  sick: 'covering a sick day',
  refund: 'replying about refunds',
  payroll: 'running payroll',
}

// ------------------------------------------------------------- the day's record

const stats = { handled: 0, caught: 0, replies: 0, replySeconds: [], bookingsAtStart: 0, youDecided: 0, failed: 0 }
const learned = new Map() // job kind -> what worked last time
const needs = [] // decisions waiting for the person
let minute = null // shop time while the day runs
let dayDone = false

const activity = $('activity')
function note(text) {
  const li = document.createElement('li')
  li.textContent = minute === null ? text : `${clock(minute)} ${text}`
  activity.prepend(li)
}

/** Boo says one line. Out loud only when sound is on and it matters. */
function booSays(text, { loud = false, tone = 'say' } = {}) {
  mother.handle({ type: tone, text })
  if (loud && $('speak').checked && 'speechSynthesis' in window) {
    speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text.replace(/[^\p{L}\p{N}\s.,!?'$:-]/gu, ''))
    u.pitch = 1.5
    u.rate = 1.05
    speechSynthesis.speak(u)
  }
}

const crew = createCrew({
  desktop,
  mother,
  think,
  context: dateContext,
  onChange: () => render(),
  onJobDone: (job, result) => {
    if (job.kind === 'question') return
    if (result.ok) {
      stats.handled++
      if (job.kind === 'message' || job.kind === 'refund') {
        stats.replies++
        // Real seconds from the message landing to the reply being sent.
        if (job.arrivedReal != null) stats.replySeconds.push((performance.now() - job.arrivedReal) / 1000)
      }
      note(result.summary)
      if (!learned.has(job.kind)) {
        const steps = result.history.filter(h => h.thought && !h.error).map(h => h.thought).slice(0, 6)
        if (steps.length) {
          learned.set(job.kind, steps.map((t, i) => `${i + 1}. ${t}`).join('\n'))
          note(`Learned a routine: ${ROUTINES[job.kind] ?? job.title.toLowerCase()}. Next time is quicker.`)
        }
      }
    } else {
      stats.failed++
      addNeed({ title: `I could not finish: ${job.title.toLowerCase()}`, detail: result.summary, handOnly: true, app: job.apps[0] })
    }
    render()
  },
})

// ------------------------------------------------------------- needs you

function addNeed(item) {
  needs.push(item)
  render()
  booSays(item.title, { loud: true })
}

function renderNeeds() {
  const list = $('needs')
  list.innerHTML = ''
  if (needs.length === 0) {
    const li = document.createElement('li')
    li.className = 'clear'
    li.textContent = minute === null && !dayDone ? 'Nothing yet.' : 'Nothing needs you. I have got the rest.'
    list.appendChild(li)
    return
  }
  for (const item of needs) {
    const li = document.createElement('li')
    li.innerHTML = '<p><strong></strong><br><span></span></p><div class="row"></div>'
    li.querySelector('strong').textContent = item.title
    li.querySelector('span').textContent = item.detail
    const row = li.querySelector('.row')
    if (item.job) {
      const yes = document.createElement('button')
      yes.type = 'button'
      yes.className = 'btn primary'
      yes.textContent = item.yes
      yes.addEventListener('click', () => {
        needs.splice(needs.indexOf(item), 1)
        stats.youDecided++
        note(`You said yes: ${item.yes.toLowerCase()}.`)
        crew.add({ ...item.job, hint: learned.get(item.job.kind), arrivedReal: performance.now() })
        render()
      })
      row.appendChild(yes)
    }
    const mine = document.createElement('button')
    mine.type = 'button'
    mine.className = 'btn'
    mine.textContent = item.handOnly ? 'Got it' : 'I will handle it'
    mine.addEventListener('click', () => {
      needs.splice(needs.indexOf(item), 1)
      stats.youDecided++
      note(`You took: ${item.title.toLowerCase()}.`)
      render()
    })
    row.appendChild(mine)
    list.appendChild(li)
  }
}

// ------------------------------------------------------------- the one calm sentence

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

function render() {
  renderNeeds()
  const working = crew.working.filter(j => j.kind !== 'question')
  const handled = stats.handled
  let headline
  let subline
  if (minute === null && !dayDone) {
    headline = 'Good morning. Nothing needs you yet.'
    subline = 'Press Start the day and I will look after the shop.'
  } else if (dayDone) {
    headline = needs.length ? `Day done. ${plural(needs.length, 'thing')} still waiting for you.` : `Day done. ${plural(handled, 'thing')} handled.`
    subline = endOfDay()
  } else {
    headline = needs.length
      ? `${plural(needs.length, 'thing')} need${needs.length === 1 ? 's' : ''} you.`
      : handled
        ? `All good. ${plural(handled, 'thing')} handled since 9.`
        : 'All good so far.'
    subline = working.length
      ? `${clock(minute)}. ${working.length === 1 ? 'A ghost is' : `${working.length} ghosts are`} on it: ${working.map(j => j.title.toLowerCase()).join(', ')}.`
      : `${clock(minute)}. Quiet right now.`
  }
  $('headline').textContent = headline
  $('subline').textContent = subline

  const avg = average(stats.replySeconds)
  const bookings = Math.max(0, apps.state.bookings.length - stats.bookingsAtStart)
  $('numbers').innerHTML = [
    ['Handled for you', handled],
    ['Notifications caught', stats.caught],
    ['Messages answered', stats.replies],
    ['Average reply', avg === null ? '–' : `${avg} sec`],
    ['Bookings made', bookings],
    ['Routines learned', learned.size],
  ]
    .map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`)
    .join('')
}

const average = list => (list.length ? Math.round(list.reduce((a, b) => a + b, 0) / list.length) : null)

function endOfDay() {
  const avg = average(stats.replySeconds)
  const replies = avg === null ? `${plural(stats.replies, 'message')} answered` : `${plural(stats.replies, 'message')} answered, ${avg} seconds each on average`
  return `${replies}. ${plural(stats.caught, 'notification')} caught before they reached you. You made ${plural(stats.youDecided, 'call')}, and I did the rest.`
}

// ------------------------------------------------------------- the day

async function happen(event) {
  const { job, decision, toast } = plan(event)
  if (event.kind === 'message' || event.kind === 'refund') apps.customerSays(event.from, event.text)
  if (event.kind === 'sale') apps.sell(event.item, 1, event.client, event.amount)
  if (event.kind === 'review') apps.addReview(event.review)

  // The app pings. A ghost catches it before it reaches you.
  if (toast) {
    const el = desktop.toast(toast)
    stats.caught++
    const li = document.createElement('li')
    li.textContent = `${clock(minute)} ${toast.title}: ${toast.text}`
    $('caught').prepend(li)
    crew.catchToast(el)
  }
  await pause(900)
  if (job) crew.add({ ...job, hint: learned.get(job.kind), arrivedReal: performance.now() })
  if (decision) addNeed({ ...decision, app: decision.job?.apps[0] })
}

function startDay() {
  if (minute !== null) return
  $('run-day').disabled = true
  $('run-day').textContent = 'Running the day'
  minute = OPEN
  stats.bookingsAtStart = apps.state.bookings.length
  desktop.holdClock(true)
  booSays('Opening up. I will tell you if anything needs you.')
  let next = 0
  const tick = setInterval(() => {
    minute++
    $('clock').textContent = clock(minute)
    while (next < TIMELINE.length && TIMELINE[next].at <= minute) happen(TIMELINE[next++])
    if (minute % 5 === 0) render()
    if (minute >= CLOSE) {
      clearInterval(tick)
      finishDay()
    }
  }, MS_PER_MINUTE)
  render()
}

async function finishDay() {
  // Let the crew finish what they started.
  while (!crew.idle) await pause(500)
  dayDone = true
  $('run-day').textContent = 'Day done'
  render()
  booSays(`Closed up. ${plural(stats.handled, 'thing')} handled. ${needs.length ? `${plural(needs.length, 'thing')} still need you.` : 'Nothing is waiting for you.'}`, {
    loud: true,
    tone: needs.length ? 'say' : 'done',
  })
}

$('run-day').addEventListener('click', startDay)
$('focus').addEventListener('click', () => {
  const target = needs[0]?.app
  desktop.focusOn(target && target !== 'Phone' ? target : 'Boo')
  booSays(target ? 'Here is the one thing that needs you.' : 'Everything else is tucked away.')
})

// ------------------------------------------------------------- ask Boo

async function ask(question) {
  question = question.trim()
  if (!question) return
  $('ask').value = ''
  $('answer').textContent = 'Looking…'
  const result = await crew.add({
    kind: 'question',
    title: 'Answer your question',
    apps: ['Messages', 'Bloom Booking', 'Back office'],
    goal: `The person at the shop asked: "${question}". If it is a question, look in the apps to find the answer. You may click sections and days to look, but do not change anything they did not ask for. Then finish with done, with the answer in one or two short, friendly sentences with the actual numbers or names. If it is a request, do it.`,
  })
  $('answer').textContent = result.summary
  booSays(result.summary, { loud: true })
}
$('ask-form').addEventListener('submit', e => {
  e.preventDefault()
  ask($('ask').value)
})

const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition
if (Recognition) {
  const mic = $('mic')
  mic.hidden = false
  let listening = null
  mic.addEventListener('click', () => {
    if (listening) return listening.stop()
    listening = new Recognition()
    listening.lang = 'en-US'
    mic.classList.add('listening')
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
    return pause(220)
  }
  el.value = ''
  for (const ch of value) {
    el.value += ch
    await pause(value.length > 40 ? 6 : 16)
  }
}

const spot = el => {
  const r = el.getBoundingClientRect()
  return { x: r.left, y: r.top, h: r.height }
}

$('migrate').addEventListener('click', async () => {
  $('migrate').disabled = true
  const trs = [...$('legacy-rows').children]
  booSays(`Moving ${legacy.rows.length} clients out of ClinicMaster 98.`)
  await pause(900)
  for (let i = 0; i < legacy.rows.length; i++) {
    const row = legacy.rows[i]
    trs[i].classList.add('reading')
    desktop.open('ClinicMaster 98')
    mother.handle({ type: 'guide', ...spot(trs[i]), text: `${i + 1} of ${legacy.rows.length}: ${recordName(row)}` })
    await pause(800)
    desktop.open('Bloom Booking')
    const form = apps.showClientForm()
    const controls = [...form.querySelectorAll('input, select, textarea')]
    const fields = controls.map((el, index) => ({ index, type: el.tagName === 'SELECT' ? 'ComboBox' : 'Edit', label: el.closest('label').childNodes[0].textContent.trim(), id: el.name, el }))
    const values = heuristicValues(row, legacy.headers, fields)
    for (const f of fields) {
      if (!values[f.index]) continue
      f.el.scrollIntoView({ block: 'nearest' })
      mother.handle({ type: 'guide', ...spot(f.el), text: '' })
      await pause(380)
      await typeInto(f.el, values[f.index])
    }
    const save = form.querySelector('button[type="submit"]')
    mother.handle({ type: 'guide', ...spot(save), text: '' })
    await pause(420)
    form.requestSubmit()
    trs[i].classList.remove('reading')
    trs[i].classList.add('moved')
  }
  mother.handle({ type: 'release' })
  booSays(`${legacy.rows.length} clients moved into Bloom Booking.`, { tone: 'done' })
})

// ------------------------------------------------------------- start

render()
setTimeout(() => booSays('Boo! I look after the shop so you do not have to.'), 1000)

// A little state for checking the build.
window.__haunt = { stats, needs, crew, apps, get minute() { return minute } }
