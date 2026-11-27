// Changes the owner asks Boo for in the chat. Gemini proposes them; nothing is applied unless it fits the data.
// Every edit is checked here: the record must exist, the field must be one we know, and the value must make sense.

export const CATS = ['Cuts', 'Styling', 'Colour', 'Treatments', 'Brows']
const same = (a, b) => String(a ?? '').trim().toLowerCase() === String(b ?? '').trim().toLowerCase()
const text = (v, max = 120) => (typeof v === 'string' || typeof v === 'number' ? String(v).trim().slice(0, max) : null)
const num = (v, lo, hi) => (v !== '' && v !== null && Number.isFinite(Number(v)) && Number(v) >= lo && Number(v) <= hi ? Number(v) : null)
const int = (v, lo, hi) => (num(v, lo, hi) !== null && Number.isInteger(Number(v)) ? Number(v) : null)
const bool = v => (typeof v === 'boolean' ? v : /^(yes|true)$/i.test(String(v)) ? true : /^(no|false)$/i.test(String(v)) ? false : null)
const date = v => (/^\d{4}-\d{2}-\d{2}$/.test(String(v)) ? String(v) : null)
const time = v => (/^\d{1,2}:\d{2}$/.test(String(v)) ? String(v).padStart(5, '0') : null)
const cats = v => {
  const list = [].concat(v).map(x => CATS.find(c => same(c, x))).filter(Boolean)
  return list.length ? [...new Set(list)] : null
}

/** Field checks per kind of record. Each returns the clean value, or null if it does not fit. */
const FIELDS = {
  client: { name: v => text(v, 60) || null, phone: v => text(v, 30), email: v => text(v, 80), alert: v => text(v, 60), credit: v => num(v, 0, 10000), vip: bool, notes: v => text(v, 300), visits: v => int(v, 0, 10000), packageLeft: v => int(v, 0, 100) },
  service: { name: v => text(v, 60) || null, price: v => num(v, 0, 5000), minutes: v => int(v, 5, 600), category: v => cats(v)?.[0] ?? null, buffer: v => int(v, 0, 120), deposit: v => num(v, 0, 100) },
  staff: { name: v => text(v, 60) || null, role: v => text(v, 60), phone: v => text(v, 30), does: cats },
  product: { name: v => text(v, 60) || null, price: v => num(v, 0, 5000) },
  booking: { date, time, service: v => text(v, 60), staff: v => text(v, 60), client: v => text(v, 60) },
  policy: { cancelHours: v => int(v, 0, 168), cancelFee: v => num(v, 0, 100), noShowFee: v => num(v, 0, 100), lateMinutes: v => int(v, 0, 120) },
}
const LISTS = { client: 'clients', service: 'services', staff: 'staff', product: 'products', booking: 'bookings' }

/** Keep only edits that have the right shape. Gemini's answer is never trusted as is. */
export function cleanEdits(raw) {
  const list = Array.isArray(raw) ? raw : raw ? [raw] : []
  return list
    .slice(0, 12)
    .filter(e => e && typeof e === 'object' && FIELDS[e.target])
    .map(e => ({ action: ['add', 'remove'].includes(e.action) ? e.action : 'set', target: e.target, name: text(e.name, 80) ?? '', date: e.date, time: e.time, field: e.field, value: e.value, record: e.record && typeof e.record === 'object' ? e.record : null }))
}

function findBooking(read, e) {
  const hits = read.bookings.filter(b => same(b.client, e.name) && (!date(e.date) || b.date === date(e.date)) && (!time(e.time) || b.time === time(e.time)))
  return hits.length === 1 ? hits[0] : hits.length ? 'many' : null
}

/**
 * Apply a list of edits to Boo's reading. Returns { done: [sentences], failed: [sentences] }.
 * Renames carry through to bookings and packages, so nothing points at an old name.
 */
export function applyEdits(read, edits) {
  const done = []
  const failed = []
  for (const e of edits) {
    const said = applyOne(read, e)
    if (said?.ok) done.push(said.ok)
    else failed.push(said?.no ?? `Could not change ${e.name || e.target}`)
  }
  return { done, failed }
}

