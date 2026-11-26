// Slotly: the salon's current booking software. A made-up product that looks
// its age: built around 2011, patched ever since. Haunt only ever reads it.

import { quote } from './data.js'

const esc = t => String(t ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
const money = n => `$${Number(n).toFixed(2)}`
const PAGE = 15
const NAV = [
  ['calendar', 'Calendar'],
  ['clients', 'Clients'],
  ['services', 'Services'],
  ['products', 'Products'],
  ['team', 'Staff'],
  ['reports', 'Reports'],
  ['marketing', 'Marketing'],
  ['settings', 'Settings'],
]
const DAY = d => new Date(`${d}T00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })

export function createSlotly(root, data) {
  const state = { page: 'clients', clientPage: 0, drawer: null, modal: false, calView: 'week' }

  function render() {
    const title = NAV.find(n => n[0] === state.page)[1]
    root.innerHTML = `
      <div class="sl">
        <header class="sl-banner">
          <span class="sl-logo">Slotly<sup>v4.2</sup></span>
          <span class="sl-links"><b>${esc(data.business.name)}</b> | <u>My Account</u> | <u>Help</u> | <u>Log Out</u></span>
        </header>
        <nav class="sl-tabs" aria-label="Slotly">
          ${NAV.map(([id, label]) => `<button type="button" data-nav="${id}" aria-current="${state.page === id ? 'page' : 'false'}">${label}</button>`).join('')}
        </nav>
        <div class="sl-toolbar">
          <h1>${title}</h1>
          <span class="sl-find"><input aria-label="Search" placeholder="Search clients..." /><button type="button" class="sl-btn">Go</button></span>
          <button type="button" class="sl-btn sl-go" data-new>New Appointment</button>
        </div>
        <section class="sl-page">${page()}</section>
        <footer class="sl-foot">&copy; 2011-2026 Slotly Systems Ltd. Best viewed at 1024 x 768. <u>Terms</u> | <u>Privacy</u></footer>
        ${state.drawer ? drawer() : ''}
        ${state.modal ? modal() : ''}
      </div>`
  }

  function page() {
    if (state.page === 'clients') {
      const from = state.clientPage * PAGE
      const list = data.clients.slice(from, from + PAGE)
      return `<table class="sl-table" aria-label="Clients"><thead><tr><th>Name</th><th>Mobile</th><th>Email</th><th>Visits</th><th>Last Visit</th></tr></thead><tbody>
        ${list.map((c, i) => `<tr data-client="${from + i}" tabindex="0"><td><u>${esc(c.name)}</u>${c.vip ? ' <em class="sl-vip">VIP</em>' : ''}</td><td>${esc(c.phone) || '&nbsp;'}</td><td>${esc(c.email)}</td><td>${c.visits}</td><td>${esc(c.lastVisit)}</td></tr>`).join('')}
        </tbody></table>
        <div class="sl-pager"><span data-range>Records ${from + 1} - ${Math.min(from + PAGE, data.clients.length)} of ${data.clients.length}</span>
          <span><button type="button" class="sl-btn" data-page="-1"${state.clientPage === 0 ? ' disabled' : ''}>&laquo; Prev</button> <button type="button" class="sl-btn" data-page="1"${from + PAGE >= data.clients.length ? ' disabled' : ''}>Next &raquo;</button></span></div>`
    }
    if (state.page === 'services') {
      return `<table class="sl-table" aria-label="Services"><thead><tr><th>Service</th><th>Category</th><th>Duration</th><th>Price</th><th>Deposit</th></tr></thead><tbody>
        ${data.services.map((s, i) => `<tr data-service="${i}" tabindex="0"><td><u>${esc(s.name)}</u></td><td>${esc(s.category)}</td><td>${s.minutes} min</td><td>${money(s.price)}</td><td>${s.deposit ? `${s.deposit}%` : 'None'}</td></tr>`).join('')}
        </tbody></table><p class="sl-hint">Click a service to see all of its settings.</p>`
    }
    if (state.page === 'products') {
      return `<table class="sl-table" aria-label="Products"><thead><tr><th>Product</th><th>SKU</th><th>Price</th><th>In Stock</th></tr></thead><tbody>
        ${data.products.map(p => `<tr data-product><td>${esc(p.name)}</td><td>${esc(p.sku)}</td><td>${money(p.price)}</td><td>${p.stock}${p.stock < 8 ? ' <em class="sl-low">LOW</em>' : ''}</td></tr>`).join('')}
        </tbody></table>`
    }
    if (state.page === 'team') {
      return `<div class="sl-staff">${data.staff
        .map(s => `<fieldset class="sl-person" data-person><legend data-k="name">${esc(s.name)}</legend><p><b>Title:</b> <span data-k="role">${esc(s.role)}</span></p><p><b>Mobile:</b> <span data-k="phone">${esc(s.phone)}</span></p><p><b>Services:</b> <span data-k="does">${s.does.map(d => `<span class="sl-chip">${esc(d)}</span>`).join(', ')}</span></p></fieldset>`)
        .join('')}</div>`
    }
    if (state.page === 'reports') {
      const max = Math.max(...data.report.months.map(m => m[1]))
      return `<div class="sl-box"><h2>Revenue by Month</h2><table class="sl-bars">${data.report.months
        .map(([m, v]) => `<tr><th>${m}</th><td><span style="width:${Math.round((v / max) * 100)}%"></span></td><td>${money(v)}</td></tr>`)
        .join('')}</table></div>
        <div class="sl-box"><h2>Summary</h2><p>Active clients: <b>${data.clients.length}</b> &nbsp; Avg. visits: <b>${(data.clients.reduce((a, c) => a + c.visits, 0) / data.clients.length).toFixed(1)}</b> &nbsp; Packages sold: <b>${data.clients.flatMap(c => c.packages).length}</b></p><p class="sl-hint">Export to Excel (.xls) is available on the Premium plan.</p></div>`
    }
    if (state.page === 'marketing') {
      return `<div class="sl-box"><h2>SMS Credits</h2><p><b>${data.report.smsCredits.toLocaleString()}</b> credits remaining. <u>Buy more</u></p></div>
        <table class="sl-table"><thead><tr><th>Campaign</th><th>Status</th><th>Date</th></tr></thead><tbody>${data.report.campaigns.map(c => `<tr><td>${esc(c[0])}</td><td>${esc(c[1])}</td><td>${esc(c[2])}</td></tr>`).join('')}</tbody></table>`
    }
    if (state.page === 'settings') {
      const p = data.policies
      const row = (k, label, value) => `<tr data-policy="${k}"><th>${label}</th><td><strong>${value}</strong></td></tr>`
      return `<div class="sl-box"><h2>Business Details</h2><table class="sl-form">${row('name', 'Business name', esc(data.business.name))}${row('hours', 'Opening hours', 'Tue-Sun, 10:00-19:00')}</table></div>
        <div class="sl-box"><h2>Cancellation Policy</h2><table class="sl-form">
          ${row('cancelHours', 'Late cancellation window', `${p.cancelHours} hours before`)}
          ${row('cancelFee', 'Late cancellation fee', `${p.cancelFee}% of the service price`)}
          ${row('noShowFee', 'No-show fee', `${p.noShowFee}% of the service price`)}
          ${row('lateMinutes', 'Late arrival grace period', `${p.lateMinutes} minutes`)}</table></div>`
    }
    // Calendar
    const days = [...new Set(data.bookings.map(b => b.date))].sort().slice(0, 5)
    const toggle = `<p class="sl-view">View: <button type="button" data-cal="week" aria-pressed="${state.calView === 'week'}">Week</button> | <button type="button" data-cal="list" aria-pressed="${state.calView === 'list'}">List</button></p>`
    if (state.calView === 'list') {
      return `${toggle}<table class="sl-table" aria-label="Upcoming appointments"><thead><tr><th>Date</th><th>Time</th><th>Client</th><th>Service</th><th>Staff</th></tr></thead><tbody>
        ${data.bookings.map(b => `<tr data-booking><td data-date="${b.date}">${DAY(b.date)}</td><td>${b.time}</td><td>${esc(b.client)}</td><td>${esc(b.service)}</td><td>${esc(b.staff)}</td></tr>`).join('')}</tbody></table>`
    }
    return `${toggle}<table class="sl-week"><thead><tr>${days.map(d => `<th>${DAY(d)}</th>`).join('')}</tr></thead><tbody><tr>${days
      .map(d => `<td>${data.bookings
        .filter(b => b.date === d)
        .map(b => `<div class="sl-appt"><b>${b.time}</b> ${esc(b.client)}<br>${esc(b.service)} (${esc(b.staff.split(' ')[0])})</div>`)
        .join('')}</td>`)
      .join('')}</tr></tbody></table>`
  }

  function drawer() {
    const d = state.drawer
    const item = (k, label, value) => `<div data-field="${k}"><dt>${label}</dt><dd>${value}</dd></div>`
    let body = ''
    let title = ''
    if (d.kind === 'client') {
      const c = data.clients[d.index]
      title = 'Client Details'
      body = `<h2>${esc(c.name)}</h2><dl>
        ${item('phone', 'Phone', esc(c.phone) || '-')}${item('email', 'Email', esc(c.email))}${item('visits', 'Visits', c.visits)}${item('lastVisit', 'Last visit', esc(c.lastVisit))}
        ${item('tags', 'Tags', c.vip ? 'VIP' : '-')}${item('credit', 'Store credit', c.credit ? money(c.credit) : '-')}
        ${item('notes', 'Notes', esc(c.notes) || '-')}
        ${item('packages', 'Packages', c.packages.length ? c.packages.map(p => `<span data-package>${esc(p.name)} · ${p.left} of ${p.of} left · paid ${money(p.paid)}</span>`).join('') : '-')}</dl>`
    } else {
      const s = data.services[d.index]
      title = 'Edit Service'
      body = `<h2>${esc(s.name)}</h2><dl>
        ${item('category', 'Category', esc(s.category))}${item('minutes', 'Duration', `${s.minutes} min`)}${item('cleanup', 'Clean-up time after', s.cleanup ? `${s.cleanup} min` : 'None')}
        ${item('price', 'Price', money(s.price))}${item('deposit', 'Deposit at booking', s.deposit ? `${s.deposit}%` : 'None')}${item('online', 'Online booking', 'On')}</dl>`
    }
    return `<div class="sl-scrim" data-close></div><aside class="sl-drawer sl-popup" aria-label="${title}"><div class="sl-popup-bar">${title}<button type="button" data-close aria-label="Close">x</button></div><div class="sl-popup-body">${body}<button type="button" class="sl-btn" data-close>Close</button></div></aside>`
  }

  function modal() {
    const f = state.modal
    const s = data.services.find(x => x.name === f.service)
    const q = s && f.time ? quote(s, f.time, { policies: data.policies }) : null
    const options = (list, value) => `<option value="">-- Select --</option>${list.map(v => `<option${v === value ? ' selected' : ''}>${esc(v)}</option>`).join('')}`
    return `<div class="sl-scrim"></div><form class="sl-modal sl-popup" data-form="appointment" aria-label="New appointment">
      <div class="sl-popup-bar">New Appointment</div><div class="sl-popup-body">
      <table class="sl-form">
        <tr><td><label><span>Client</span><select name="client">${options(data.clients.map(c => c.name), f.client)}</select></label></td></tr>
        <tr><td><label><span>Service</span><select name="service">${options(data.services.map(x => x.name), f.service)}</select></label></td></tr>
        <tr><td><label><span>Staff</span><select name="staff">${options(data.staff.map(x => x.name), f.staff)}</select></label></td></tr>
        <tr><td><label><span>Date</span><input name="date" type="date" value="${esc(f.date ?? '')}" /></label> <label><span>Time</span><select name="time">${options(['10:00', '11:00', '12:30', '14:00', '15:30', '17:00'], f.time)}</select></label></td></tr>
      </table>
      <dl class="sl-quote" data-quote>${q ? `<div><dt>Price</dt><dd data-k="price">${money(q.price)}</dd></div><div><dt>Blocked until</dt><dd data-k="ends">${q.ends}</dd></div><div><dt>Deposit due now</dt><dd data-k="deposit">${money(q.deposit)}</dd></div><div><dt>Late cancellation fee</dt><dd data-k="cancelFee">${money(q.cancelFee)}</dd></div>` : '<p>Select a service and time to calculate the price.</p>'}</dl>
      <div class="sl-actions"><button type="button" class="sl-btn sl-go" data-book>Save</button> <button type="button" class="sl-btn" data-cancel>Cancel</button></div></div></form>`
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
