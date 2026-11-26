// Haunt in the browser: a small business's desktop that runs itself.
// Boo catches what the apps throw at you, sends its crew to handle the routine,
// and shows you one calm sentence plus anything that truly needs you.

import { createDesktop } from './os.js'
import { createApps } from './apps.js'
import { createBoo, burst, CONFETTI } from './boo.js'
import { createCrew } from './crew.js'
import { TIMELINE, OPEN, CLOSE, MS_PER_MINUTE, clock, plan } from './day.js'
import { icon } from './icons.js'
import { createLegacy } from './legacy.js'
import { createReborn, useIcons } from './reborn.js'
import { createDriver } from './driver.js'
import { explore } from './explore.js'
import { buildSpec, specFiles } from './spec.js'
import { makeScenarios, prove, learnMissedRule } from './parity.js'
import { booIsBorn, riseWindow, sinkWindow } from './rebirth.js'
import { zip } from './zip.js'

const $ = id => document.getElementById(id)
const pause = ms => new Promise(r => setTimeout(r, ms))

const desktop = createDesktop()
const apps = createApps({ inbox: [], reviews: [], onChange: () => render() })

const bounds = () => {
  const d = $('desktop').getBoundingClientRect()
  return { x: 0, y: 0, w: d.width, h: d.height }
}
// Boo and its crew arrive once Boo has climbed out of its grave (see boot below).
let mother = null
let crew = null

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
let rebirthLine = null // the calm headline while old software is being reborn
let dayDone = false

const activity = $('activity')
function note(text) {
  const li = document.createElement('li')
  li.textContent = minute === null ? text : `${clock(minute)} ${text}`
  activity.prepend(li)
}

