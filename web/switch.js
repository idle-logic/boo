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

/**
 * Who does what in the move. Big jobs are shared, so the whole swarm works at once:
 * one ghost each for rules, services, products and the team, four for clients,
 * one for packages and two for bookings.
 */
export function crewsFor(records) {
  const share = (list, n) => Array.from({ length: n }, (_, i) => list.filter((_, k) => k % n === i))
  const crews = []
  if (records.policies) crews.push({ id: 'rules', name: 'Rules ghost', key: 'terms', policies: records.policies })
  crews.push({ id: 'setup', name: 'Services ghost', key: 'services', page: 'services', open: 'Add service', list: records.services })
  if (records.products.length) crews.push({ id: 'products', name: 'Products ghost', key: 'retail', page: 'products', open: 'Add product', list: records.products })
  crews.push({ id: 'team', name: 'Team ghost', key: 'merge', page: 'team', open: 'Add team member', list: records.staff })
  share(records.clients, 4).forEach((list, i) => crews.push({ id: i ? `clients-${i + 1}` : 'people', name: `Clients ghost ${i + 1}`, key: 'clients', page: 'clients', open: 'Add client', list }))
  crews.push({ id: 'packages', name: 'Packages ghost', key: 'packages', page: 'packages', open: 'Sell a package', list: records.packages, ready: (v, store) => store.clients.some(c => c.name === v.Client) })
  share(records.bookings, 2).forEach((list, i) =>
    crews.push({
      id: i ? `bookings-${i + 1}` : 'books',
      name: `Bookings ghost ${i + 1}`,
      key: 'bookings',
      page: 'calendar',
      open: 'New booking',
      list,
      ready: (v, store) => store.clients.some(c => c.name === v.Client) && store.services.some(x => x.name === v.Service) && store.staff.some(x => x.name === v['Team member']),
    }),
  )
  return crews.filter(c => c.policies || c.list.length)
}

/** Every crew at once, each in its own Idle tab. */
export async function move({ crews, lane, store, ui, speed = 1 }) {
  const s = ms => ms * speed
  const total = {}
  for (const c of crews) total[c.key] = (total[c.key] ?? 0) + (c.policies ? 1 : c.list.length)
  const done = Object.fromEntries(Object.keys(total).map(k => [k, 0]))
  await Promise.all(
    crews.map(async c => {
      const h = lane(c.id).hands
      h.pace.move = s(220)
      if (c.policies) {
        await h.press('[data-nav="settings"]')
        await h.press('button', 'Edit')
        await h.fill(c.policies, { typing: true })
        await h.submit()
        ui.progress(c.key, ++done[c.key], total[c.key])
        ui.moved?.(c.id, 'the cancellation rules', 1, 1)
        return h.hide()
      }
      for (const [i, v] of c.list.entries()) {
        if (c.ready) await waitFor(() => c.ready(v, store))
        if (!h.look(`[data-nav="${c.page}"][aria-current="page"]`)) await h.press(`[data-nav="${c.page}"]`)
        await h.press('button', c.open)
        await h.fill(v, { typing: i < 1 })
        await h.submit()
        h.pace.move = s(70)
        ui.progress(c.key, ++done[c.key], total[c.key])
        const what = c.page === 'packages' ? `${v.Client}'s ${v.Package}` : c.page === 'calendar' ? `${v.Client}'s ${v.Service} booking` : v.Name
        ui.moved?.(c.id, what, done[c.key], total[c.key])
      }
      h.hide()
    }),
  )
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
    ui.proof(matched, checks, ok ? null : label, label)
  }
  const table = async page => {
    await p.press(`[data-nav="${page}"]`)
    await pause(s(250))
    return p.table()
  }
  p.pace.move = s(220)
  ui.now('Checking', 'Every record, every dollar')
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
    `${records.clients.length} clients`,
    `${pk.length} packages · ${money(prepaidOld)} = ${money(prepaidNew)}`,
    d.credit !== false ? `Store credit · ${money(creditOld)} = ${money(creditNew)}` : 'Store credit kept in notes',
    `${records.services.length} services${records.products.length ? ` · ${records.products.length} products` : ''}`,
    `${records.staff.length} team${records.merged.size ? ' (1 merged)' : ''}`,
    `${records.bookings.length} bookings`,
  ]
  return { checks, matched, lines }
}
