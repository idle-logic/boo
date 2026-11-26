// The browser demo: an old app, a new app, and Boo moving clients between them.
import { createBoo } from './boo.js'
import { parseCsv, heuristicValues, recordName } from './lib/mapping.js'

// Where people get the desktop app. Empty hides the link.
const DOWNLOAD_URL = ''

const EXPORT = `Full Name,HP,E-mail,DOB,Pet,Breed,Preferred Groomer,Remarks
Mei Lin,+65 9123 4567,mei.lin@example.com,14/03/1990,Kopi,Toy poodle,Hana,"Sensitive skin. Oatmeal shampoo only. No ear powder."
Arjun Rao,+65 8234 5678,arjun.rao@example.com,02/11/1985,Mochi,Domestic shorthair,Tom,"Towel dry only, hates the dryer. Mornings best."
Sarah Okafor,+65 9345 6789,sarah.o@example.com,21/07/1992,Luna,Husky,Hana,"Nervous with men she does not know. Always book with Hana."
David Chen,+65 8456 7890,david.chen@example.com,09/05/1988,Pepper,Shiba Inu,Tom,"Bites when nails are cut. Muzzle for nail trims."
Grace Tan,+65 9567 8901,grace.tan@example.com,30/12/1979,Biscuit,Golden retriever,,"Senior dog, 12. Gentle handling, short sessions."
Priya Nair,+65 8678 9012,priya.n@example.com,11/01/1995,Mango,Cavapoo,Hana,"First groom was stressful. Go slow."`

const { headers, rows } = parseCsv(EXPORT)
const $ = id => document.getElementById(id)
const pause = ms => new Promise(r => setTimeout(r, ms))
const TASKBAR = 44

// ------------------------------------------------------------- the old app

$('legacy-head').innerHTML = headers.map(h => `<th>${h}</th>`).join('')
$('legacy-rows').innerHTML = rows
  .map(r => `<tr>${headers.map(h => `<td title="${escape(r[h])}">${escape(r[h])}</td>`).join('')}</tr>`)
  .join('')
$('legacy-status').textContent = `${rows.length} records`

