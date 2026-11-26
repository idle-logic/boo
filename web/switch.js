// The switch to Idle, once the owner has confirmed how each workaround should
// work there. Three agents enter everything through Idle's own screens, then
// every Slotly record is accounted for and the money read from notes is
// matched to the dollar.

const pause = ms => new Promise(r => setTimeout(r, ms))
const num = t => Number(String(t).replace(/[^0-9.]/g, '')) || 0
const waitFor = async (test, every = 120) => {
  while (!test()) await pause(every)
}

export const policyNote = minutes => `Please arrive on time. If you are more than ${minutes} minutes late, we may need to rebook you.`

/** What each Idle form gets, following the owner's answers. */
export function idleRecords(read, d) {
  const merged = new Map() // duplicate staff name -> the name they become
  if (d.merge !== false) for (const [a, b] of read.sameStaff) merged.set(read.staff.find(s => s.src === b).name, read.staff.find(s => s.src === a).name)
  const staff = read.staff
    .filter(s => !merged.has(s.name))
    .map(s => ({ Name: s.name, Role: s.role, Phone: s.phone, Does: [...new Set([s, ...read.staff.filter(t => merged.get(t.name) === s.name)].flatMap(x => x.does))] }))
  return {
    merged,
    clients: read.clients.map(c => ({
      Name: c.name,
      Phone: c.phone,
      Email: c.email,
      VIP: c.vip && d.vip !== false ? 'Yes' : 'No',
      Visits: String(c.visits),
      'Last visit': c.lastVisit,
      'Store credit': c.credit && d.credit !== false ? String(c.credit) : '',
      Alert: d.alerts !== false ? c.alert : '',
      Notes: [c.notes, d.credit === false ? c.creditFrom : '', d.alerts === false ? c.alert : ''].filter(Boolean).join(' '),
    })),
    services: read.services.map(s => ({ Name: s.name, Category: s.category, 'Duration (min)': String(s.minutes), 'Buffer after (min)': String(d.cleanup !== false ? s.buffer : 0), Price: String(s.price), 'Deposit (%)': String(d.deposits !== false ? s.deposit : 0) })),
    products: d.retail !== false ? read.products.map(p => ({ Name: p.name, Price: String(p.price) })) : [],
    staff,
    packages: read.clients.flatMap(c => c.packages.map(p => ({ Client: c.name, Package: p.name, 'Sessions left': String(p.left), 'Sessions total': String(p.of), Paid: String(p.paid), Expires: d.packages ?? '2027-11-26' }))),
    bookings: read.bookings.map(b => ({ Client: b.client, Service: b.service, 'Team member': merged.get(b.staff) ?? b.staff, Date: b.date, Time: b.time })),
    policies: d.terms !== false ? { 'Late cancellation window (hours)': String(read.policies.cancelHours), 'Late cancellation fee (%)': String(read.policies.cancelFee), 'No-show fee (%)': String(read.policies.noShowFee), 'Booking policy note': policyNote(read.policies.lateMinutes) } : null,
  }
}

export async function move({ records, lanes, store, ui, speed = 1 }) {
  const s = ms => ms * speed
  const [setup, people, books] = lanes
  async function enter(h, page, open, values, i) {
    if (!h.look(`[data-nav="${page}"][aria-current="page"]`)) await h.press(`[data-nav="${page}"]`)
    await h.press('button', open)
    await h.fill(values, { typing: i < 1 })
    await h.submit()
  }
  const laneSetup = (async () => {
    const h = setup.hands
    h.pace.move = s(260)
    if (records.policies) {
      ui.working('setup', 'terms')
      await h.press('[data-nav="settings"]')
      await h.press('button', 'Edit')
      await h.fill(records.policies, { typing: true })
      await h.submit()
      ui.progress('terms', 1, 1)
    }
    for (const [key, page, open, list] of [['services', 'services', 'Add service', records.services], ['retail', 'products', 'Add product', records.products], ['merge', 'team', 'Add team member', records.staff]]) {
      ui.working('setup', key)
      for (const [i, v] of list.entries()) {
        h.pace.move = i < 1 ? s(260) : s(80)
        await enter(h, page, open, v, i)
        ui.progress(key, i + 1, list.length)
      }
    }
    h.hide()
  })()
  const lanePeople = (async () => {
    const h = people.hands
    ui.working('people', 'clients')
    for (const [i, c] of records.clients.entries()) {
      h.pace.move = i < 1 ? s(260) : s(60)
      await enter(h, 'clients', 'Add client', c, i)
      ui.progress('clients', i + 1, records.clients.length)
    }
    h.hide()
  })()
  const laneBooks = (async () => {
    const h = books.hands
    ui.working('books', 'packages')
    for (const [i, p] of records.packages.entries()) {
      await waitFor(() => store.clients.some(c => c.name === p.Client))
      h.pace.move = i < 1 ? s(260) : s(80)
      await enter(h, 'packages', 'Sell a package', p, i)
      ui.progress('packages', i + 1, records.packages.length)
    }
    ui.working('books', 'bookings')
    await waitFor(() => store.clients.length === records.clients.length && store.services.length === records.services.length && store.staff.length === records.staff.length)
    for (const [i, b] of records.bookings.entries()) {
      h.pace.move = i < 1 ? s(260) : s(80)
      await enter(h, 'calendar', 'New booking', b, i)
      ui.progress('bookings', i + 1, records.bookings.length)
    }
    h.hide()
  })()
  await Promise.all([laneSetup, lanePeople, laneBooks])
}

