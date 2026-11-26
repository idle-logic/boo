// Idle, the software the salon is switching to. Recreated for the demo in
// Idle's look (no Idle code or logo). One store, many views: each Haunt agent
// works in its own view, the way each would have its own browser tab.

import { icon } from './icons.js'
import { quote } from './data.js'

const esc = t => String(t ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
const money = n => `$${Number(n || 0).toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const TIMES = ['10:00', '11:00', '12:30', '14:00', '15:30', '17:00']
const CATEGORIES = ['Cuts', 'Styling', 'Colour', 'Treatments', 'Brows']
const PAGES = [
  ['home', 'Home', 'home'],
  ['calendar', 'Calendar', 'calendar'],
  ['clients', 'Clients', 'users'],
  ['services', 'Services', 'scissors'],
  ['team', 'Team', 'store'],
  ['packages', 'Packages', 'gift'],
  ['settings', 'Settings', 'settings'],
]
const DAY = d => new Date(`${d}T00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })

export function createIdleStore(business) {
  const listeners = new Set()
  return {
    business,
    clients: [],
    services: [],
    staff: [],
    packages: [],
    bookings: [],
    policies: { cancelHours: '', cancelFee: '', noShowFee: '', lateMinutes: '' },
    listen: fn => listeners.add(fn),
    changed() {
      for (const fn of listeners) fn()
    },
  }
}

const FORMS = {
  client: { title: 'Add client', save: 'Add client' },
  service: { title: 'Add service', save: 'Save service' },
  staff: { title: 'Add team member', save: 'Add to team' },
  package: { title: 'Sell a package', save: 'Save package' },
  booking: { title: 'New booking', save: 'Save booking' },
  policies: { title: 'Cancellations and no-shows', save: 'Save' },
}

