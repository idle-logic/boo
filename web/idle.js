// Idle, the software the salon is switching to. Recreated for the demo in
// Idle's look (no Idle code or logo). One store, many views: each Boo agent
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
  ['messages', 'Idle DMs', 'chat'],
  ['clients', 'Clients', 'users'],
  ['services', 'Services', 'scissors'],
  ['products', 'Products', 'box'],
  ['team', 'Team', 'store'],
  ['packages', 'Packages', 'gift'],
  ['sales', 'Sales', 'receipt'],
  ['marketing', 'Marketing', 'star'],
  ['reports', 'Reports', 'coins'],
  ['settings', 'Settings', 'settings'],
]
const DAY = d => new Date(`${d}T00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
const initials = n => n.split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase()
const hue = n => [...n].reduce((a, c) => a + c.charCodeAt(0), 0) % 6

export function createIdleStore(business) {
  const listeners = new Set()
  return {
    business,
    clients: [],
    services: [],
    products: [],
    staff: [],
    packages: [],
    bookings: [],
    policies: { cancelHours: '', cancelFee: '', noShowFee: '', note: '' },
    listen: fn => listeners.add(fn),
    changed() {
      for (const fn of listeners) fn()
    },
  }
}

const FORMS = {
  client: { title: 'Add client', save: 'Add client' },
  service: { title: 'Add service', save: 'Save service' },
  product: { title: 'Add product', save: 'Save product' },
  staff: { title: 'Add team member', save: 'Add to team' },
  package: { title: 'Sell a package', save: 'Save package' },
  booking: { title: 'New booking', save: 'Save booking' },
  policies: { title: 'Cancellations and no-shows', save: 'Save' },
}

export function mountIdle(root, store, { page = 'home' } = {}) {
  const state = { page, form: null, editing: null, status: '', values: {} }
  store.listen(() => !state.form && render())

  function render() {
    root.innerHTML = `
      <div class="idl">
        <aside class="idl-side">
          <div class="idl-pill">${icon('store', 16)}<span>${esc(store.business.short)}</span>${icon('chevron', 14)}</div>
          <nav aria-label="Idle">${PAGES.map(([id, label, ic]) => `<button type="button" data-nav="${id}" aria-current="${state.page === id ? 'page' : 'false'}">${icon(ic, 18)}<span>${label}</span></button>`).join('')}</nav>
        </aside>
        <main class="idl-main">${body()}</main>
      </div>`
    const form = root.querySelector('form[data-form]')
    if (form) for (const [k, v] of Object.entries(state.values)) setValue(form, k, v)
  }

  function setValue(form, name, value) {
    form.querySelectorAll(`[name="${name}"]`).forEach(el => {
      if (el.type === 'checkbox') el.checked = [].concat(value).includes(el.value)
      else el.value = value
    })
  }

  const head = (title, action, sub = '') => `<div class="idl-head"><div><h1>${title}</h1>${sub ? `<p class="idl-sub">${sub}</p>` : ''}</div>${action && !state.form ? `<button type="button" class="idl-btn primary" data-open="${action[0]}">${icon('plus', 16)}${action[1]}</button>` : ''}</div>
    ${state.status ? `<p class="idl-status" role="status">${icon('check', 15)}${esc(state.status)}</p>` : '<p role="status" hidden></p>'}`

  const prepaid = () => store.packages.reduce((a, x) => a + Number(x.paid || 0), 0)
  const credit = () => store.clients.reduce((a, c) => a + Number(c.credit || 0), 0)
  const daysSince = d => (d ? Math.round((new Date(2026, 10, 26) - new Date(d)) / 86400000) : 0)

  function body() {
    const p = state.page
    if (p === 'home') {
      const n = store.clients.length
      const byDay = new Map()
      for (const b of store.bookings) byDay.set(b.date, (byDay.get(b.date) ?? 0) + 1)
      const days = [...byDay.entries()].sort().slice(0, 7)
      const top = Math.max(1, ...days.map(d => d[1]))
      const alerts = store.clients.filter(c => c.alert)
      const tiles = [
        ['Clients', n, 'users'],
        ['Upcoming bookings', store.bookings.length, 'calendar'],
        ['Services', store.services.length, 'scissors'],
        ['Team', store.staff.length, 'store'],
        ['Prepaid packages', money(prepaid()), 'gift'],
        ['Store credit', money(credit()), 'coins'],
      ]
      return `${head('')}
        <section class="idl-hero"><div><p>Welcome to Idle</p><h1>${n ? `${esc(store.business.short)} is moving in.` : `Your new home, ${esc(store.business.short)}.`}</h1><span>${n ? `${n} clients, ${store.bookings.length} bookings and ${store.services.length} services so far.` : 'Bring your clients, services and team in to get started.'}</span></div><div class="idl-hero-art" aria-hidden="true"></div></section>
        <div class="idl-tiles">${tiles.map(([k, v, ic]) => `<div class="idl-tile" data-tile="${k}"><span class="idl-tile-ico">${icon(ic, 18)}</span><span>${k}</span><strong>${v}</strong></div>`).join('')}</div>
        <div class="idl-row2">
          <section class="idl-card idl-chart"><h2>Bookings ahead</h2>${days.length ? `<div class="idl-bars">${days.map(([d, c]) => `<div><i style="height:${Math.round((c / top) * 100)}%"></i><span>${DAY(d).split(' ').slice(0, 2).join(' ')}</span></div>`).join('')}</div>` : '<p class="idl-muted">Bookings will show here.</p>'}</section>
          <section class="idl-card idl-alerts"><h2>Health alerts</h2>${alerts.length ? `<ul>${alerts.slice(0, 4).map(c => `<li><span class="av h${hue(c.name)}" data-i="${initials(c.name)}"></span><b>${esc(c.name)}</b><em>${esc(c.alert)}</em></li>`).join('')}</ul>${alerts.length > 4 ? `<p class="idl-muted">and ${alerts.length - 4} more</p>` : ''}` : '<p class="idl-muted">Allergies and other alerts show on every booking.</p>'}</section>
        </div>`
    }
    if (p === 'clients') {
      return `${head('Clients', ['client', 'Add client'], store.clients.length ? `${store.clients.length} clients` : '')}${form()}${table(
        ['Name', 'Phone', 'Email', 'Visits', 'Alert', 'Credit'],
        store.clients.map(c => [`<span class="av h${hue(c.name)}" data-i="${initials(c.name)}"></span>${esc(c.name)}${c.vip === 'Yes' ? ' <em class="idl-tag">VIP</em>' : ''}`, esc(c.phone) || '-', esc(c.email), esc(c.visits || '0'), c.alert ? `<span class="idl-alert">${icon('alert', 13)}${esc(c.alert)}</span>` : '', c.credit ? money(c.credit) : '']),
        'No clients yet.',
      )}`
    }
    if (p === 'services') {
      return `${head('Services', ['service', 'Add service'])}${form()}${table(
        ['Service', 'Category', 'Duration', 'Buffer after', 'Price', 'Deposit'],
        store.services.map(s => [esc(s.name), `<span class="idl-chip c-${esc(s.category)}">${esc(s.category)}</span>`, `${s.minutes} min`, Number(s.buffer) ? `${s.buffer} min` : '-', money(s.price), Number(s.deposit) ? `${s.deposit}%` : '-']),
        'No services yet.',
        'data-service-row',
      )}`
    }
    if (p === 'products') {
      return `${head('Products', ['product', 'Add product'])}${form()}${table(['Product', 'SKU', 'Price', 'In stock'], store.products.map(x => [esc(x.name), esc(x.sku) || '-', money(x.price), x.stock === '' || x.stock === undefined ? '<em class="idl-tag">Count needed</em>' : Number(x.stock) < 8 ? `${esc(x.stock)} <em class="idl-tag">Low</em>` : esc(x.stock)]), 'No products yet.')}`
    }
    if (p === 'team') {
      return `${head('Team', ['staff', 'Add team member'])}${form()}${table(['Name', 'Role', 'Phone', 'Does'], store.staff.map(s => [`<span class="av h${hue(s.name)}" data-i="${initials(s.name)}"></span>${esc(s.name)}`, esc(s.role), esc(s.phone), [].concat(s.does).map(d => `<span class="idl-chip c-${d}">${d}</span>`).join(' ')]), 'Nobody on the team yet.')}`
    }
    if (p === 'packages') {
      return `${head('Packages', ['package', 'Sell a package'], store.packages.length ? `${money(prepaid())} prepaid` : '')}${form()}${table(['Client', 'Package', 'Sessions left', 'Paid', 'Expires'], store.packages.map(x => [esc(x.client), esc(x.name), `${x.left} of ${x.of}`, money(x.paid), x.expires ? `<span data-date="${esc(x.expires)}">${DAY(x.expires)} ${x.expires.slice(0, 4)}</span>` : '-']), 'No packages sold yet.')}`
    }
    if (p === 'messages') {
      return `${head('Idle DMs')}<section class="idl-card idl-empty-card">${icon('chat', 28)}<h2>Your AI receptionist is ready</h2><p>Connect WhatsApp and Idle answers clients, books them in and sends reminders.${store.bookings.length ? ` Reminders are ready for ${store.bookings.length} upcoming bookings.` : ''}</p><button type="button" class="idl-btn primary">Connect WhatsApp</button></section>`
    }
    if (p === 'sales') {
      return `${head('Sales')}<div class="idl-tiles"><div class="idl-tile"><span class="idl-tile-ico">${icon('receipt', 18)}</span><span>Sales today</span><strong>$0.00</strong></div><div class="idl-tile"><span class="idl-tile-ico">${icon('gift', 18)}</span><span>Prepaid packages carried over</span><strong>${money(prepaid())}</strong></div><div class="idl-tile"><span class="idl-tile-ico">${icon('coins', 18)}</span><span>Store credit carried over</span><strong>${money(credit())}</strong></div></div>`
    }
    if (p === 'marketing') {
      const lapsed = store.clients.filter(c => daysSince(c.lastVisit) > 60)
      return `${head('Marketing')}<section class="idl-card idl-empty-card">${icon('star', 28)}<h2>${lapsed.length ? `${lapsed.length} clients have not been in for over 60 days` : 'Win back quiet clients'}</h2><p>Idle can send them a friendly note with a booking link, from your own WhatsApp.</p><button type="button" class="idl-btn primary">Set up a win-back</button></section>`
    }
    if (p === 'reports') {
      const cats = CATEGORIES.map(c => [c, store.services.filter(s => s.category === c).length])
      const top = Math.max(1, ...cats.map(c => c[1]))
      return `${head('Reports')}<section class="idl-card idl-chart"><h2>Services by category</h2><div class="idl-hbars">${cats.map(([c, v]) => `<div><span>${c}</span><i style="width:${(v / top) * 100}%"></i><b>${v}</b></div>`).join('')}</div></section>`
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
              ['note', 'Booking policy note', pol.note ? esc(pol.note) : 'Not set'],
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
    if (f === 'client') inner = field('Name', 'name') + field('Phone', 'phone') + field('Email', 'email') + field('VIP', 'vip', select('vip', ['No', 'Yes'])) + field('Visits', 'visits') + field('Last visit', 'lastVisit', '<input name="lastVisit" type="date" />') + field('Store credit', 'credit') + field('Alert', 'alert') + `<label class="idl-field wide"><span>Notes</span><textarea name="notes" rows="2"></textarea></label>`
    if (f === 'service') inner = field('Name', 'name') + field('Category', 'category', select('category', CATEGORIES)) + field('Duration (min)', 'minutes') + field('Buffer after (min)', 'buffer') + field('Price', 'price') + field('Deposit (%)', 'deposit')
    if (f === 'product') inner = field('Name', 'name') + field('SKU', 'sku') + field('Price', 'price') + field('In stock', 'stock')
    if (f === 'staff') inner = field('Name', 'name') + field('Role', 'role') + field('Phone', 'phone') + `<fieldset class="idl-field wide"><legend>Does</legend>${CATEGORIES.map(c => `<label class="idl-check"><input type="checkbox" name="does" value="${c}" />${c}</label>`).join('')}</fieldset>`
    if (f === 'package') inner = field('Client', 'client', select('client', store.clients.map(c => c.name))) + field('Package', 'name') + field('Sessions left', 'left') + field('Sessions total', 'of') + field('Paid', 'paid') + field('Expires', 'expires', '<input name="expires" type="date" />')
    if (f === 'policies') inner = field('Late cancellation window (hours)', 'cancelHours') + field('Late cancellation fee (%)', 'cancelFee') + field('No-show fee (%)', 'noShowFee') + `<label class="idl-field wide"><span>Booking policy note</span><textarea name="note" rows="2"></textarea></label>`
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
      store.policies = { cancelHours: v.cancelHours, cancelFee: v.cancelFee, noShowFee: v.noShowFee, note: v.note }
      close('Policies saved.')
      return store.changed()
    }
    if (!v.name && !v.client) return
    // After a switch, the old app's ghost may catch an old habit before it is saved.
    const caught = store.guard?.(f, v) ?? null
    if (caught?.values) Object.assign(v, caught.values)
    for (const x of caught?.packages ?? []) store.packages.push({ expires: '', ...x })
    if (caught?.product) {
      store.products.push(caught.product)
      close('Saved as a product.')
      store.changed()
      return store.caught?.(caught, f, v)
    }
    if (f === 'client') store.clients.push(v)
    if (f === 'service') {
      if (state.editing !== null) store.services[state.editing] = v
      else store.services.push(v)
    }
    if (f === 'product') store.products.push(v)
    if (f === 'staff') store.staff.push(v)
    if (f === 'package') {
      if (!v.expires) return // every package needs an expiry date in Idle
      store.packages.push(v)
    }
    if (f === 'booking') store.bookings.push(v)
    const said = { client: 'Client added.', service: state.editing !== null ? 'Service updated.' : 'Service added.', product: 'Product added.', staff: 'Added to the team.', package: 'Package saved.', booking: 'Booking saved.' }[f]
    close(said)
    store.changed()
    if (caught) store.caught?.(caught, f, v)
  })

  render()
  return { state, render }
}
