// The switch, start to finish:
//   Read   - go through every screen of the old software and write down everything
//   Plan   - the AI maps categories, flags health notes and spots people entered twice
//   Move   - three agents enter it all into Idle at once, through Idle's own screens
//   Prove  - the same test bookings in both apps, and every record checked;
//            anything that differs is investigated and fixed, or brought to you
// The old software is only ever read. Nothing in it is changed.

import { makePlan, idleRecords } from './plan.js'

const pause = ms => new Promise(r => setTimeout(r, ms))
const num = t => Number(String(t).replace(/[^0-9.]/g, '')) || 0
const waitFor = async (test, every = 120) => {
  while (!test()) await pause(every)
}

export async function runSwitch({ oldHands, idleLanes, proofHands, store, ui, speed = 1 }) {
  const t0 = performance.now()
  const s = ms => ms * speed

  // ------------------------------------------------------------------ read
  ui.phase('read', 'now', 'Opening Slotly')
  const learned = { clients: [], services: [], staff: [], policies: {}, bookings: [] }
  const r = oldHands

  ui.feed('Reading clients, one profile at a time.')
  await r.press('[data-nav]', 'Clients')
  for (let pageNo = 0; ; pageNo++) {
    // The app redraws after every click, so find each row again rather than holding on to it.
    const count = r.all('tbody tr[data-client]').length
    for (let k = 0; k < count; k++) {
      r.pace.move = learned.clients.length < 3 ? s(320) : s(55)
      await r.click(r.all('tbody tr[data-client]')[k])
      const d = r.details('aside dl')
      const packages = r.all('[data-package]').map(el => {
        const m = /^(.*?) · (\d+) of (\d+) left · paid \$([\d.,]+)/.exec(r.text(el))
        return m ? { name: m[1], left: Number(m[2]), of: Number(m[3]), paid: num(m[4]) } : null
      }).filter(Boolean)
      learned.clients.push({
        name: r.text(r.look('aside h2')),
        phone: d.Phone === '-' ? '' : d.Phone,
        email: d.Email,
        visits: num(d.Visits),
        vip: d.Tags === 'VIP',
        credit: d['Store credit'] === '-' ? 0 : num(d['Store credit']),
        notes: d.Notes === '-' ? '' : d.Notes,
        packages,
      })
      ui.count('clients', learned.clients.length)
      ui.count('packages', learned.clients.reduce((a, c) => a + c.packages.length, 0))
      await r.press('aside [data-close]')
    }
    const next = r.all('[data-page="1"]')[0]
    if (!next || next.disabled) break
    await r.click(next)
  }

  r.pace.move = s(240)
  ui.feed('Reading services, prices and deposits.')
  await r.press('[data-nav]', 'Services')
  learned.services = r.table().map(row => ({
    name: row.Service,
    category: row.Category,
    minutes: num(row.Duration),
    price: num(row.Price),
    deposit: row.Deposit === 'None' ? 0 : num(row.Deposit),
  }))
  ui.count('services', learned.services.length)

  ui.feed('Reading the team.')
  await r.press('[data-nav]', 'Team')
  learned.staff = r.all('[data-person]').map(card => ({
    name: r.text(card.querySelector('[data-k="name"]')),
    role: r.text(card.querySelector('[data-k="role"]')),
    phone: r.text(card.querySelector('[data-k="phone"]')),
    does: [...card.querySelectorAll('[data-k="does"] .sl-chip')].map(r.text),
  }))
  ui.count('team', learned.staff.length)

  ui.feed('Reading cancellation and no-show rules.')
  await r.press('[data-nav]', 'Settings')
  const policy = k => num(r.text(r.look(`[data-policy="${k}"] strong`)))
  learned.policies = { cancelHours: policy('cancelHours'), cancelFee: policy('cancelFee'), noShowFee: policy('noShowFee'), lateMinutes: policy('lateMinutes') }
  ui.count('policies', 4)

  ui.feed('Reading upcoming bookings.')
  await r.press('[data-nav]', 'Calendar')
  await r.press('[data-cal="list"]')
  learned.bookings = r.all('tr[data-booking]').map(tr => {
    const c = [...tr.cells].map(r.text)
    return { date: tr.cells[0].dataset.date, time: c[1], client: c[2], service: c[3], staff: c[4] }
  })
  ui.count('bookings', learned.bookings.length)
  r.hide()
  const prepaid = learned.clients.flatMap(c => c.packages).reduce((a, p) => a + p.paid, 0)
  ui.phase('read', 'done', `${learned.clients.length} clients, ${learned.services.length} services, ${learned.staff.length} team, ${learned.bookings.length} bookings`)

  // ------------------------------------------------------------------ plan
  ui.phase('plan', 'now', 'Working out how it maps onto Idle')
  const { req, plan } = await makePlan(learned)
  ui.feed(plan.by === 'ai' ? 'Plan made with AI and checked.' : 'AI unavailable, planned with built-in rules.')
  const cats = Object.entries(plan.categories)
  ui.planItems([
    ...cats.map(([a, b]) => `“${a}” goes to ${b}`),
    `${plan.alerts.length} notes are health alerts, like “${plan.alerts[0]?.alert ?? '-'}”. They will show as alerts in Idle.`,
  ])
  ui.phase('plan', 'done', `${cats.length} categories mapped, ${plan.alerts.length} health alerts${plan.by === 'ai' ? ', with AI' : ''}`)

  // A question for the owner, asked while the work goes on.
  let merge = null
  const pair = plan.sameStaff[0]
  if (pair) {
    const [a, b] = pair.map(i => learned.staff[i])
    ui.question({
      title: `Are “${b.name}” and “${a.name}” the same person?`,
      detail: `Both have the phone number ${a.phone}. If they are, I will add one team member who does ${[...new Set([...a.does, ...b.does])].map(c => plan.categories[c]).join(', ')}, and move ${b.name}'s bookings to ${a.name}.`,
      choices: [
        { label: `Yes, merge into ${a.name}`, primary: true, value: true },
        { label: 'No, keep both', value: false },
      ],
    }).then(v => {
      merge = v
      ui.feed(v ? `Merging ${b.name} into ${a.name}.` : `Keeping ${b.name} and ${a.name} separate.`)
    })
  } else merge = false

  // ------------------------------------------------------------------ move
  ui.phase('move', 'now', 'Three agents at work in Idle')
  const recordsFor = () => idleRecords(learned, plan, { merge: merge !== false })
  let records = recordsFor()
  const [setup, people, books] = idleLanes
  const totals = { setup: 1 + records.services.length + records.staff.length, people: records.clients.length, books: records.packages.length + records.bookings.length }
  ui.lane('setup', 0, totals.setup)
  ui.lane('people', 0, totals.people)
  ui.lane('books', 0, totals.books)

  async function enter(h, page, open, values, i) {
    if (!h.look(`[data-nav="${page}"][aria-current="page"]`)) await h.press(`[data-nav="${page}"]`)
    await h.press('button', open)
    await h.fill(values, { typing: i < 2 })
    await h.submit()
  }

  const laneSetup = (async () => {
    const h = setup.hands
    h.pace.move = s(220)
    await h.press('[data-nav="settings"]')
    await h.press('button', 'Edit')
    await h.fill(records.policies, { typing: true })
    await h.submit()
    let done = 1
    ui.lane('setup', done, totals.setup)
    for (const [i, svc] of records.services.entries()) {
      h.pace.move = i < 2 ? s(220) : s(70)
      await enter(h, 'services', 'Add service', svc, i)
      ui.lane('setup', ++done, totals.setup)
    }
    if (merge === null) {
      ui.feed('Setup agent is waiting for your answer about the team.')
      ui.lane('setup', done, totals.setup, 'Waiting for you')
      await waitFor(() => merge !== null)
    }
    records = recordsFor()
    totals.setup = 1 + records.services.length + records.staff.length
    for (const [i, person] of records.staff.entries()) {
      await enter(h, 'team', 'Add team member', person, i)
      ui.lane('setup', ++done, totals.setup)
    }
    h.hide()
  })()

  const lanePeople = (async () => {
    const h = people.hands
    for (const [i, c] of records.clients.entries()) {
      h.pace.move = i < 2 ? s(220) : s(45)
      await enter(h, 'clients', 'Add client', c, i)
      ui.lane('people', i + 1, totals.people)
    }
    h.hide()
  })()

  const laneBooks = (async () => {
    const h = books.hands
    let done = 0
    for (const [i, p] of records.packages.entries()) {
      await waitFor(() => store.clients.some(c => c.name === p.Client))
      h.pace.move = i < 2 ? s(220) : s(60)
      await enter(h, 'packages', 'Sell a package', p, i)
      ui.lane('books', ++done, totals.books)
    }
    ui.lane('books', done, totals.books, 'Waiting for clients, services and team')
    await waitFor(() => store.clients.length === records.clients.length && store.services.length === records.services.length && merge !== null && store.staff.length === recordsFor().staff.length)
    records = recordsFor()
    totals.books = records.packages.length + records.bookings.length
    for (const [i, b] of records.bookings.entries()) {
      h.pace.move = i < 2 ? s(220) : s(60)
      await enter(h, 'calendar', 'New booking', b, i)
      ui.lane('books', ++done, totals.books)
    }
    h.hide()
  })()

  await Promise.all([laneSetup, lanePeople, laneBooks])
  ui.phase('move', 'done', `${store.clients.length} clients, ${store.services.length} services, ${store.staff.length} team, ${store.packages.length} packages, ${store.bookings.length} bookings`)

  // ------------------------------------------------------------------ prove
  ui.phase('prove', 'now', 'Same test bookings in both apps')
  ui.watch('proof')
  const p = proofHands
  let checks = 0
  let matched = 0
  let fixed = 0
  const tally = (ok, label) => {
    checks++
    if (ok) matched++
    ui.proof(matched, checks, ok ? null : label)
  }
  const testClient = records.clients[0].Name
  const staffFor = svc => {
    const cat = learned.services.find(x => x.name === svc).category
    return learned.staff.find(x => x.does.includes(cat) && x.name !== learned.staff[pair?.[1]]?.name)?.name
  }

  async function quoteOld(svc) {
    await r.press('[data-new]')
    await r.fill({ Client: testClient, Service: svc, Staff: staffFor(svc), Date: '2026-12-02', Time: '14:00' })
    const q = r.details('[data-quote]')
    await r.press('[data-cancel]')
    return q
  }
  async function quoteNew(svc) {
    if (!p.look('[data-nav="calendar"][aria-current="page"]')) await p.press('[data-nav="calendar"]')
    await p.press('button', 'New booking')
    await p.fill({ Client: testClient, Service: svc, 'Team member': staffFor(svc), Date: '2026-12-02', Time: '14:00' })
    const q = p.details('[data-quote]')
    await p.press('[data-cancel]')
    return q
  }
  const same = (a, b) => ['Price', 'Blocked until', 'Deposit due now', 'Late cancellation fee'].filter(k => a[k] !== b[k])

  r.pace.move = s(120)
  p.pace.move = s(120)
  const wrong = []
  for (const svc of learned.services.map(x => x.name)) {
    const [a, b] = await Promise.all([quoteOld(svc), quoteNew(svc)])
    const diff = same(a, b)
    if (diff.length) wrong.push({ svc, a, b, diff })
    tally(!diff.length, `${svc}: ${diff.map(k => `${k.toLowerCase()} ${a[k]} in Slotly, ${b[k]} in Idle`).join('; ')}`)
    r.pace.move = s(60)
    p.pace.move = s(60)
  }

  if (wrong.length) {
    const ex = wrong[0]
    ui.feed(`${wrong.length} services end at different times. ${ex.svc}: Slotly blocks until ${ex.a['Blocked until']}, Idle until ${ex.b['Blocked until']}. Looking into it.`, 'warn')
    ui.phase('prove', 'now', `Investigating ${wrong.length} differences`)
    r.pace.move = s(260)
    p.pace.move = s(220)
    await r.press('[data-nav]', 'Services')
    const cleanup = {}
    for (const w of wrong) {
      const row = r.all('tr[data-service]').find(tr => r.text(tr.cells[0]) === w.svc)
      await r.click(row)
      cleanup[w.svc] = num(r.details('aside dl')['Clean-up time after'])
      await r.press('aside [data-close]')
    }
    ui.feed(`Found it. Slotly adds clean-up time after ${Object.keys(cleanup).join(', ')}, shown only inside each service. Setting the same buffer in Idle.`, 'warn')
    await p.press('[data-nav="services"]')
    for (const w of wrong) {
      const row = p.all('tr[data-service-row]').find(tr => p.text(tr.cells[0]) === w.svc)
      await p.click(row)
      await p.fill({ 'Buffer after (min)': String(cleanup[w.svc]) }, { typing: true })
      await p.submit()
      fixed++
      const svc = learned.services.find(x => x.name === w.svc)
      svc.cleanup = cleanup[w.svc]
    }
    ui.feed('Checking those services again.')
    r.pace.move = s(90)
    p.pace.move = s(90)
    for (const w of wrong) {
      const [a, b] = await Promise.all([quoteOld(w.svc), quoteNew(w.svc)])
      // Already counted once as a check; now it matches, or it stays a difference.
      if (!same(a, b).length) matched++
      ui.proof(matched, checks, same(a, b).length ? `${w.svc} still differs` : null)
    }
  }

  // Every record, read back from Idle's own screens.
  p.pace.move = s(160)
  ui.feed('Reading every record back from Idle.')
  const idleTable = async page => {
    await p.press(`[data-nav="${page}"]`)
    return p.table()
  }
  const clients = await idleTable('clients')
  for (const c of learned.clients) {
    const got = clients.find(x => x.Name.replace(/ VIP$/, '') === c.name)
    tally(got && got.Phone === (c.phone || '-') && got.Email === c.email && num(got.Credit) === c.credit, `Client ${c.name}`)
    await pause(s(12))
  }
  const pk = await idleTable('packages')
  for (const c of learned.clients) for (const x of c.packages) tally(pk.some(row => row.Client === c.name && row.Package === x.name && row['Sessions left'] === `${x.left} of ${x.of}` && num(row.Paid) === x.paid), `Package for ${c.name}`)
  const bk = await idleTable('calendar')
  for (const b of records.bookings) tally(bk.some(row => row.Client === b.Client && row.Time === b.Time && row.Service === b.Service && row['Team member'] === b['Team member']), `Booking for ${b.Client}`)
  const team = await idleTable('team')
  for (const t of records.staff) tally(team.some(row => row.Name === t.Name), `Team member ${t.Name}`)
  await p.press('[data-nav="settings"]')
  for (const [k, v] of Object.entries(learned.policies)) tally(num(p.text(p.look(`[data-policy="${k}"] dd`))) === v, `Policy ${k}`)
  p.hide()
  r.hide()

  const seconds = Math.round((performance.now() - t0) / 1000)
  ui.phase('prove', 'done', `${matched} of ${checks} checks match${fixed ? `, ${fixed} fixed on the way` : ''}`)
  const summary = {
    seconds,
    clients: store.clients.length,
    services: store.services.length,
    team: store.staff.length,
    merged: merge ? 1 : 0,
    packages: store.packages.length,
    prepaid,
    credit: learned.clients.reduce((a, c) => a + c.credit, 0),
    bookings: store.bookings.length,
    alerts: plan.alerts.length,
    checks,
    matched,
    fixed,
    by: plan.by,
  }
  ui.done(summary)
  return { learned, plan, summary, req }
}
