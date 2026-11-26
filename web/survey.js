// Boo looks around the old software, screen by screen, and writes down
// exactly what it shows. No export, no API: just the screens.

const num = t => Number(String(t).replace(/[^0-9.]/g, '')) || 0

/** Glide over a few things on screen, so you can see Boo looking, then move on. */
async function glance(r, selector, n, ms) {
  r.pace.move = ms
  for (const el of r.all(selector).slice(0, n)) await r.move(el)
}

export async function survey({ r, ui, speed = 1, business }) {
  const s = ms => ms * speed
  const seen = { business, customers: [], services: [], staff: [], appointments: [], terms: '', smsCredits: 0, sales: [] }

  ui.now('Reading Slotly, screen by screen', 'Starting with your customers')
  await r.press('[data-nav]', 'Customers')
  const total = Number(/of (\d+)/.exec(r.text(r.look('.sl-pager span')))?.[1] ?? 0)
  for (;;) {
    // The app redraws after every click, so find each row again rather than holding on to it.
    const count = r.all('tbody tr[data-customer]').length
    for (let k = 0; k < count; k++) {
      // The first few slowly, so you can see what Boo does. The rest at a glance.
      r.pace.move = seen.customers.length < 3 ? s(380) : 0
      if (seen.customers.length === 3) ui.now('Reading Slotly: customers', `Reading the other ${total - 3} the same way`)
      await r.click(r.all('tbody tr[data-customer]')[k])
      const d = r.details('aside dl')
      seen.customers.push({ name: r.text(r.look('aside h2')), mobile: d.Mobile === '-' ? '' : d.Mobile, email: d.Email, visits: num(d.Visits), lastVisit: d['Last visit'], notes: r.look('aside textarea').value })
      const who = seen.customers.at(-1).name.replace(/\s*(★|\*\*VIP\*\*|\(.*?\))/g, '')
      if (seen.customers.length <= 3) ui.now('Reading Slotly: opening each customer to read their notes', `${who} (${seen.customers.length} of ${total})`)
      await r.press('aside [data-close]')
    }
    const next = r.all('[data-page="1"]')[0]
    if (!next || next.disabled) break
    await r.click(next)
  }
  await ui.collected({
    title: `Collected ${seen.customers.length} customers`,
    head: ['Name', 'Mobile', 'Notes'],
    rows: seen.customers.map(c => [c.name, c.mobile || '-', c.notes || '-']),
    next: 'Next: services',
  })

  r.pace.move = s(320)
  ui.now('Reading Slotly: services', 'Names, prices and the descriptions your team typed')
  await r.press('[data-nav]', 'Services')
  seen.services = r.table().map(row => ({ name: row.Service, mins: num(row.Mins), price: num(row.Price), description: row.Description }))
  await glance(r, 'tbody tr', 5, s(320))
  await ui.collected({
    title: `Collected ${seen.services.length} services`,
    head: ['Service', 'Mins', 'Price', 'Description'],
    rows: seen.services.map(s => [s.name, String(s.mins), `$${s.price}`, s.description || '-']),
    next: 'Next: staff',
  })

  ui.now('Reading Slotly: staff', 'Who works here and what they do')
  await r.press('[data-nav]', 'Staff')
  await glance(r, '[data-person]', 3, s(360))
  seen.staff = r.all('[data-person]').map(card => ({ name: r.text(card.querySelector('[data-k="name"]')), mobile: r.text(card.querySelector('[data-k="mobile"]')), notes: r.text(card.querySelector('[data-k="notes"]')) }))
  await ui.collected({
    title: `Collected ${seen.staff.length} staff`,
    head: ['Name', 'Mobile', 'Notes'],
    rows: seen.staff.map(s => [s.name, s.mobile, s.notes]),
    next: 'Next: appointments',
  })

  ui.now('Reading Slotly: appointments', 'Every booking in the diary, including the odd ones')
  await r.press('[data-nav]', 'Appointments')
  if (!r.look('[data-cal="list"][aria-pressed="true"]')) await r.press('[data-cal="list"]')
  await glance(r, 'tr[data-appt]', 5, s(300))
  seen.appointments = r.all('tr[data-appt]').map(tr => {
    const c = [...tr.cells].map(r.text)
    return { date: tr.cells[0].dataset.date, time: c[1], customer: c[2], service: c[3], staff: c[4], mins: num(c[5]) }
  })
  await ui.collected({
    title: `Collected ${seen.appointments.length} appointments`,
    head: ['Date', 'Time', 'Customer', 'Service'],
    rows: seen.appointments.map(a => [a.date.slice(5).split('-').reverse().join('/'), a.time, a.customer, a.service]),
    next: 'Next: reports and settings',
  })

  ui.now('Reading Slotly: reports and settings', 'Sales history, SMS credits and your booking terms')
  await r.press('[data-nav]', 'Reports')
  await glance(r, '.sl-bars tr', 3, s(300))
  seen.sales = r.all('.sl-bars tr').map(tr => [r.text(tr.cells[0]), num(r.text(tr.cells[2]))])
  await r.press('[data-nav]', 'Settings')
  await glance(r, '.sl-box', 3, s(360))
  seen.terms = r.text(r.look('[data-terms]'))
  seen.smsCredits = num(r.text(r.look('[data-sms]')))
  await r.press('[data-nav]', 'Appointments')
  r.hide()
  await ui.collected({
    title: 'Collected reports and settings',
    head: ['What', 'In Slotly'],
    rows: [...seen.sales.map(([m, v]) => [`Sales, ${m}`, `$${v.toLocaleString('en')}`]), ['SMS credits', seen.smsCredits.toLocaleString('en')], ['Booking terms', seen.terms]],
    next: 'Next: find the workarounds',
  })
  return seen
}