export function mountIdle(root, store, { page = 'home' } = {}) {
  const state = { page, form: null, editing: null, status: '', dirty: false, values: {} }
  store.listen(() => (state.form ? (state.dirty = true) : render()))

  function render() {
    state.dirty = false
    root.innerHTML = `
      <div class="idl">
        <aside class="idl-side">
          <div class="idl-pill">${icon('store', 16)}<span>${esc(store.business.short)}</span></div>
          <nav aria-label="Idle">${PAGES.map(([id, label, ic]) => `<button type="button" data-nav="${id}" aria-current="${state.page === id ? 'page' : 'false'}">${icon(ic, 18)}<span>${label}</span></button>`).join('')}</nav>
        </aside>
        <main class="idl-main">${body()}</main>
      </div>`
    const form = root.querySelector('form[data-form]')
    if (form) for (const [k, v] of Object.entries(state.values)) setValue(form, k, v)
  }

  function setValue(form, name, value) {
    const els = form.querySelectorAll(`[name="${name}"]`)
    els.forEach(el => {
      if (el.type === 'checkbox') el.checked = [].concat(value).includes(el.value)
      else el.value = value
    })
  }

  const head = (title, action) => `<div class="idl-head"><h1>${title}</h1>${action && !state.form ? `<button type="button" class="idl-btn primary" data-open="${action[0]}">${icon('plus', 16)}${action[1]}</button>` : ''}</div>
    ${state.status ? `<p class="idl-status" role="status">${icon('check', 15)}${esc(state.status)}</p>` : '<p role="status" hidden></p>'}`

  function body() {
    const p = state.page
    if (p === 'home') {
      const tiles = [
        ['Clients', store.clients.length, 'users'],
        ['Services', store.services.length, 'scissors'],
        ['Team', store.staff.length, 'store'],
        ['Upcoming bookings', store.bookings.length, 'calendar'],
        ['Packages', store.packages.length, 'gift'],
        ['Prepaid on packages', money(store.packages.reduce((a, x) => a + Number(x.paid || 0), 0)), 'coins'],
      ]
      return `${head(`Good afternoon`)}<p class="idl-sub">${store.clients.length ? 'Here is your store.' : 'Your store is set up. Bring your clients, services and team in to get started.'}</p>
        <div class="idl-tiles">${tiles.map(([k, v, ic]) => `<div class="idl-tile" data-tile="${k}">${icon(ic, 18)}<span>${k}</span><strong>${v}</strong></div>`).join('')}</div>`
    }
    if (p === 'clients') {
      return `${head('Clients', ['client', 'Add client'])}${form()}${table(
        ['Name', 'Phone', 'Email', 'Alert', 'Credit'],
        store.clients.map(c => [`${esc(c.name)}${c.vip === 'Yes' ? ' <em class="idl-tag">VIP</em>' : ''}`, esc(c.phone) || '-', esc(c.email), c.alert ? `<span class="idl-alert">${icon('alert', 13)}${esc(c.alert)}</span>` : '', c.credit ? money(c.credit) : '']),
        'No clients yet.',
      )}`
    }
    if (p === 'services') {
      return `${head('Services', ['service', 'Add service'])}${form()}${table(
        ['Service', 'Category', 'Duration', 'Buffer after', 'Price', 'Deposit'],
        store.services.map(s => [esc(s.name), esc(s.category), `${s.minutes} min`, Number(s.buffer) ? `${s.buffer} min` : '-', money(s.price), Number(s.deposit) ? `${s.deposit}%` : '-']),
        'No services yet.',
        'data-service-row',
      )}`
    }
    if (p === 'team') {
      return `${head('Team', ['staff', 'Add team member'])}${form()}${table(['Name', 'Role', 'Phone', 'Does'], store.staff.map(s => [esc(s.name), esc(s.role), esc(s.phone), [].concat(s.does).join(', ')]), 'Nobody on the team yet.')}`
    }
    if (p === 'packages') {
      return `${head('Packages', ['package', 'Sell a package'])}${form()}${table(['Client', 'Package', 'Sessions left', 'Paid'], store.packages.map(x => [esc(x.client), esc(x.name), `${x.left} of ${x.of}`, money(x.paid)]), 'No packages sold yet.')}`
    }
    if (p === 'settings') {
      const pol = store.policies
      return `${head('Settings')}<div class="idl-card idl-settings"><h2>Cancellations and no-shows</h2>${
        state.form === 'policies'
          ? form()
          : `<dl>${[
              ['cancelHours', 'Late cancellation window', pol.cancelHours ? `${pol.cancelHours} hours` : 'Not set'],
              ['cancelFee', 'Late cancellation fee', pol.cancelFee !== '' ? `${pol.cancelFee}%` : 'Not set'],
              ['noShowFee', 'No-show fee', pol.noShowFee !== '' ? `${pol.noShowFee}%` : 'Not set'],
              ['lateMinutes', 'Late arrival grace', pol.lateMinutes ? `${pol.lateMinutes} min` : 'Not set'],
            ].map(([k, a, b]) => `<div data-policy="${k}"><dt>${a}</dt><dd>${b}</dd></div>`).join('')}</dl><button type="button" class="idl-btn" data-open="policies">Edit</button>`
      }</div>`
    }
    // calendar
    return `${head('Calendar', ['booking', 'New booking'])}${form()}${table(
      ['Date', 'Time', 'Client', 'Service', 'Team member'],
      store.bookings.map(b => [`<span data-date="${b.date}">${DAY(b.date)}</span>`, b.time, esc(b.client), esc(b.service), esc(b.staff)]),
      'No upcoming bookings.',
    )}`
  }

  function table(cols, rows, empty, rowAttr = '') {
    return `<div class="idl-card idl-table-wrap"><table class="idl-table"><thead><tr>${cols.map(c => `<th>${c}</th>`).join('')}</tr></thead><tbody>
      ${rows.length ? rows.map((r, i) => `<tr data-row ${rowAttr ? `${rowAttr}="${i}"` : ''}>${r.map(v => `<td>${v}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${cols.length}" class="idl-empty">${empty}</td></tr>`}
    </tbody></table></div>`
  }

  const field = (label, name, input = `<input name="${name}" autocomplete="off" />`) => `<label class="idl-field"><span>${label}</span>${input}</label>`
  const select = (name, list) => `<select name="${name}"><option value=""></option>${list.map(v => `<option>${esc(v)}</option>`).join('')}</select>`

  function form() {
    const f = state.form
    if (!f) return ''
    let inner = ''
    if (f === 'client') inner = field('Name', 'name') + field('Phone', 'phone') + field('Email', 'email') + field('VIP', 'vip', select('vip', ['No', 'Yes'])) + field('Store credit', 'credit') + field('Alert', 'alert') + `<label class="idl-field wide"><span>Notes</span><textarea name="notes" rows="2"></textarea></label>`
    if (f === 'service') inner = field('Name', 'name') + field('Category', 'category', select('category', CATEGORIES)) + field('Duration (min)', 'minutes') + field('Buffer after (min)', 'buffer') + field('Price', 'price') + field('Deposit (%)', 'deposit')
    if (f === 'staff') inner = field('Name', 'name') + field('Role', 'role') + field('Phone', 'phone') + `<fieldset class="idl-field wide"><legend>Does</legend>${CATEGORIES.map(c => `<label class="idl-check"><input type="checkbox" name="does" value="${c}" />${c}</label>`).join('')}</fieldset>`
    if (f === 'package') inner = field('Client', 'client', select('client', store.clients.map(c => c.name))) + field('Package', 'name') + field('Sessions left', 'left') + field('Sessions total', 'of') + field('Paid', 'paid')
    if (f === 'policies') inner = field('Late cancellation window (hours)', 'cancelHours') + field('Late cancellation fee (%)', 'cancelFee') + field('No-show fee (%)', 'noShowFee') + field('Late arrival grace (min)', 'lateMinutes')
    if (f === 'booking') {
      inner = field('Client', 'client', select('client', store.clients.map(c => c.name))) + field('Service', 'service', select('service', store.services.map(s => s.name))) + field('Team member', 'staff', select('staff', store.staff.map(s => s.name))) + field('Date', 'date', '<input name="date" type="date" />') + field('Time', 'time', select('time', TIMES))
      const s = store.services.find(x => x.name === state.values.service)
      const pol = Object.fromEntries(Object.entries(store.policies).map(([k, v]) => [k, Number(v) || 0]))
      const q = s && state.values.time ? quote({ ...s, minutes: Number(s.minutes), price: Number(s.price), deposit: Number(s.deposit) || 0 }, state.values.time, { cleanup: Number(s.buffer) || 0, policies: pol }) : null
      inner += `<dl class="idl-quote wide" data-quote>${q ? `<div><dt>Price</dt><dd data-k="price">${money(q.price)}</dd></div><div><dt>Blocked until</dt><dd data-k="ends">${q.ends}</dd></div><div><dt>Deposit due now</dt><dd data-k="deposit">${money(q.deposit)}</dd></div><div><dt>Late cancellation fee</dt><dd data-k="cancelFee">${money(q.cancelFee)}</dd></div>` : '<p>Pick a service and a time to see the price.</p>'}</dl>`
    }
    const title = state.editing !== null ? 'Edit service' : FORMS[f].title
    return `<form class="idl-card idl-form" data-form="${f}" aria-label="${title}"><h2>${title}</h2><div class="idl-fields">${inner}</div>
      <div class="idl-actions"><button type="button" class="idl-btn" data-cancel>Cancel</button><button type="submit" class="idl-btn primary">${FORMS[f].save}</button></div></form>`
  }

  function values(formEl) {
    const out = {}
    for (const el of formEl.querySelectorAll('[name]')) {
      if (el.type === 'checkbox') {
        out[el.name] = out[el.name] ?? []
        if (el.checked) out[el.name].push(el.value)
      } else out[el.name] = el.value.trim()
    }
    return out
  }

  function close(status) {
    Object.assign(state, { form: null, editing: null, values: {}, status })
    render()
  }

  root.addEventListener('click', e => {
    const t = e.target
    const nav = t.closest('[data-nav]')
    if (nav) return Object.assign(state, { page: nav.dataset.nav, form: null, editing: null, values: {}, status: '' }), render()
    const open = t.closest('[data-open]')
    if (open) return Object.assign(state, { form: open.dataset.open, values: open.dataset.open === 'policies' ? { ...store.policies } : {}, status: '' }), render()
    if (t.closest('[data-cancel]')) return close('')
    const row = t.closest('[data-service-row]')
    if (row && !state.form) {
      const i = Number(row.dataset.serviceRow)
      return Object.assign(state, { form: 'service', editing: i, values: { ...store.services[i] }, status: '' }), render()
    }
  })

  root.addEventListener('change', e => {
    const formEl = e.target.closest('form[data-form]')
    if (!formEl) return
    state.values = values(formEl)
    if (state.form === 'booking') render() // the price updates as you pick
  })
  root.addEventListener('input', e => {
    const formEl = e.target.closest('form[data-form]')
    if (formEl) state.values = values(formEl)
  })

  root.addEventListener('submit', e => {
    e.preventDefault()
    const v = values(e.target)
    const f = state.form
    if (f === 'policies') {
      store.policies = { cancelHours: v.cancelHours, cancelFee: v.cancelFee, noShowFee: v.noShowFee, lateMinutes: v.lateMinutes }
      close('Policies saved.')
      return store.changed()
    }
    if (!v.name && !v.client) return
    if (f === 'client') store.clients.push(v)
    if (f === 'service') {
      if (state.editing !== null) store.services[state.editing] = v
      else store.services.push(v)
    }
    if (f === 'staff') store.staff.push(v)
    if (f === 'package') store.packages.push(v)
    if (f === 'booking') store.bookings.push(v)
    const said = { client: 'Client added.', service: state.editing !== null ? 'Service updated.' : 'Service added.', staff: 'Added to the team.', package: 'Package saved.', booking: 'Booking saved.' }[f]
    close(said)
    store.changed()
  })

  render()
  return {
    state,
    render,
    get root() {
      return root
    },
  }
}