function applyOne(read, e) {
  const checks = FIELDS[e.target]
  if (e.target === 'policy') {
    const v = checks[e.field]?.(e.value)
    if (v === null || v === undefined) return { no: `That rule does not fit` }
    read.policies[e.field] = v
    return { ok: `Rule changed: ${e.field} is now ${v}` }
  }
  const list = read[LISTS[e.target]]

  if (e.action === 'add') {
    const r = e.record ?? {}
    const out = {}
    for (const [k, check] of Object.entries(checks)) if (r[k] !== undefined && r[k] !== '') out[k] = check(r[k])
    if (Object.values(out).some(v => v === null)) return { no: `Some details for the new ${e.target} do not fit` }
    if (e.target === 'booking') {
      const b = { date: out.date, time: out.time, client: out.client ?? e.name, service: out.service, staff: out.staff }
      if (!b.date || !b.time || !read.clients.some(c => same(c.name, b.client)) || !read.services.some(s => same(s.name, b.service)) || !read.staff.some(s => same(s.name, b.staff))) return { no: 'A new booking needs a known client, service, team member, date and time' }
      list.push({ src: -1, ...b })
      return { ok: `Booked ${b.client} for ${b.service} on ${b.date} at ${b.time}` }
    }
    const name = out.name ?? text(e.name, 60)
    if (!name) return { no: `A new ${e.target} needs a name` }
    if (list.some(x => same(x.name, name))) return { no: `${name} is already there` }
    const base = {
      client: { phone: '', email: '', visits: 0, lastVisit: '', vip: false, alert: '', credit: 0, packages: [], notes: '' },
      service: { category: 'Cuts', minutes: 60, buffer: 0, price: 0, deposit: 0 },
      staff: { role: '', phone: '', does: [] },
      product: { price: 0 },
    }[e.target]
    const { packageLeft, ...rest } = out
    list.push({ src: -1, ...base, ...rest, name })
    return { ok: `Added ${e.target} ${name}` }
  }

  if (e.target === 'booking') {
    const b = findBooking(read, e)
    if (b === 'many') return { no: `${e.name} has more than one booking. Which date?` }
    if (!b) return { no: `No booking found for ${e.name}` }
    if (e.action === 'remove') return read.bookings.splice(read.bookings.indexOf(b), 1), { ok: `Cancelled ${b.client}'s ${b.service} on ${b.date}` }
    const v = checks[e.field]?.(e.value)
    if (v === null || v === undefined) return { no: `That booking change does not fit` }
    if (e.field === 'service' && !read.services.some(s => same(s.name, v))) return { no: `There is no service called ${v}` }
    if (e.field === 'staff' && !read.staff.some(s => same(s.name, v))) return { no: `Nobody on the team is called ${v}` }
    if (e.field === 'client' && !read.clients.some(c => same(c.name, v))) return { no: `There is no client called ${v}` }
    b[e.field] = v
    return { ok: `${b.client}'s booking: ${e.field} is now ${v}` }
  }

  const r = list.find(x => same(x.name, e.name))
  if (!r) return { no: `There is no ${e.target} called ${e.name}` }
  if (e.action === 'remove') {
    list.splice(list.indexOf(r), 1)
    if (e.target === 'client') read.bookings = read.bookings.filter(b => !same(b.client, r.name))
    return { ok: `Removed ${r.name}` }
  }
  if (e.target === 'client' && e.field === 'packageLeft') {
    const p = r.packages[0]
    const v = checks.packageLeft(e.value)
    if (!p || v === null || v > p.of) return { no: `${r.name}'s package can't have that many left` }
    p.left = v
    return { ok: `${r.name}'s ${p.name} now has ${p.left} of ${p.of} left` }
  }
  const check = checks[e.field]
  if (!check) return { no: `I can't change ${e.field} on a ${e.target}` }
  const v = check(e.value)
  if (v === null) return { no: `“${e.value}” doesn't fit ${e.field}` }
  if (e.field === 'name' && list.some(x => x !== r && same(x.name, v))) return { no: `${v} is already taken` }
  const old = r.name
  r[e.field] = v
  if (e.field === 'name') {
    const key = { client: 'client', service: 'service', staff: 'staff' }[e.target]
    if (key) for (const b of read.bookings) if (same(b[key], old)) b[key] = v
  }
  const shown = Array.isArray(v) ? v.join(', ') : typeof v === 'boolean' ? (v ? 'yes' : 'no') : v
  return { ok: e.field === 'name' ? `${old} is now ${v}` : `${r.name}: ${e.field} is now ${shown === '' ? 'empty' : shown}` }
}

/** The new app's records, rebuilt from the reading, keeping anything the app added itself (like stock counts). */
export function storeFrom(records, store) {
  const keep = (list, name) => list.find(x => same(x.name, name)) ?? {}
  store.clients = records.clients.map(r => ({ ...keep(store.clients, r.Name), name: r.Name, phone: r.Phone, email: r.Email, vip: r.VIP, visits: r.Visits, lastVisit: r['Last visit'], credit: r['Store credit'], alert: r.Alert, notes: r.Notes }))
  store.services = records.services.map(r => ({ ...keep(store.services, r.Name), name: r.Name, category: r.Category, minutes: r['Duration (min)'], buffer: r['Buffer after (min)'], price: r.Price, deposit: r['Deposit (%)'] }))
  store.products = records.products.map(r => ({ sku: '', stock: '', ...keep(store.products, r.Name), name: r.Name, price: r.Price }))
  store.staff = records.staff.map(r => ({ ...keep(store.staff, r.Name), name: r.Name, role: r.Role, phone: r.Phone, does: r.Does }))
  store.packages = records.packages.map(r => ({ client: r.Client, name: r.Package, left: r['Sessions left'], of: r['Sessions total'], paid: r.Paid, expires: r.Expires }))
  store.bookings = records.bookings.map(r => ({ client: r.Client, service: r.Service, staff: r['Team member'], date: r.Date, time: r.Time }))
  if (records.policies) store.policies = { cancelHours: records.policies['Late cancellation window (hours)'], cancelFee: records.policies['Late cancellation fee (%)'], noShowFee: records.policies['No-show fee (%)'], note: records.policies['Booking policy note'] }
  store.changed()
}
