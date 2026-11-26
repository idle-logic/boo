// Slotly: the salon's current booking software. A made-up competitor, built to
// look and behave like a real 2025 booking app. Haunt only ever reads it.

import { icon } from './icons.js'
import { quote } from './data.js'

const esc = t => String(t ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
const money = n => `$${Number(n).toFixed(2)}`
const PAGE = 15
const NAV = [
  ['calendar', 'Calendar', 'calendar'],
  ['clients', 'Clients', 'users'],
  ['services', 'Services', 'scissors'],
  ['team', 'Team', 'store'],
  ['settings', 'Settings', 'settings'],
]
const DAY = d => new Date(`${d}T00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })

export function createSlotly(root, data) {
  const state = { page: 'clients', clientPage: 0, drawer: null, modal: false, calView: 'week', search: '' }

  function render() {
    const title = NAV.find(n => n[0] === state.page)[1]
    root.innerHTML = `
      <div class="sl">
        <aside class="sl-side">
          <div class="sl-logo"><span class="sl-mark" aria-hidden="true"></span>Slotly</div>
          <nav aria-label="Slotly">
            ${NAV.map(([id, label, ic]) => `<button type="button" data-nav="${id}" aria-current="${state.page === id ? 'page' : 'false'}">${icon(ic, 17)}<span>${label}</span></button>`).join('')}
          </nav>
          <div class="sl-biz"><span class="sl-avatar">M</span><div><strong>${esc(data.business.short)}</strong><small>Pro plan</small></div></div>
        </aside>
        <main class="sl-main">
          <header class="sl-top">
            <h1>${title}</h1>
            <label class="sl-search">${icon('search', 15)}<input placeholder="Search" aria-label="Search" /></label>
            <button type="button" class="sl-btn primary" data-new>+ New appointment</button>
          </header>
          <section class="sl-page">${page()}</section>
        </main>
        ${state.drawer ? drawer() : ''}
        ${state.modal ? modal() : ''}
      </div>`
  }

  function page() {
    if (state.page === 'clients') {
      const from = state.clientPage * PAGE
      const list = data.clients.slice(from, from + PAGE)
      return `<div class="sl-card"><table class="sl-table" aria-label="Clients"><thead><tr><th>Name</th><th>Phone</th><th>Email</th><th>Visits</th><th>Last visit</th></tr></thead><tbody>
        ${list.map((c, i) => `<tr data-client="${from + i}" tabindex="0"><td><span class="sl-dot">${esc(c.name[0])}</span>${esc(c.name)}${c.vip ? ' <em class="sl-tag">VIP</em>' : ''}</td><td>${esc(c.phone) || '<span class="sl-muted">-</span>'}</td><td>${esc(c.email)}</td><td>${c.visits}</td><td>${esc(c.lastVisit)}</td></tr>`).join('')}
        </tbody></table>
        <footer class="sl-pager"><span data-range>Showing ${from + 1}-${Math.min(from + PAGE, data.clients.length)} of ${data.clients.length}</span>
          <span><button type="button" class="sl-btn" data-page="-1"${state.clientPage === 0 ? ' disabled' : ''}>Previous</button><button type="button" class="sl-btn" data-page="1"${from + PAGE >= data.clients.length ? ' disabled' : ''}>Next</button></span></footer></div>`
    }
    if (state.page === 'services') {
      return `<div class="sl-card"><table class="sl-table" aria-label="Services"><thead><tr><th>Service</th><th>Category</th><th>Duration</th><th>Price</th><th>Deposit</th></tr></thead><tbody>
        ${data.services.map((s, i) => `<tr data-service="${i}" tabindex="0"><td>${esc(s.name)}</td><td><span class="sl-chip">${esc(s.category)}</span></td><td>${s.minutes} min</td><td>${money(s.price)}</td><td>${s.deposit ? `${s.deposit}%` : '<span class="sl-muted">None</span>'}</td></tr>`).join('')}
        </tbody></table></div>`
    }
    if (state.page === 'team') {
      return `<div class="sl-team">${data.staff
        .map(s => `<article class="sl-card sl-person" data-person><span class="sl-dot big">${esc(s.name[0])}</span><h3 data-k="name">${esc(s.name)}</h3><p data-k="role">${esc(s.role)}</p><p class="sl-muted" data-k="phone">${esc(s.phone)}</p><div data-k="does">${s.does.map(d => `<span class="sl-chip">${esc(d)}</span>`).join('')}</div></article>`)
        .join('')}</div>`
    }
    if (state.page === 'settings') {
      const p = data.policies
      const row = (k, label, value) => `<div class="sl-row" data-policy="${k}"><span>${label}</span><strong>${value}</strong></div>`
      return `<div class="sl-card sl-settings"><h2>Business details</h2>${row('name', 'Business name', esc(data.business.name))}${row('hours', 'Opening hours', 'Tue-Sun, 10:00-19:00')}</div>
        <div class="sl-card sl-settings"><h2>Cancellations and no-shows</h2>
          ${row('cancelHours', 'Late cancellation window', `${p.cancelHours} hours before`)}
          ${row('cancelFee', 'Late cancellation fee', `${p.cancelFee}% of the service price`)}
          ${row('noShowFee', 'No-show fee', `${p.noShowFee}% of the service price`)}
          ${row('lateMinutes', 'Late arrival grace period', `${p.lateMinutes} minutes`)}</div>`
    }
    // Calendar
    const days = [...new Set(data.bookings.map(b => b.date))].sort().slice(0, 5)
    const toggle = `<div class="sl-seg"><button type="button" data-cal="week" aria-pressed="${state.calView === 'week'}">Week</button><button type="button" data-cal="list" aria-pressed="${state.calView === 'list'}">List</button></div>`
    if (state.calView === 'list') {
      return `${toggle}<div class="sl-card"><table class="sl-table" aria-label="Upcoming appointments"><thead><tr><th>Date</th><th>Time</th><th>Client</th><th>Service</th><th>Staff</th></tr></thead><tbody>
        ${data.bookings.map(b => `<tr data-booking><td data-date="${b.date}">${DAY(b.date)}</td><td>${b.time}</td><td>${esc(b.client)}</td><td>${esc(b.service)}</td><td>${esc(b.staff)}</td></tr>`).join('')}</tbody></table></div>`
    }
    return `${toggle}<div class="sl-week" style="--days:${days.length}">${days
      .map(d => `<div class="sl-day"><h3>${DAY(d)}</h3>${data.bookings
        .filter(b => b.date === d)
        .map(b => `<div class="sl-appt" data-cat="${esc(data.services.find(s => s.name === b.service)?.category)}"><strong>${b.time}</strong> ${esc(b.client)}<small>${esc(b.service)} · ${esc(b.staff.split(' ')[0])}</small></div>`)
        .join('')}</div>`)
      .join('')}</div>`
  }

  function drawer() {
    const d = state.drawer
    const item = (k, label, value) => `<div data-field="${k}"><dt>${label}</dt><dd>${value}</dd></div>`
    let body = ''
    if (d.kind === 'client') {
      const c = data.clients[d.index]
      body = `<h2>${esc(c.name)}</h2><dl>
        ${item('phone', 'Phone', esc(c.phone) || '-')}${item('email', 'Email', esc(c.email))}${item('visits', 'Visits', c.visits)}${item('lastVisit', 'Last visit', esc(c.lastVisit))}
        ${item('tags', 'Tags', c.vip ? 'VIP' : '-')}${item('credit', 'Store credit', c.credit ? money(c.credit) : '-')}
        ${item('notes', 'Notes', esc(c.notes) || '-')}
        ${item('packages', 'Packages', c.packages.length ? c.packages.map(p => `<span data-package>${esc(p.name)} · ${p.left} of ${p.of} left · paid ${money(p.paid)}</span>`).join('') : '-')}</dl>`
    } else {
      const s = data.services[d.index]
      body = `<h2>${esc(s.name)}</h2><dl>
        ${item('category', 'Category', esc(s.category))}${item('minutes', 'Duration', `${s.minutes} min`)}${item('cleanup', 'Clean-up time after', s.cleanup ? `${s.cleanup} min` : 'None')}
        ${item('price', 'Price', money(s.price))}${item('deposit', 'Deposit at booking', s.deposit ? `${s.deposit}%` : 'None')}${item('online', 'Online booking', 'On')}</dl>`
    }
    return `<div class="sl-scrim" data-close></div><aside class="sl-drawer" aria-label="Details">${body}<button type="button" class="sl-btn" data-close>Close</button></aside>`
  }

  function modal() {
    const f = state.modal
    const s = data.services.find(x => x.name === f.service)
    const q = s && f.time ? quote(s, f.time, { policies: data.policies }) : null
    const options = (list, value) => `<option value=""></option>${list.map(v => `<option${v === value ? ' selected' : ''}>${esc(v)}</option>`).join('')}`
    return `<div class="sl-scrim"></div><form class="sl-modal" data-form="appointment" aria-label="New appointment">
      <h2>New appointment</h2>
      <label><span>Client</span><select name="client">${options(data.clients.map(c => c.name), f.client)}</select></label>
      <label><span>Service</span><select name="service">${options(data.services.map(x => x.name), f.service)}</select></label>
      <label><span>Staff</span><select name="staff">${options(data.staff.map(x => x.name), f.staff)}</select></label>
      <div class="sl-two"><label><span>Date</span><input name="date" type="date" value="${esc(f.date ?? '')}" /></label>
      <label><span>Time</span><select name="time">${options(['10:00', '11:00', '12:30', '14:00', '15:30', '17:00'], f.time)}</select></label></div>
      <dl class="sl-quote" data-quote>${q ? `<div><dt>Price</dt><dd data-k="price">${money(q.price)}</dd></div><div><dt>Blocked until</dt><dd data-k="ends">${q.ends}</dd></div><div><dt>Deposit due now</dt><dd data-k="deposit">${money(q.deposit)}</dd></div><div><dt>Late cancellation fee</dt><dd data-k="cancelFee">${money(q.cancelFee)}</dd></div>` : '<p class="sl-muted">Pick a service and time to see the price.</p>'}</dl>
      <div class="sl-actions"><button type="button" class="sl-btn" data-cancel>Cancel</button><button type="button" class="sl-btn primary" data-book>Book</button></div></form>`
  }

  root.addEventListener('click', e => {
    const t = e.target
    const nav = t.closest('[data-nav]')
    if (nav) return Object.assign(state, { page: nav.dataset.nav, drawer: null, modal: false }), render()
    const pg = t.closest('[data-page]')
    if (pg && !pg.disabled) return (state.clientPage += Number(pg.dataset.page)), render()
    const client = t.closest('[data-client]')
    if (client) return (state.drawer = { kind: 'client', index: Number(client.dataset.client) }), render()
    const service = t.closest('[data-service]')
    if (service) return (state.drawer = { kind: 'service', index: Number(service.dataset.service) }), render()
    if (t.closest('[data-close]')) return (state.drawer = null), render()
    const cal = t.closest('[data-cal]')
    if (cal) return (state.calView = cal.dataset.cal), render()
    if (t.closest('[data-new]')) return (state.modal = {}), render()
    if (t.closest('[data-cancel]')) return (state.modal = false), render()
  })
  root.addEventListener('change', e => {
    const form = e.target.closest('form[data-form="appointment"]')
    if (!form) return
    state.modal = Object.fromEntries(new FormData(form))
    render()
  })

  render()
  return { state, render }
}
