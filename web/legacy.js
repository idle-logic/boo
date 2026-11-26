// ClinicMaster 98: the dead software. A small clinic system from another era,
// with rules nobody wrote down. Boo has to discover them by using it.
//
// Its rules, which only show up as error codes when you break them:
//   101 Name is required            102 HP must be 8 digits starting with 8 or 9
//   103 DOB must be DD/MM/YYYY      104 HP already on file
//   105 Name is too long (30 letters at most). Easy to miss: only random testing finds it.
//   201 Choose a client, date and time   202 Date must be DD/MM/YYYY
//   210 Closed on Sundays           211 Slot already taken
//   Invoices add 9% GST, rounded DOWN to the cent (an old quirk).

export const LEGACY_SERVICES = [
  ['Bath', 45.0],
  ['Full groom', 85.5],
  ['Deshed', 69.95],
  ['Nail trim', 15.25],
]

const TIMES = ['09:00', '10:00', '11:00', '12:00', '14:00', '15:00', '16:00', '17:00']

export const LEGACY_SEED = [
  { name: 'Priya Nair', hp: '86789012', dob: '11/01/1995', pet: 'Mango', breed: 'Cavapoo', remarks: 'First groom was stressful. Go slow.' },
  { name: 'Ken Wong', hp: '97890123', dob: '03/06/1983', pet: 'Bao', breed: 'Corgi', remarks: 'Sheds a lot. Deshed every 6 weeks.' },
  { name: 'Aisha Rahman', hp: '88901234', dob: '27/09/1990', pet: 'Simba', breed: 'Persian cat', remarks: 'Matting behind ears.' },
  { name: 'Lily Chua', hp: '99012345', dob: '15/02/1998', pet: 'Coco', breed: 'Maltese', remarks: 'Allergic to lavender products.' },
]

export const LEGACY_SEED_BOOKINGS = [
  { client: 'Priya Nair', date: '08/12/2026', time: '10:00' },
  { client: 'Ken Wong', date: '08/12/2026', time: '14:00' },
  { client: 'Lily Chua', date: '09/12/2026', time: '11:00' },
]

export const LEGACY_SEED_INVOICES = [
  ['Priya Nair', 'Full groom'],
  ['Ken Wong', 'Deshed'],
]

const esc = t => String(t ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
const money = n => n.toFixed(2)

/** Parse DD/MM/YYYY strictly. Returns a Date or null. */
export function parseDmy(text) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(text ?? '').trim())
  if (!m) return null
  const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]))
  return d.getDate() === Number(m[1]) && d.getMonth() === Number(m[2]) - 1 ? d : null
}

/** The old GST maths: 9%, rounded down to the cent. */
export function legacyGst(price) {
  return Math.floor(Math.round(price * 9 * 100) / 100) / 100
}

function invoice(client, service) {
  const price = LEGACY_SERVICES.find(([n]) => n === service)[1]
  const gst = legacyGst(price)
  return { client, service, subtotal: price, gst, total: Math.round((price + gst) * 100) / 100 }
}

/**
 * Save an entry the old way: one check at a time, stopping at the first problem.
 * Changes state when it saves. Returns the error line, or null when saved.
 */
export function legacySave(state, kind, f) {
  if (kind === 'client') {
    if (!f.name) return 'Error 101: Name is required.'
    if (!/^[89]\d{7}$/.test(f.hp)) return 'Error 102: HP must be 8 digits starting with 8 or 9.'
    if (f.dob && !parseDmy(f.dob)) return 'Error 103: DOB must be DD/MM/YYYY.'
    if (state.clients.some(c => c.hp === f.hp)) return 'Error 104: HP already on file.'
    if (f.name.length > 30) return 'Error 105: Name is too long (30 letters at most).'
    state.clients.push({ name: f.name, hp: f.hp, dob: f.dob, pet: f.pet, breed: f.breed, remarks: f.remarks })
    state.status = 'Record saved.'
    return null
  }
  if (kind === 'booking') {
    if (!f.client || !f.date || !f.time) return 'Error 201: Choose a client, date and time.'
    const d = parseDmy(f.date)
    if (!d) return 'Error 202: Date must be DD/MM/YYYY.'
    if (d.getDay() === 0) return 'Error 210: Closed on Sundays.'
    if (state.bookings.some(b => b.date === f.date && b.time === f.time)) return 'Error 211: Slot already taken.'
    state.bookings.push({ client: f.client, date: f.date, time: f.time })
    state.status = 'Appointment booked.'
    return null
  }
  if (kind === 'invoice') {
    if (!f.client || !f.service) return 'Error 301: Choose a client and a service.'
    state.invoices.push(invoice(f.client, f.service))
    state.status = 'Invoice saved.'
    return null
  }
  return null
}