/**
 * Account for every Slotly record and match the money, by reading Idle's own screens.
 * Returns { checks, matched, lines } where lines are the reconciliation the owner sees.
 */
export async function prove({ seen, read, records, d, p, ui, speed = 1 }) {
  const s = ms => ms * speed
  let checks = 0
  let matched = 0
  const tally = (ok, label) => {
    checks++
    if (ok) matched++
    ui.proof(matched, checks, ok ? null : label)
  }
  const table = async page => {
    await p.press(`[data-nav="${page}"]`)
    await pause(s(250))
    return p.table()
  }
  p.pace.move = s(220)
  ui.now('Reading everything back from Idle', 'Every record, and every dollar')
  const clients = await table('clients')
  for (const c of records.clients) tally(clients.some(x => x.Name.replace(/ VIP$/, '') === c.Name && x.Phone === (c.Phone || '-') && x.Email === c.Email && x.Visits === c.Visits), `Client ${c.Name}`)
  const pk = await table('packages')
  for (const x of records.packages) tally(pk.some(row => row.Client === x.Client && row.Package === x.Package && row['Sessions left'] === `${x['Sessions left']} of ${x['Sessions total']}` && num(row.Paid) === Number(x.Paid)), `Package for ${x.Client}`)
  const prepaidOld = read.clients.flatMap(c => c.packages).reduce((a, x) => a + x.paid, 0)
  const prepaidNew = pk.reduce((a, row) => a + num(row.Paid), 0)
  tally(prepaidOld === prepaidNew, 'Prepaid total')
  const creditOld = d.credit !== false ? read.clients.reduce((a, c) => a + c.credit, 0) : 0
  const creditNew = clients.reduce((a, row) => a + num(row.Credit), 0)
  tally(creditOld === creditNew, 'Store credit total')
  const svc = await table('services')
  for (const x of records.services) tally(svc.some(row => row.Service === x.Name && num(row['Buffer after']) === Number(x['Buffer after (min)']) && num(row.Deposit) === Number(x['Deposit (%)'])), `Service ${x.Name}`)
  if (records.products.length) {
    const prods = await table('products')
    for (const x of records.products) tally(prods.some(row => row.Product === x.Name && num(row.Price) === Number(x.Price)), `Product ${x.Name}`)
  }
  const team = await table('team')
  for (const t of records.staff) tally(team.some(row => row.Name === t.Name), `Team member ${t.Name}`)
  const bk = await table('calendar')
  for (const b of records.bookings) tally(bk.some(row => row.Client === b.Client && row.Time === b.Time && row.Service === b.Service && row['Team member'] === b['Team member']), `Booking for ${b.Client}`)
  if (records.policies) {
    await p.press('[data-nav="settings"]')
    for (const [k, v] of [['cancelHours', read.policies.cancelHours], ['cancelFee', read.policies.cancelFee], ['noShowFee', read.policies.noShowFee]]) tally(num(p.text(p.look(`[data-policy="${k}"] dd`))) === v, `Rule ${k}`)
  }
  p.hide()
  const money = n => `$${n.toLocaleString('en')}`
  const lines = [
    `${seen.customers.length} customers → ${records.clients.length} clients`,
    `${read.clients.flatMap(c => c.packages).length} packages from notes → ${pk.length} in Idle · ${money(prepaidOld)} = ${money(prepaidNew)}`,
    d.credit !== false ? `Store credit from notes ${money(creditOld)} = ${money(creditNew)}` : 'Store credit left in the notes, as you chose',
    `${seen.services.length} services in Slotly → ${records.services.length} services${records.products.length ? `, ${records.products.length} products` : ''}, 1 clean-up block`,
    `${seen.staff.length} staff → ${records.staff.length} team members${records.merged.size ? ', 1 merged' : ''}`,
    `${seen.appointments.length} appointments → ${records.bookings.length} bookings, ${read.cleanups.length} clean-ups now buffers, ${read.breaks.length} breaks`,
  ]
  return { checks, matched, lines }
}