function escape(text) {
  return String(text ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
}

// ------------------------------------------------------------- the new app

const form = $('new-client')
const clients = []

form.addEventListener('submit', e => {
  e.preventDefault()
  const d = Object.fromEntries(new FormData(form))
  if (!d.first && !d.last) return
  clients.push(d)
  $('clients').innerHTML = clients
    .map(c => `<li><strong>${escape(c.first)} ${escape(c.last)}</strong><br><small>${escape(c.pet || c.phone)}</small></li>`)
    .join('')
  $('client-count').textContent = clients.length
  form.reset()
})

/** The form's fields as Boo's hands would see them in real software. */
function formFields() {
  const out = []
  form.querySelectorAll('input, select, textarea').forEach((el, index) => {
    const label = el.closest('label')?.childNodes[0]?.textContent.trim() ?? el.name
    out.push({ index, type: el.tagName === 'SELECT' ? 'ComboBox' : 'Edit', label, id: el.name, el })
  })
  return out
}

async function typeInto(el, value) {
  el.focus({ preventScroll: true })
  el.classList.add('typing')
  if (el.tagName === 'SELECT') {
    const opt = [...el.options].find(o => o.text.toLowerCase() === value.toLowerCase())
    if (opt) el.value = opt.value
    await pause(250)
  } else {
    el.value = ''
    for (const ch of value) {
      el.value += ch
      el.dispatchEvent(new Event('input', { bubbles: true }))
      await pause(value.length > 40 ? 8 : 22)
    }
  }
  el.classList.remove('typing')
}

// ------------------------------------------------------------- windows

let z = 10
const windows = [...document.querySelectorAll('.window')]
windows.forEach(w => {
  w.style.zIndex = String(++z)
  const bar = w.querySelector('[data-drag]')
  bar.addEventListener('pointerdown', e => {
    w.style.zIndex = String(++z)
    if (window.innerWidth <= 900) return
    bar.setPointerCapture(e.pointerId)
    const r = w.getBoundingClientRect()
    const dx = e.clientX - r.left
    const dy = e.clientY - r.top
    const move = ev => {
      const x = Math.max(-r.width + 80, Math.min(window.innerWidth - 80, ev.clientX - dx))
      const y = Math.max(0, Math.min(window.innerHeight - TASKBAR - 40, ev.clientY - dy))
      w.style.left = `${x}px`
      w.style.top = `${y}px`
      w.style.right = 'auto'
    }
    const up = () => {
      bar.removeEventListener('pointermove', move)
      bar.removeEventListener('pointerup', up)
    }
    bar.addEventListener('pointermove', move)
    bar.addEventListener('pointerup', up)
  })
  w.addEventListener('pointerdown', () => (w.style.zIndex = String(++z)))
})

// ------------------------------------------------------------- Boo

const boo = createBoo({
  // Front to back, like the desktop app's window list.
  windows: () => [...windows].sort((a, b) => Number(b.style.zIndex) - Number(a.style.zIndex)),
  bounds: () => ({ x: 0, y: 0, w: window.innerWidth, h: window.innerHeight - TASKBAR }),
  onClick: () => migration.clicked(),
})

setTimeout(() => boo.handle({ type: 'say', text: 'Boo! Press Move my clients and watch me work.' }), 1200)

/** A field's spot on screen for Boo to hover beside. */
const spot = el => {
  const r = el.getBoundingClientRect()
  return { x: r.left, y: r.top, h: r.height }
}

// ------------------------------------------------------------- migration

const migration = {
  running: false,
  paused: false,
  resume: null,

  async clicked() {
    if (!this.running || !this.resume) return
    const go = this.resume
    this.resume = null
    this.paused = false
    go()
  },

  /** Wait here if paused. Clicking Boo carries on. */
  async checkpoint() {
    if (!this.paused) return
    boo.handle({ type: 'wait', text: 'Paused. Click me to carry on.' })
    await new Promise(r => (this.resume = r))
  },

  async run() {
    if (this.running) {
      this.paused = true
      return
    }
    this.running = true
    $('migrate').textContent = 'Pause'
    const trs = [...$('legacy-rows').children]
    const fields = formFields()
    boo.handle({ type: 'guide-say', text: `Reading ${rows.length} clients from ClinicMaster 98.` })
    await pause(1400)

    for (let i = 0; i < rows.length; i++) {
      if (trs[i].classList.contains('moved')) continue
      await this.checkpoint()
      const row = rows[i]
      const name = recordName(row)
      trs[i].classList.add('reading')
      trs[i].scrollIntoView({ block: 'nearest' })
      boo.handle({ type: 'guide', ...spot(trs[i]), text: `Client ${i + 1} of ${rows.length}: ${name}` })
      await pause(1100)

      const values = heuristicValues(row, headers, fields)
      for (const f of fields) {
        const value = values[f.index]
        if (!value) continue
        await this.checkpoint()
        boo.handle({ type: 'guide', ...spot(f.el), text: `${f.label}: ${value}` })
        await pause(450)
        await typeInto(f.el, value)
      }

      await this.checkpoint()
      boo.handle({ type: 'guide', ...spot($('save')), text: `Saving ${name}` })
      await pause(600)
      form.requestSubmit()
      trs[i].classList.remove('reading')
      trs[i].classList.add('moved')
      await pause(500)
    }

    this.running = false
    $('migrate').textContent = 'Move my clients'
    $('migrate').disabled = true
    boo.handle({ type: 'release' })
    boo.handle({ type: 'done', text: `${rows.length} clients moved out of ClinicMaster 98.` })
    addFeed(`Moved ${rows.length} clients from ClinicMaster 98`)
  },
}

$('migrate').addEventListener('click', () => {
  if (migration.running && !migration.paused) {
    migration.paused = true
    $('migrate').textContent = 'Carry on'
  } else if (migration.running && migration.paused) {
    $('migrate').textContent = 'Pause'
    migration.clicked()
  } else migration.run()
})

// ------------------------------------------------------------- what is going on

const moments = [
  { feed: 'New booking · Arjun Rao · Mochi · Wed 10:00', say: () => 'Arjun just booked Mochi for Wednesday at 10.' },
  { feed: 'Message · Sarah Okafor: any slot with Hana this week?', say: () => 'Sarah wants Hana this week. Evenings suit her.' },
  { feed: 'Cancelled · David Chen · Fri 15:00', say: () => 'David cancelled Friday at 3. That slot is free now.' },
  {
    feed: 'Arrived · Mei Lin with Kopi',
    say: () =>
      clients.some(c => c.first === 'Mei')
        ? 'Mei is here. Remember: Kopi gets oatmeal shampoo only.'
        : 'Mei Lin just arrived with Kopi.',
  },
  { feed: 'Payment failed · Grace Tan · $85', say: () => "Grace's card did not go through. Worth a quick word." },
]
let ambientTimer = null
let nextMoment = 0

function addFeed(text) {
  const list = $('feed')
  list.querySelector('.muted')?.remove()
  const li = document.createElement('li')
  li.className = 'fresh'
  li.textContent = text
  list.prepend(li)
}

function ambientTick() {
  const m = moments[nextMoment++ % moments.length]
  addFeed(m.feed)
  if (!migration.running) boo.handle({ type: 'say', text: m.say() })
  ambientTimer = setTimeout(ambientTick, 9000 + Math.random() * 6000)
}

$('ambient').addEventListener('click', e => {
  const on = e.currentTarget.getAttribute('aria-pressed') !== 'true'
  e.currentTarget.setAttribute('aria-pressed', String(on))
  if (on) {
    boo.handle({ type: 'say', text: 'I will keep an eye on Bloom Booking and tell you what matters.' })
    ambientTimer = setTimeout(ambientTick, 4000)
  } else {
    clearTimeout(ambientTimer)
    boo.handle({ type: 'say', text: 'Okay, I will stop watching.' })
  }
})

$('tuck').addEventListener('click', () => {
  const tucked = boo.mode === 'tucked'
  boo.handle({ type: tucked ? 'untuck' : 'tuck' })
  $('tuck').textContent = tucked ? 'Tuck Boo away' : 'Bring Boo back'
})

// ------------------------------------------------------------- taskbar

if (DOWNLOAD_URL) $('download').href = DOWNLOAD_URL
else $('download').hidden = true
const tick = () => ($('clock').textContent = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }))
tick()
setInterval(tick, 30_000)
