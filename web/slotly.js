// Slotly: the salon's booking software since 2011. It only knows customers,
// services, staff and appointments, so the team keeps everything else in
// names, notes, fake services and fake appointments. Made up for the demo.

const esc = t => String(t ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
const money = n => `$${Number(n).toFixed(2)}`
const PAGE = 15
const NAV = [
  ['appointments', 'Appointments'],
  ['customers', 'Customers'],
  ['services', 'Services'],
  ['staff', 'Staff'],
  ['reports', 'Reports'],
  ['settings', 'Settings'],
]
export const SLOTS = ['10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '13:00', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30']
const DAY = d => new Date(`${d}T00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })

/**
 * data: { business, customers, services, staff, appointments, terms, smsCredits, sales }
 * on.booked(appointment), on.notes(customerIndex): told when someone saves in Slotly.
 */
export function createSlotly(root, data, on = {}) {
  const state = { page: 'customers', customerPage: 0, popup: null, modal: null, calView: 'list', flash: null }

  function render() {
    const title = NAV.find(n => n[0] === state.page)[1]
    root.innerHTML = `
      <div class="sl">
        <header class="sl-banner"><span class="sl-logo">Slotly<sup>v4.2</sup></span><span class="sl-links"><b>${esc(data.business.name)}</b> | <u>My Account</u> | <u>Help</u> | <u>Log Out</u></span></header>
        <p class="sl-dying" role="alert">⚠ Slotly is shutting down on 31 Dec 2026. Data export is not available.</p>
        <nav class="sl-tabs" aria-label="Slotly">${NAV.map(([id, label]) => `<button type="button" data-nav="${id}" aria-current="${state.page === id ? 'page' : 'false'}">${label}</button>`).join('')}</nav>
        <div class="sl-toolbar"><h1>${title}</h1><span class="sl-find"><input aria-label="Search" placeholder="Search customers..." /><button type="button" class="sl-btn">Go</button></span><button type="button" class="sl-btn sl-go" data-new>New Appointment</button></div>
        <section class="sl-page">${page()}</section>
        <footer class="sl-foot">&copy; 2011-2026 Slotly Systems Ltd. Best viewed at 1024 x 768. <u>Terms</u> | <u>Privacy</u></footer>
        ${state.popup !== null ? popup() : ''}
        ${state.modal ? modal() : ''}
      </div>`
  }

  function page() {
    if (state.page === 'customers') {
      const from = state.customerPage * PAGE
      return `<table class="sl-table" aria-label="Customers"><thead><tr><th>Name</th><th>Mobile</th><th>Email</th><th>Visits</th><th>Last Visit</th></tr></thead><tbody>
        ${data.customers.slice(from, from + PAGE).map((c, i) => `<tr data-customer="${from + i}" tabindex="0"><td><u>${esc(c.name)}</u></td><td>${esc(c.mobile) || '&nbsp;'}</td><td>${esc(c.email)}</td><td>${c.visits}</td><td>${esc(c.lastVisit)}</td></tr>`).join('')}
        </tbody></table>
        <div class="sl-pager"><span>Records ${from + 1} - ${Math.min(from + PAGE, data.customers.length)} of ${data.customers.length}</span>
          <span><button type="button" class="sl-btn" data-page="-1"${state.customerPage === 0 ? ' disabled' : ''}>&laquo; Prev</button> <button type="button" class="sl-btn" data-page="1"${from + PAGE >= data.customers.length ? ' disabled' : ''}>Next &raquo;</button></span></div>`
    }
    if (state.page === 'services') {
      return `<table class="sl-table" aria-label="Services"><thead><tr><th>Service</th><th>Mins</th><th>Price</th><th>Description</th></tr></thead><tbody>
        ${data.services.map(s => `<tr data-service><td>${esc(s.name)}</td><td>${s.mins}</td><td>${money(s.price)}</td><td>${esc(s.description)}</td></tr>`).join('')}</tbody></table>`
    }
    if (state.page === 'staff') {
      return `<div class="sl-staff">${data.staff.map(s => `<fieldset class="sl-person" data-person><legend data-k="name">${esc(s.name)}</legend><p><b>Mobile:</b> <span data-k="mobile">${esc(s.mobile)}</span></p><p><b>Notes:</b> <span data-k="notes">${esc(s.notes)}</span></p></fieldset>`).join('')}</div>`
    }
    if (state.page === 'reports') {
      const max = Math.max(...data.sales.map(m => m[1]))
      return `<div class="sl-box"><h2>Revenue by Month</h2><table class="sl-bars">${data.sales.map(([m, v]) => `<tr><th>${m}</th><td><span style="width:${Math.round((v / max) * 100)}%"></span></td><td>${money(v)}</td></tr>`).join('')}</table></div><p class="sl-hint">Export to Excel (.xls) is available on the Premium plan.</p>`
    }
    if (state.page === 'settings') {
      return `<div class="sl-box"><h2>Booking Terms (shown to customers)</h2><p data-terms>${esc(data.terms)}</p></div>
        <div class="sl-box"><h2>SMS</h2><p>SMS credits remaining: <b data-sms>${data.smsCredits.toLocaleString('en')}</b> <u>Buy more</u></p></div>
        <div class="sl-box"><h2>Business Details</h2><p>${esc(data.business.name)} &middot; Tue-Sun, 10:00-19:00</p></div>`
    }
    const toggle = `<p class="sl-view">View: <button type="button" data-cal="week" aria-pressed="${state.calView === 'week'}">Week</button> | <button type="button" data-cal="list" aria-pressed="${state.calView === 'list'}">List</button></p>`
    if (state.calView === 'list') {
      return `${toggle}<table class="sl-table" aria-label="Appointments"><thead><tr><th>Date</th><th>Time</th><th>Customer</th><th>Service</th><th>Staff</th><th>Mins</th></tr></thead><tbody>
        ${data.appointments.map((a, i) => `<tr data-appt="${i}"${state.flash === i ? ' class="sl-new"' : ''}><td data-date="${a.date}">${DAY(a.date)}</td><td>${a.time}</td><td>${esc(a.customer)}</td><td>${esc(a.service)}</td><td>${esc(a.staff)}</td><td>${a.mins}</td></tr>`).join('')}</tbody></table>`
    }
    const days = [...new Set(data.appointments.map(a => a.date))].sort().slice(0, 5)
    return `${toggle}<table class="sl-week"><thead><tr>${days.map(d => `<th>${DAY(d)}</th>`).join('')}</tr></thead><tbody><tr>${days.map(d => `<td>${data.appointments.filter(a => a.date === d).map(a => `<div class="sl-appt${a.customer === 'BLOCKED' || a.service === 'CLEAN UP' ? ' sl-block' : ''}"><b>${a.time}</b> ${esc(a.customer)}<br>${esc(a.service)} (${esc(a.staff.split(' ')[0])})</div>`).join('')}</td>`).join('')}</tr></tbody></table>`
  }

  function popup() {
    const c = data.customers[state.popup]
    return `<div class="sl-scrim" data-close></div><aside class="sl-popup sl-drawer" aria-label="Customer Details"><div class="sl-popup-bar">Customer Details<button type="button" data-close aria-label="Close">x</button></div>
      <form class="sl-popup-body" data-form="customer"><h2>${esc(c.name)}</h2><dl>
        <div><dt>Mobile</dt><dd>${esc(c.mobile) || '-'}</dd></div><div><dt>Email</dt><dd>${esc(c.email)}</dd></div>
        <div><dt>Visits</dt><dd>${c.visits}</dd></div><div><dt>Last visit</dt><dd>${esc(c.lastVisit)}</dd></div></dl>
        <label class="sl-notes"><span>Notes</span><textarea name="notes" rows="4">${esc(c.notes)}</textarea></label>
        <div class="sl-actions"><button type="submit" class="sl-btn sl-go">Save</button> <button type="button" class="sl-btn" data-close>Close</button></div></form></aside>`
  }

  function modal() {
    const f = state.modal
    const opts = (list, value) => `<option value="">-- Select --</option>${list.map(v => `<option${v === value ? ' selected' : ''}>${esc(v)}</option>`).join('')}`
    return `<div class="sl-scrim"></div><form class="sl-modal sl-popup" data-form="appointment" aria-label="New appointment"><div class="sl-popup-bar">New Appointment</div><div class="sl-popup-body"><table class="sl-form">
      <tr><td><label><span>Customer</span><select name="customer">${opts(data.customers.map(c => c.name), f.customer)}</select></label></td></tr>
      <tr><td><label><span>Service</span><select name="service">${opts(data.services.map(s => s.name), f.service)}</select></label></td></tr>
      <tr><td><label><span>Staff</span><select name="staff">${opts(data.staff.map(s => s.name), f.staff)}</select></label></td></tr>
      <tr><td><label><span>Date</span><input name="date" type="date" value="${esc(f.date ?? '')}" /></label> <label><span>Time</span><select name="time">${opts(SLOTS, f.time)}</select></label></td></tr>
      </table><div class="sl-actions"><button type="submit" class="sl-btn sl-go">Save</button> <button type="button" class="sl-btn" data-cancel>Cancel</button></div></div></form>`
  }

  root.addEventListener('click', e => {
    const t = e.target
    const nav = t.closest('[data-nav]')
    if (nav) return Object.assign(state, { page: nav.dataset.nav, popup: null, modal: null }), render()
    const pg = t.closest('[data-page]')
    if (pg && !pg.disabled) return (state.customerPage += Number(pg.dataset.page)), render()
    const row = t.closest('[data-customer]')
    if (row) return (state.popup = Number(row.dataset.customer)), render()
    if (t.closest('[data-close]')) return (state.popup = null), render()
    const cal = t.closest('[data-cal]')
    if (cal) return (state.calView = cal.dataset.cal), render()
    if (t.closest('[data-new]')) return (state.modal = {}), render()
    if (t.closest('[data-cancel]')) return (state.modal = null), render()
  })
  root.addEventListener('change', e => {
    const form = e.target.closest('form[data-form="appointment"]')
    if (form) state.modal = Object.fromEntries(new FormData(form))
  })
  root.addEventListener('submit', e => {
    e.preventDefault()
    const form = e.target
    if (form.dataset.form === 'customer') {
      data.customers[state.popup].notes = form.notes.value
      const i = state.popup
      state.popup = null
      render()
      return on.notes?.(i)
    }
    const v = Object.fromEntries(new FormData(form))
    const service = data.services.find(s => s.name === v.service)
    // The team books clean-up blocks with no customer.
    if ((!v.customer && v.service !== 'CLEAN UP') || !service || !v.staff || !v.date || !v.time) return
    const appt = { date: v.date, time: v.time, customer: v.customer || '-', service: v.service, staff: v.staff, mins: service.mins }
    data.appointments.push(appt)
    data.appointments.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
    Object.assign(state, { modal: null, page: 'appointments', calView: 'list', flash: data.appointments.indexOf(appt) })
    render()
    on.booked?.(appt)
  })

  render()
  return {
    state,
    render,
    /** Make the next booking start with these values (for the "busy morning" playback). */
    open(page) {
      Object.assign(state, { page, popup: null, modal: null })
      render()
    },
  }
}