/** Boo says one line. Out loud only when sound is on and it matters. */
function booSays(text, { loud = false, tone = 'say' } = {}) {
  // 'cheer' is a happy line with confetti, without the sticky "Done!" bubble.
  mother?.handle({ type: tone === 'cheer' ? 'say' : tone, text })
  if (tone === 'cheer' && mother) {
    const c = mother.centre()
    burst(c.x, c.y - 20, 40, CONFETTI)
  }
  if (loud && $('speak').checked && 'speechSynthesis' in window) {
    speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text.replace(/[^\p{L}\p{N}\s.,!?'$:-]/gu, ''))
    u.pitch = 1.5
    u.rate = 1.05
    speechSynthesis.speak(u)
  }
}

const makeCrew = () => createCrew({
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
  $('needs').scrollIntoView({ block: 'nearest', behavior: 'smooth' })
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
    for (const choice of item.choices ?? []) {
      const b = document.createElement('button')
      b.type = 'button'
      b.className = `btn${choice.primary ? ' primary' : ''}`
      b.textContent = choice.label
      b.addEventListener('click', () => {
        needs.splice(needs.indexOf(item), 1)
        stats.youDecided++
        note(`You chose: ${choice.label.toLowerCase()}.`)
        render()
        choice.run()
      })
      row.appendChild(b)
    }
    if (item.choices) {
      list.appendChild(li)
      continue
    }
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
  const working = (crew?.working ?? []).filter(j => j.kind !== 'question')
  const handled = stats.handled
  let headline
  let subline
  if (minute === null && !dayDone && rebirthLine) {
    ;[headline, subline] = rebirthLine
  } else if (minute === null && !dayDone) {
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
  if (minute !== null || !crew) return
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
  while (!crew?.idle) await pause(500)
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
  if (!question || !crew) return
  $('ask').value = ''
  $('answer').textContent = 'Looking…'
  const result = await crew.add({
    kind: 'question',
    title: 'Answer your question',
    apps: ['Idle DMs', 'Idle Bookings', 'Idle Back office'],
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

// ------------------------------------------------------------- reincarnation
// Possess ClinicMaster 98, learn its rules, write the spec, raise it again in
// Idle's look, move the records in, prove the two behave the same, then let
// the old one rest.

const legacyWin = desktop.byName('ClinicMaster 98')
const rebornWin = desktop.byName('ClinicMaster Reborn')
const specWin = desktop.byName('Spec')
const legacy = createLegacy(legacyWin.querySelector('.legacy-app'))
useIcons(icon)
let reborn = null
let spec = null
let files = null
let busy = false

const STEP_LINES = {
  possess: 'Learning ClinicMaster 98.',
  spec: 'Writing the spec.',
  rise: 'Raising the new app.',
  move: 'Moving the records in.',
  prove: 'Proving it works the same.',
  rest: 'The new app is ready.',
}
function step(name, state, detail = '') {
  const li = document.querySelector(`#steps [data-step="${name}"]`)
  li.dataset.state = state
  li.querySelector('small').textContent = detail
  if (state === 'now' || state === 'wait') {
    rebirthLine = [state === 'wait' ? 'One thing needs you.' : STEP_LINES[name], detail || 'Nothing else needs you.']
  }
  if (name === 'rest' && state === 'done') rebirthLine = ['ClinicMaster 98 is at rest.', 'The new app holds every record. Press Start the day and I will run the shop.']
  render()
}

/** A ghost's hands on a window: it flies to each thing before pressing it. */
function hands(win, ghost, delay) {
  return createDriver(win.querySelector('.window-body'), {
    touch: async (el, text) => {
      desktop.focusFor(win)
      el.scrollIntoView({ block: 'nearest', inline: 'nearest' })
      const r = el.getBoundingClientRect()
      ghost.handle({ type: 'guide', x: r.left, y: r.top, h: r.height, text: delay() > 150 ? text ?? '' : '' })
      await pause(delay())
    },
    speed: () => Math.max(0.15, delay() / 300),
  })
}

const tidy = row => (row ?? []).map(c => String(c).replace(/[$,]/g, '').trim()).join(' | ')

function ruleLine(r) {
  const f = r.fields.join(' + ')
  if (r.kind === 'required') return `${f} is required`
  if (r.kind === 'digits') return `${f}: ${[r.length && `${r.length} digits`, r.first && `starts ${r.first.join('/')}`].filter(Boolean).join(', ')}`
  if (r.kind === 'date') return `${f}: DD/MM/YYYY`
  if (r.kind === 'closed') return 'Closed on Sundays'
  if (r.kind === 'unique') return `${f} must be unique`
  return `Rule ${r.code}`
}

// ---- the spec window

let specFile = 'requirements.md'
const escapeHtml = t => t.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c])
function mdHtml(text) {
  return escapeHtml(text)
    .split('\n')
    .map(line => {
      if (/^#{1,4} /.test(line)) return `<span class="md-h">${line}</span>`
      return line
        .replace(/^(\s*)- \[ \](\*?)/, '$1<span class="md-box">☐</span>$2')
        .replace(/\b(WHEN|THEN|SHALL|IF)\b/g, '<b class="md-k">$1</b>')
        .replace(/_([^_\n]+)_/g, '<i>$1</i>')
        .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    })
    .join('\n')
}
function renderSpec(reveal = 1) {
  const pre = $('spec-text')
  if (!files) {
    pre.textContent = 'Boo has not written the spec yet. Press "Reincarnate ClinicMaster 98" in Boo.'
    return
  }
  const text = files[specFile]
  pre.innerHTML = mdHtml(text.slice(0, Math.floor(text.length * reveal)))
}
async function writeSpecLive() {
  for (const file of ['requirements.md', 'design.md', 'tasks.md']) {
    selectSpecTab(file)
    for (let i = 1; i <= 14; i++) {
      renderSpec(i / 14)
      $('spec-text').parentElement.scrollTop = $('spec-text').parentElement.scrollHeight
      await pause(55)
    }
    await pause(350)
  }
  selectSpecTab('requirements.md')
  $('spec-text').parentElement.scrollTop = 0
}
function selectSpecTab(file) {
  specFile = file
  document.querySelectorAll('.spec-tabs [data-file]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.file === file)))
  renderSpec()
}
document.querySelectorAll('.spec-tabs [data-file]').forEach(b => b.addEventListener('click', () => selectSpecTab(b.dataset.file)))
$('spec-download').addEventListener('click', () => {
  if (!files) return
  const bytes = zip(Object.fromEntries(Object.entries(files).map(([name, text]) => [`.kiro/specs/clinicmaster-reborn/${name}`, text])))
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([bytes], { type: 'application/zip' }))
  a.download = 'clinicmaster-reborn-spec.zip'
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 2000)
})
renderSpec()

// ---- moving in

async function moveIn() {
  step('move', 'now', 'Reading every row')
  booSays('Moving the records in.')
  const ghost = crew.split()
  const oldDrive = hands(legacyWin, ghost, () => 200)
  const newDrive = hands(rebornWin, ghost, () => 200)
  const start = {}
  let moved = 0
  for (const s of spec.screens) {
    await oldDrive.goto(s.name)
    await newDrive.goto(s.name)
    const rows = oldDrive.rows()
    start[s.name] = rows
    const trs = [...legacyWin.querySelectorAll('[data-row]')]
    for (let i = 0; i < rows.length; i++) {
      trs[i]?.classList.add('reading')
      const r = trs[i].getBoundingClientRect()
      ghost.handle({ type: 'guide', x: r.left, y: r.top, h: r.height, text: '' })
      await pause(300)
      reborn.importRows(s.name, [rows[i]])
      const landed = [...rebornWin.querySelectorAll('[data-row]')].at(-1)
      if (landed) {
        const b = landed.getBoundingClientRect()
        ghost.handle({ type: 'guide', x: b.left, y: b.top, h: b.height, text: '' })
        landed.classList.add('arrived')
      }
      await pause(300)
      trs[i]?.classList.replace('reading', 'moved')
      step('move', 'now', `${++moved} records moved`)
    }
  }
  // Check every row reads the same in both apps.
  let same = 0
  let total = 0
  for (const s of spec.screens) {
    await newDrive.goto(s.name)
    const got = newDrive.rows()
    start[s.name].forEach((row, i) => {
      total++
      if (tidy(row) === tidy(got[i])) same++
    })
  }
  await oldDrive.goto(spec.screens[0].name)
  await newDrive.goto(spec.screens[0].name)
  ghost.handle({ type: 'release' })
  await crew.merge(ghost)
  step('move', 'done', `${moved} records. ${same} of ${total} rows read the same in both`)
  note(`Moved ${moved} records into the new app. Past invoices keep the totals they were charged.`)
  return start
}

// ---- proof

let lastProof = []
let freshN = 0
function freshUnique(screen) {
  const out = {}
  for (const r of spec.rules.filter(x => x.screen === screen.name && x.kind === 'unique')) {
    for (const f of r.fields) {
      freshN++
      const d = spec.rules.find(x => x.kind === 'digits' && x.fields[0] === f)
      out[f] = d ? `${d.first?.[0] ?? 9}${String(4000000 + freshN).slice(-((d.length ?? 8) - 1))}` : `Fresh ${f} ${freshN}`
    }
  }
  return out
}

function answer(res) {
  return res.code === 'ok' ? 'saved' : `error ${res.code}`
}

function diffLine(i, sc, a, b, verdict) {
  const list = $('diffs')
  if (list.children.length >= 5) {
    list.dataset.more = String(Number(list.dataset.more || 0) + 1)
    return
  }
  const li = document.createElement('li')
  const screen = spec.screens.find(s => s.name === sc.screen)
  if (verdict.kind === 'money') {
    const c = screen.columns.indexOf(spec.money.columns.tax)
    li.textContent = `Entry ${i + 1}, ${sc.values[spec.money.priceField]}: old GST ${a.row[c]}, new GST ${b.row[c].replace('$', '')}`
  } else {
    const shown = Object.entries(sc.values).filter(([, v]) => v).slice(0, 2).map(([k, v]) => `${k} "${v}"`).join(', ')
    li.textContent = `Entry ${i + 1} (${sc.why.toLowerCase()}): ${shown}. Old app ${answer(a)}, new app ${answer(b)}`
  }
  li.className = verdict.kind
  list.appendChild(li)
}

async function runPass(label, scenarios, oldDrive, newDrive, snaps) {
  let same = 0
  let differ = 0
  $('proof').hidden = false
  $('diffs').innerHTML = ''
  $('diffs').dataset.more = ''
  const results = await prove({
    spec,
    oldDrive,
    newDrive,
    scenarios,
    onResult: (i, sc, a, b, v) => {
      if (v.same || v.intended) same++
      else {
        differ++
        diffLine(i, sc, a, b, v)
      }
      $('proof-bar').style.width = `${((i + 1) / scenarios.length) * 100}%`
      $('proof-bar').classList.toggle('bad', differ > 0)
      $('proof-line').textContent = `${label}: entry ${i + 1} of ${scenarios.length}. ${same} the same${differ ? `, ${differ} different` : ''}.`
    },
  })
  legacy.restore(snaps.old)
  reborn.restore(snaps.new)
  lastProof = results
  return results
}

async function withProvers(delayMs, fn) {
  const gOld = crew.split()
  const gNew = crew.split()
  let delay = delayMs
  const out = await fn({
    oldDrive: hands(legacyWin, gOld, () => delay),
    newDrive: hands(rebornWin, gNew, () => delay),
    faster: ms => (delay = ms),
  })
  gOld.handle({ type: 'release' })
  gNew.handle({ type: 'release' })
  await Promise.all([crew.merge(gOld), crew.merge(gNew)])
  return out
}

async function proveIt(start) {
  step('prove', 'now', 'The same entries in both apps')
  const scenarios = makeScenarios(spec, start, { seed: 11, randomCount: 40 })
  const snaps = { old: legacy.snapshot(), new: reborn.snapshot() }
  booSays(`Proving it: ${scenarios.length} entries, made in both apps at once. Every rule from both sides, then random ones.`, { loud: true })
  const results = await withProvers(150, async ({ oldDrive, newDrive, faster }) => {
    let res = await runPass('Checking', scenarios, oldDrive, newDrive, snaps)
    const missed = res.filter(r => r.kind === 'missed')
    if (missed.length) {
      booSays(`ClinicMaster 98 refused ${missed.length === 1 ? 'an entry' : `${missed.length} entries`} my spec allowed. Finding the rule I missed.`, { loud: true })
      step('prove', 'now', 'Learning a rule I missed')
      faster(240)
      const rule = await learnMissedRule({ spec, drive: oldDrive, miss: missed[0], freshUnique })
      legacy.restore(snaps.old)
      if (rule) {
        reborn.setSpec(spec)
        files = specFiles(spec)
        renderSpec()
        note(`Learned a rule I missed: ${rule.fields[0]} can be ${rule.max} letters at most (error ${rule.code}). Added to the spec.`)
        const t = desktop.toast({ app: 'Spec', title: 'Rule learned from testing', text: `${rule.fields[0]}: ${rule.max} letters at most (error ${rule.code})` })
        setTimeout(() => t?.remove(), 7000)
        booSays(`Found it. ${rule.fields[0]} can only be ${rule.max} letters. It is in the spec now, and the new app follows it.`, { loud: true })
        await pause(1800)
      }
    }
    faster(30)
    if (missed.length) res = await runPass('Checking again', scenarios, oldDrive, newDrive, snaps)
    return res
  })
  const money = results.filter(r => r.kind === 'money' && !r.intended)
  const other = results.filter(r => !r.same && r.kind !== 'money')
  if (other.length) {
    step('prove', 'wait', `${other.length} entries behave differently`)
    addNeed({ title: `${other.length} entries behave differently`, detail: 'The list is under Prove it works the same. I would not switch yet.', handOnly: true })
    return
  }
  if (money.length) return askRounding(results, money, scenarios, snaps)
  finishProof(results)
}

function askRounding(results, money, scenarios, snaps) {
  const m = spec.money
  const screen = spec.screens.find(s => s.name === m.screen)
  const c = screen.columns.indexOf(m.columns.tax)
  const ex = money[0]
  step('prove', 'wait', `${results.length - money.length} the same. ${money.length} sales differ by a cent`)
  booSays('One thing needs you.', { loud: true })
  addNeed({
    title: 'ClinicMaster 98 rounds GST down',
    detail: `${ex.sc.values[m.priceField]}: the old app charged ${ex.a.row[c]} GST, the new app ${ex.b.row[c].replace('$', '')}. Rounding down collects less tax than is due. ${money.length} of the test sales differ by one cent. Past invoices stay as they were.`,
    app: 'Boo',
    choices: [
      { label: 'Round to the nearest cent', primary: true, run: () => decide('fix', scenarios, snaps) },
      { label: 'Keep rounding down', run: () => decide('keep', scenarios, snaps) },
    ],
  })
}

async function decide(choice, scenarios, snaps) {
  spec.money.decision = choice
  reborn.setSpec(spec)
  files = specFiles(spec)
  renderSpec()
  step('prove', 'now', 'Checking every entry again')
  booSays(choice === 'fix' ? 'Rounding to the nearest cent. Checking everything again.' : 'Keeping it the old way. Checking everything again.')
  const results = await withProvers(30, ({ oldDrive, newDrive }) => runPass('Final check', scenarios, oldDrive, newDrive, snaps))
  if (results.some(r => !r.same && !r.intended)) {
    step('prove', 'wait', 'Still different. I would not switch yet')
    return
  }
  finishProof(results)
}

function finishProof(results) {
  const n = results.length
  const intended = results.filter(r => r.intended).length
  $('proof-bar').style.width = '100%'
  $('proof-bar').classList.remove('bad')
  $('proof-line').textContent = intended
    ? `All ${n} entries match, apart from ${intended} sales with the rounding you chose.`
    : `All ${n} entries give the same answer in both apps.`
  $('diffs').innerHTML = ''
  step('prove', 'done', intended ? `${n} entries. Same, apart from your rounding fix` : `${n} entries, all the same`)
  step('rest', 'now', 'When you are ready')
  $('rest').hidden = false
  $('reincarnate').hidden = true
  booSays(`Proven. Same answer in both apps on ${n - intended} of ${n} entries${intended ? `, and the other ${intended} are the rounding fix you chose` : ''}. ClinicMaster 98 can rest now.`, { loud: true, tone: 'cheer' })
}

$('rest').addEventListener('click', async () => {
  $('rest').disabled = true
  booSays('Thank you, ClinicMaster 98.', { loud: true })
  await sinkWindow(legacyWin, { name: 'ClinicMaster 98', years: '1998 – 2026', words: 'Served this shop faithfully', desktop: $('desktop') })
  desktop.close(legacyWin)
  const li = document.createElement('li')
  li.textContent = 'ClinicMaster 98, 1998 to 2026. Every rule it had lives on in ClinicMaster Reborn.'
  $('caught').prepend(li)
  step('rest', 'done', 'At peace. The new app runs the shop')
  $('rest').hidden = true
  note('ClinicMaster 98 laid to rest.')
  booSays('ClinicMaster 98 can rest. Everything it did, the new app does.', { tone: 'cheer' })
})

async function reincarnate() {
  if (busy || !crew) return
  busy = true
  $('reincarnate').disabled = true
  $('reincarnate').textContent = 'Working on it'
  desktop.open('ClinicMaster 98')
  desktop.pair()

  // 1. Possess: learn the old app by using it.
  step('possess', 'now', 'Opening every screen')
  booSays('Possessing ClinicMaster 98. I will learn it the way new staff do: by using it.', { loud: true })
  const snap = legacy.snapshot()
  const ghost = crew.split()
  let delay = 420
  const findings = await explore(hands(legacyWin, ghost, () => delay), {
    say: t => note(t),
    progress: ({ probes, rules, rule }) => {
      if (probes > 1) delay = 60
      step('possess', 'now', `${probes} tries, ${rules} rules found`)
      if (rule) ghost.handle({ type: 'say', text: ruleLine(rule) })
    },
  })
  legacy.restore(snap)
  ghost.handle({ type: 'release' })
  await crew.merge(ghost)
  step('possess', 'done', `${findings.probes} tries, ${findings.rules.length} rules${findings.money ? `, GST ${findings.money.rate}%` : ''}`)
  note(`Learned ClinicMaster 98: ${findings.rules.length} rules from ${findings.probes} tries. My test entries are tidied away.`)

  // 2. Write the spec.
  spec = buildSpec(findings)
  files = specFiles(spec)
  step('spec', 'now', 'Writing')
  desktop.open('Spec')
  booSays('Writing down everything I learned, as a spec Kiro can build from.')
  await writeSpecLive()
  const criteria = (files['requirements.md'].match(/^\d+\. (WHEN|IF)/gm) ?? []).length
  step('spec', 'done', `${criteria} acceptance criteria, each with its evidence`)
  await pause(900)
  desktop.minimise(specWin)

  // 3. Raise the new app.
  step('rise', 'now', '')
  booSays('Now it rises again.', { loud: true })
  reborn = createReborn(rebornWin.querySelector('.reborn-body'), spec)
  desktop.pair()
  desktop.open('ClinicMaster Reborn')
  await riseWindow(rebornWin)
  step('rise', 'done', 'Idle look. Every rule comes from the spec')

  // 4. Move in, 5. prove.
  const start = await moveIn()
  await proveIt(start)
  busy = false
}
$('reincarnate').addEventListener('click', reincarnate)

// ------------------------------------------------------------- start: Boo is born

async function boot() {
  const d = bounds()
  const booRect = desktop.byName('Boo').getBoundingClientRect()
  const floor = Math.min(d.h, window.innerHeight - 48)
  const centreX = window.innerWidth > 900 ? Math.max(160, booRect.left - 110) : window.innerWidth / 2
  const at = await booIsBorn({ centreX, floor })
  mother = createBoo({ windows: desktop.standable, bounds, onClick: () => {}, at, pop: false })
  crew = makeCrew()
  render()
  booSays('Boo! I am awake.', { tone: 'cheer' })
  await pause(2600)
  booSays('ClinicMaster 98 has run this shop since 1998. Shall we bring it back to life?')
}

render()
boot()

// A little state for checking the build.
window.__haunt = {
  stats,
  needs,
  apps,
  legacy,
  reincarnate,
  get crew() {
    return crew
  },
  get reborn() {
    return reborn
  },
  get spec() {
    return spec
  },
  get files() {
    return files
  },
  get lastProof() {
    return lastProof
  },
  get minute() {
    return minute
  },
}