export function createLegacy(body) {
  const state = {
    screen: 'Clients',
    form: null, // 'client' | 'booking' | 'invoice' | null
    status: 'Ready.',
    clients: LEGACY_SEED.map(c => ({ ...c })),
    bookings: LEGACY_SEED_BOOKINGS.map(b => ({ ...b })),
    invoices: LEGACY_SEED_INVOICES.map(([client, service]) => invoice(client, service)),
  }

  function render() {
    body.innerHTML = `
      <div class="menubar" role="menubar" aria-label="ClinicMaster menu">
        ${['Clients', 'Appointments', 'Invoices'].map(s => `<button type="button" class="w98 menu${s === state.screen ? ' on' : ''}" data-screen="${s}">${s}</button>`).join('')}
      </div>
      <div class="w98-panel">${state.form ? formHtml() : screenHtml()}</div>
      <div class="statusbar"><span class="w98-status" role="status" data-boo-text>${esc(state.status)}</span><span>ClinicMaster 98 v2.1</span></div>`
  }

  function screenHtml() {
    if (state.screen === 'Clients') {
      return `<div class="grid-wrap"><table class="grid"><thead><tr><th>Name</th><th>HP</th><th>DOB</th><th>Pet</th><th>Breed</th><th>Remarks</th></tr></thead><tbody>
        ${state.clients.map(c => `<tr data-row><td>${esc(c.name)}</td><td>${esc(c.hp)}</td><td>${esc(c.dob)}</td><td>${esc(c.pet)}</td><td>${esc(c.breed)}</td><td>${esc(c.remarks)}</td></tr>`).join('')}
      </tbody></table></div><div class="w98-actions"><button type="button" class="w98" data-open="client">New client...</button></div>`
    }
    if (state.screen === 'Appointments') {
      return `<div class="grid-wrap"><table class="grid"><thead><tr><th>Date</th><th>Time</th><th>Client</th></tr></thead><tbody>
        ${state.bookings.map(b => `<tr data-row><td>${esc(b.date)}</td><td>${esc(b.time)}</td><td>${esc(b.client)}</td></tr>`).join('') || '<tr><td colspan="3">(none)</td></tr>'}
      </tbody></table></div><div class="w98-actions"><button type="button" class="w98" data-open="booking">Book...</button></div>`
    }
    return `<div class="grid-wrap"><table class="grid"><thead><tr><th>Client</th><th>Service</th><th>Subtotal</th><th>GST</th><th>Total</th></tr></thead><tbody>
      ${state.invoices.map(i => `<tr data-row><td>${esc(i.client)}</td><td>${esc(i.service)}</td><td>${money(i.subtotal)}</td><td>${money(i.gst)}</td><td>${money(i.total)}</td></tr>`).join('') || '<tr><td colspan="5">(none)</td></tr>'}
    </tbody></table></div><div class="w98-actions"><button type="button" class="w98" data-open="invoice">New invoice...</button></div>`
  }

  function formHtml() {
    const field = (label, input) => `<label class="w98-field"><span>${label}</span>${input}</label>`
    const text = (label, name) => field(label, `<input name="${name}" autocomplete="off" />`)
    const clientSelect = `<select name="client"><option value=""></option>${state.clients.map(c => `<option>${esc(c.name)}</option>`).join('')}</select>`
    let inner = ''
    if (state.form === 'client') inner = text('Name', 'name') + text('HP', 'hp') + text('DOB', 'dob') + text('Pet', 'pet') + text('Breed', 'breed') + text('Remarks', 'remarks')
    if (state.form === 'booking') inner = field('Client', clientSelect) + text('Date', 'date') + field('Time', `<select name="time"><option value=""></option>${TIMES.map(t => `<option>${t}</option>`).join('')}</select>`)
    if (state.form === 'invoice') inner = field('Client', clientSelect) + field('Service', `<select name="service"><option value=""></option>${LEGACY_SERVICES.map(([n, p]) => `<option value="${n}">${n} ($${money(p)})</option>`).join('')}</select>`)
    const title = { client: 'New client', booking: 'Book appointment', invoice: 'New invoice' }[state.form]
    return `<form class="w98-dialog" data-form="${state.form}" aria-label="${title}"><div class="w98-dialog-title">${title}</div>${inner}
      <div class="w98-actions"><button type="submit" class="w98">OK</button><button type="button" class="w98" data-cancel>Cancel</button></div></form>`
  }

  body.addEventListener('click', e => {
    const screen = e.target.closest('[data-screen]')
    if (screen) {
      state.screen = screen.dataset.screen
      state.form = null
      state.status = 'Ready.'
      return render()
    }
    const open = e.target.closest('[data-open]')
    if (open) {
      state.form = open.dataset.open
      state.status = 'Enter details and press OK.'
      return render()
    }
    if (e.target.closest('[data-cancel]')) {
      state.form = null
      state.status = 'Cancelled.'
      render()
    }
  })

  body.addEventListener('submit', e => {
    e.preventDefault()
    const f = Object.fromEntries([...new FormData(e.target)].map(([k, v]) => [k, String(v).trim()]))
    const error = legacySave(state, e.target.dataset.form, f)
    if (error) state.status = error
    else state.form = null
    render()
  })

  render()
  return {
    state,
    render,
    snapshot: () => structuredClone({ clients: state.clients, bookings: state.bookings, invoices: state.invoices }),
    restore(snap) {
      Object.assign(state, structuredClone(snap), { screen: 'Clients', form: null, status: 'Ready.' })
      render()
    },
  }
}
