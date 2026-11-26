// The demo's apps: Messages, Idle Bookings, Idle Back office and ClinicMaster 98.
// Plain, accessible HTML: labelled fields, real buttons, readable text. Boo
// operates them the same way it operates real software on a desktop.

import {
  STAFF, SERVICES, HOURS, CLIENTS, openDays, dayLabel, timeLabel, seedBookings,
  STOCK, SALES_TODAY, HOURS_THIS_WEEK, REVIEWS, INBOX, EXAMPLES,
} from './shop.js'
import { icon } from './icons.js'

const esc = t => String(t ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
const money = n => `$${n.toLocaleString('en-US')}`

/** The store switcher at the top of Idle's sidebar. */
const storePill = () => `<div class="store-pill" data-boo-ignore>${icon('store', 16)}<span>Tuesday Grooming</span>${icon('chevron', 14)}</div>`

export function createApps({ onChange = () => {}, inbox = INBOX, reviews = REVIEWS } = {}) {
  const days = openDays()
  const dayNames = days.map(dayLabel)
  const state = {
    clients: CLIENTS.map(c => ({ ...c })),
    bookings: seedBookings(days),
    chats: new Map(inbox.map(m => [m.from, { messages: [{ from: 'them', text: m.text }], unread: true }])),
    openChat: inbox[0]?.from ?? null,
    bookingTab: 'Calendar',
    calendarDay: dayNames[0],
    bookingStatus: '',
    officeTab: 'Sales',
    stock: STOCK.map(s => ({ ...s, ordered: false })),
    payrollRun: false,
    reviews: reviews.map(r => ({ ...r, reply: '' })),
    clientStatus: '',
  }
  const changed = () => onChange(state)

  // ----------------------------------------------------------- Messages

  const messages = document.querySelector('[data-app="Idle DMs"] .app-body')
  function renderMessages() {
    const names = [...state.chats.keys()]
    if (!state.openChat && names.length) state.openChat = names[0]
    const chat = state.chats.get(state.openChat) ?? { messages: [] }
    messages.innerHTML = `
      <nav class="chat-list" aria-label="Chats">
        ${names
          .map(n => {
            const c = state.chats.get(n)
            const last = c.messages.at(-1)
            return `<button type="button" class="chat-item${n === state.openChat ? ' open' : ''}" data-chat="${esc(n)}"
              aria-label="${esc(n)}${c.unread ? ', new message' : ''}: ${esc(last.text.slice(0, 60))}">
              <strong>${esc(n)}</strong>${c.unread ? '<span class="dot">new</span>' : ''}<small>${esc(last.text)}</small></button>`
          })
          .join('')}
      </nav>
      <section class="thread" aria-label="Chat with ${esc(state.openChat)}">
        <h3 data-boo-text>${state.openChat ? `Chat with ${esc(state.openChat)}` : 'No messages yet'}</h3>
        <ol class="bubbles">
          ${chat.messages.map(m => `<li class="${m.from}" data-boo-text>${m.from === 'them' ? esc(state.openChat) : 'You'}: ${esc(m.text)}</li>`).join('')}
        </ol>
        <form class="composer" data-form="reply">
          <label class="sr-only" for="reply-box">Type a message</label>
          <input id="reply-box" name="reply" placeholder="Type a message" autocomplete="off" aria-label="Type a message" />
          <button type="submit">Send</button>
        </form>
      </section>
      <form class="pretend" data-boo-ignore data-form="pretend">
        <span>Play a customer:</span>
        <select name="from" aria-label="Customer">${[...new Set([...CLIENTS.map(c => c.name), 'New number'])].map(n => `<option>${esc(n)}</option>`).join('')}</select>
        <input name="text" placeholder="Write as the customer" autocomplete="off" aria-label="Customer message" />
        <button type="submit">Send as customer</button>
        <div class="examples">${EXAMPLES.map((e, i) => `<button type="button" data-example="${i}">${esc(e.from)}: ${esc(e.text)}</button>`).join('')}</div>
      </form>`
    const bubbles = messages.querySelector('.bubbles')
    bubbles.scrollTop = bubbles.scrollHeight
  }

  messages.addEventListener('click', e => {
    const item = e.target.closest('[data-chat]')
    if (item) {
      state.openChat = item.dataset.chat
      state.chats.get(state.openChat).unread = false
      renderMessages()
      changed()
    }
    const ex = e.target.closest('[data-example]')
    if (ex) customerSays(EXAMPLES[Number(ex.dataset.example)].from, EXAMPLES[Number(ex.dataset.example)].text)
  })
  messages.addEventListener('submit', e => {
    e.preventDefault()
    const form = e.target
    if (form.dataset.form === 'reply') {
      const text = form.reply.value.trim()
      if (!text) return
      if (!state.openChat) return
      state.chats.get(state.openChat).messages.push({ from: 'us', text })
      renderMessages()
      changed()
    } else if (form.dataset.form === 'pretend') {
      const text = form.text.value.trim()
      if (text) customerSays(form.from.value, text)
    }
  })

  /** A customer writes in. */
  function customerSays(from, text) {
    if (!state.chats.has(from)) state.chats.set(from, { messages: [], unread: true })
    const chat = state.chats.get(from)
    chat.messages.push({ from: 'them', text })
    chat.unread = true
    if (!state.openChat) state.openChat = from
    // Newest conversation to the top.
    state.chats = new Map([[from, chat], ...[...state.chats].filter(([n]) => n !== from)])
    renderMessages()
    changed()
  }

  // ----------------------------------------------------------- Idle Bookings

  const booking = document.querySelector('[data-app="Idle Bookings"] .app-body')
  const taken = (day, hour, staff) => state.bookings.find(b => b.day === day && b.staff === staff && b.hour <= hour && hour < b.hour + (SERVICES.find(s => s.name === b.service)?.hours ?? 1))

  function renderBooking() {
    const nav = [['Calendar', 'calendar'], ['Clients', 'users'], ['New booking', 'plus']]
    booking.innerHTML = `
      <div class="app-shell">
        <nav class="sidebar" role="tablist" aria-label="Idle Bookings sections" aria-orientation="vertical">
          ${storePill()}
          ${nav.map(([t, g]) => `<button type="button" role="tab" aria-selected="${t === state.bookingTab}" data-btab="${t}">${icon(g)}${t}</button>`).join('')}
        </nav>
        <div class="app-main">
          <h2 class="page-title">${state.bookingTab}</h2>
          ${state.bookingStatus ? `<p class="status" role="status" data-boo-text>${esc(state.bookingStatus)}</p>` : ''}
          ${state.bookingTab === 'Calendar' ? calendarHtml() : state.bookingTab === 'Clients' ? clientsHtml() : bookingFormHtml()}
        </div>
      </div>`
  }

  function calendarHtml() {
    const day = state.calendarDay
    return `
      <div role="tablist" class="day-strip" aria-label="Days">
        ${dayNames.map(d => `<button type="button" role="tab" aria-selected="${d === day}" data-day="${esc(d)}">${esc(d)}</button>`).join('')}
      </div>
      <table class="cal">
        <thead><tr><th scope="col"><span class="sr-only">Time</span></th>${STAFF.map(s => `<th scope="col">${s}</th>`).join('')}</tr></thead>
        <tbody>
          ${HOURS.map(h => `<tr><th scope="row">${timeLabel(h)}</th>${STAFF.map(s => {
            const b = taken(day, h, s)
            const where = `<span class="sr-only">${esc(day)} ${timeLabel(h)} · ${s} · </span>`
            if (!b) return `<td class="free" data-boo-text>${where}<span class="faint">free</span></td>`
            const starts = b.hour === h
            return `<td class="busy${starts ? ' starts' : ''}" data-boo-text>${where}${starts ? `<b>${esc(b.client)}</b> ${esc(b.service)}` : `<span class="faint">${esc(b.client)} (continued)</span>`}${starts ? ` <button type="button" class="mini" data-cancel="${esc(`${b.day}|${b.hour}|${b.staff}`)}" aria-label="Cancel booking: ${esc(b.client)}, ${esc(b.day)} ${timeLabel(b.hour)}">×</button>` : ''}</td>`
          }).join('')}</tr>`).join('')}
        </tbody>
      </table>`
  }

  function clientsHtml() {
    return `
      <ul class="client-cards">
        ${state.clients.map(c => `<li data-boo-text><strong>${esc(c.name)}</strong> · ${esc(c.pet)} · usual groomer ${esc(c.staff || 'none')} · ${esc(c.phone || '')}<br><small>${esc(c.notes)}</small></li>`).join('')}
      </ul>
      <form data-form="client" class="client-form" aria-label="New client">
        <h4>New client</h4>
        <label>Name<input name="name" autocomplete="off" /></label>
        <label>Phone<input name="phone" autocomplete="off" /></label>
        <label>Pet and breed<input name="pet" autocomplete="off" /></label>
        <label>Usual groomer<select name="staff"><option value="">None</option>${STAFF.map(s => `<option>${s}</option>`).join('')}</select></label>
        <label>Notes<textarea name="notes" rows="2"></textarea></label>
        <button type="submit">Save client</button>
        ${state.clientStatus ? `<p class="status" role="status" data-boo-text>${esc(state.clientStatus)}</p>` : ''}
      </form>`
  }

  function bookingFormHtml() {
    return `
      <form data-form="booking" class="booking-form" aria-label="New booking">
        <label>Client<select name="client"><option value="">Choose a client</option>${state.clients.map(c => `<option>${esc(c.name)}</option>`).join('')}</select></label>
        <label>Pet<input name="pet" autocomplete="off" /></label>
        <label>Service<select name="service"><option value="">Choose a service</option>${SERVICES.map(s => `<option>${s.name}</option>`).join('')}</select></label>
        <label>Staff<select name="staff"><option value="">Choose staff</option>${STAFF.map(s => `<option>${s}</option>`).join('')}</select></label>
        <label>Day<select name="day"><option value="">Choose a day</option>${dayNames.map(d => `<option>${esc(d)}</option>`).join('')}</select></label>
        <label>Time<select name="time"><option value="">Choose a time</option>${HOURS.map(h => `<option>${timeLabel(h)}</option>`).join('')}</select></label>
        <button type="submit">Book</button>
      </form>`
  }

  booking.addEventListener('click', e => {
    const tab = e.target.closest('[data-btab]')
    if (tab) {
      state.bookingTab = tab.dataset.btab
      state.bookingStatus = ''
      renderBooking()
      return changed()
    }
    const day = e.target.closest('[data-day]')
    if (day) {
      state.calendarDay = day.dataset.day
      renderBooking()
      return changed()
    }
    const cancel = e.target.closest('[data-cancel]')
    if (cancel) {
      const [d, h, s] = cancel.dataset.cancel.split('|')
      const b = state.bookings.find(x => x.day === d && x.hour === Number(h) && x.staff === s)
      state.bookings = state.bookings.filter(x => x !== b)
      state.bookingStatus = b ? `Cancelled ${b.client}, ${b.day} ${timeLabel(b.hour)} with ${b.staff}.` : ''
      renderBooking()
      changed()
    }
  })

  booking.addEventListener('submit', e => {
    e.preventDefault()
    const f = Object.fromEntries(new FormData(e.target))
    if (e.target.dataset.form === 'client') {
      if (!f.name?.trim()) return
      state.clients.push({ name: f.name.trim(), phone: f.phone, pet: f.pet, staff: f.staff, notes: f.notes })
      state.clientStatus = `Saved ${f.name.trim()}. ${state.clients.length} clients.`
      renderBooking()
      return changed()
    }
    state.bookingStatus = book(f)
    if (state.bookingStatus.startsWith('Booked')) state.bookingTab = 'Calendar'
    renderBooking()
    changed()
  })

  /** Book if the slot is free for the whole service. Returns what happened. */
  function book(f) {
    const missing = ['client', 'service', 'staff', 'day', 'time'].filter(k => !f[k])
    if (missing.length) return `Can't book yet: choose ${missing.join(', ')}.`
    const hour = Number(f.time.slice(0, 2))
    const service = SERVICES.find(s => s.name === f.service)
    if (hour + service.hours > 19) return `Can't book: ${f.service} takes ${service.hours} hours and the shop closes at 19:00.`
    for (let h = hour; h < hour + service.hours; h++) {
      const clash = taken(f.day, h, f.staff)
      if (clash) return `Can't book: ${f.staff} is busy at ${timeLabel(h)} on ${f.day} with ${clash.client}.`
    }
    state.bookings.push({ day: f.day, hour, staff: f.staff, client: f.client, service: f.service, pet: f.pet })
    state.calendarDay = f.day
    return `Booked ${f.client}${f.pet ? ` (${f.pet})` : ''}: ${f.service} with ${f.staff}, ${f.day} ${f.time}.`
  }

  // ----------------------------------------------------------- Idle Back office

  const office = document.querySelector('[data-app="Idle Back office"] .app-body')
  function renderOffice() {
    const nav = [['Sales', 'receipt'], ['Stock', 'box'], ['Staff and payroll', 'coins'], ['Reviews', 'star']]
    office.innerHTML = `
      <div class="app-shell">
        <nav class="sidebar" role="tablist" aria-label="Idle Back office sections" aria-orientation="vertical">
          ${storePill()}
          ${nav.map(([t, g]) => `<button type="button" role="tab" aria-selected="${t === state.officeTab}" data-otab="${t}">${icon(g)}${t}</button>`).join('')}
        </nav>
        <div class="app-main"><h2 class="page-title">${state.officeTab}</h2>${officePanel()}</div>
      </div>`
  }

  function officePanel() {
    if (state.officeTab === 'Sales') {
      const total = SALES_TODAY.reduce((a, s) => a + s.amount, 0)
      return `<ul class="rows">${SALES_TODAY.map(s => `<li data-boo-text>${s.time} · ${esc(s.client)} · ${esc(s.what)} · ${money(s.amount)}</li>`).join('')}</ul>
        <p class="total" data-boo-text>Sales today: ${money(total)} from ${SALES_TODAY.length} sales</p>`
    }
    if (state.officeTab === 'Stock') {
      return `<ul class="rows">${state.stock
        .map(s => {
          const low = s.count < s.low
          const line = `${s.item} · ${s.count} left${low ? ' · low' : ''}${s.ordered ? ` · ordered ${s.reorder}, arriving Monday` : ''}`
          return `<li data-boo-text class="${low && !s.ordered ? 'warn' : ''}">${esc(line)}${low && !s.ordered ? ` <button type="button" class="mini" data-reorder="${esc(s.item)}">Reorder ${s.reorder} ${esc(s.item)}</button>` : ''}</li>`
        })
        .join('')}</ul>`
    }
    if (state.officeTab === 'Staff and payroll') {
      const pay = p => p.staff === 'Tom' ? 40 * p.rate + (p.hours - 40) * p.rate * 1.5 : p.hours * p.rate
      return `<ul class="rows">${HOURS_THIS_WEEK.map(p => `<li data-boo-text>${p.staff} · ${p.hours} hours this week · ${money(p.rate)} an hour${p.hours > 40 ? ` · ${p.hours - 40} hour overtime at 1.5x` : ''}</li>`).join('')}</ul>
        ${state.payrollRun
          ? `<p class="status" data-boo-text>Payroll sent: ${HOURS_THIS_WEEK.map(p => `${p.staff} ${money(pay(p))}`).join(', ')}. Due Friday.</p>`
          : `<p data-boo-text>Payroll for this week is due Friday. Not run yet.</p><button type="button" data-payroll>Run payroll</button>`}`
    }
    return `<ul class="rows reviews">${state.reviews
      .map((r, i) => `<li><p data-boo-text>${'★'.repeat(r.stars)}${'☆'.repeat(5 - r.stars)} ${esc(r.who)}: ${esc(r.text)}</p>
        ${r.reply
          ? `<p class="reply" data-boo-text>Your reply to ${esc(r.who)}: ${esc(r.reply)}</p>`
          : `<label>Reply to ${esc(r.who)}<textarea rows="2" data-reply-box="${i}"></textarea></label><button type="button" class="mini" data-post="${i}">Post reply to ${esc(r.who)}</button>`}</li>`)
      .join('')}</ul>`
  }

  office.addEventListener('click', e => {
    const tab = e.target.closest('[data-otab]')
    if (tab) state.officeTab = tab.dataset.otab
    const reorder = e.target.closest('[data-reorder]')
    if (reorder) state.stock.find(s => s.item === reorder.dataset.reorder).ordered = true
    if (e.target.closest('[data-payroll]')) state.payrollRun = true
    const post = e.target.closest('[data-post]')
    if (post) {
      const i = Number(post.dataset.post)
      const box = office.querySelector(`[data-reply-box="${i}"]`)
      if (!box?.value.trim()) return
      state.reviews[i].reply = box.value.trim()
    }
    if (tab || reorder || post || e.target.closest('[data-payroll]')) {
      renderOffice()
      changed()
    }
  })

  function renderAll() {
    renderMessages()
    renderBooking()
    renderOffice()
  }
  renderAll()

  /** A customer buys something over the counter. */
  function sell(item, n = 1, client = 'Walk-in', amount = 18) {
    const s = state.stock.find(x => x.item === item)
    if (s) s.count = Math.max(0, s.count - n)
    SALES_TODAY.push({ time: new Date().toTimeString().slice(0, 5), client, what: `${item} (retail)`, amount })
    renderOffice()
    changed()
    return s
  }

  /** A new review comes in. */
  function addReview(review) {
    state.reviews.push({ ...review, reply: '' })
    renderOffice()
    changed()
  }

  return {
    state,
    customerSays,
    sell,
    addReview,
    renderAll,
    /** Open Idle Bookings's client form, for the migration. */
    showClientForm() {
      state.bookingTab = 'Clients'
      renderBooking()
      return booking.querySelector('[data-form="client"]')
    },
  }
}
