// Boo looks around the old software, screen by screen, and writes down
// exactly what it shows. No export, no API: just the screens.

const num = t => Number(String(t).replace(/[^0-9.]/g, '')) || 0

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
      r.pace.move = seen.customers.length < 3 ? s(380) : s(60)
      await r.click(r.all('tbody tr[data-customer]')[k])
      const d = r.details('aside dl')
      seen.customers.push({ name: r.text(r.look('aside h2')), mobile: d.Mobile === '-' ? '' : d.Mobile, email: d.Email, visits: num(d.Visits), lastVisit: d['Last visit'], notes: r.look('aside textarea').value })
      const who = seen.customers.at(-1).name.replace(/\s*(★|\*\*VIP\*\*|\(.*?\))/g, '')
      ui.now('Reading Slotly: opening each customer to read their notes', `${who} (${seen.customers.length} of ${total})`)
      await r.press('aside [data-close]')
    }
    const next = r.all('[data-page="1"]')[0]
    if (!next || next.disabled) break
    await r.click(next)
  }

  r.pace.move = s(320)
  ui.now('Reading Slotly: services', 'Names, prices and the descriptions your team typed')
  await r.press('[data-nav]', 'Services')
  seen.services = r.table().map(row => ({ name: row.Service, mins: num(row.Mins), price: num(row.Price), description: row.Description }))

  ui.now('Reading Slotly: staff', 'Who works here and what they do')
  await r.press('[data-nav]', 'Staff')
  seen.staff = r.all('[data-person]').map(card => ({ name: r.text(card.querySelector('[data-k="name"]')), mobile: r.text(card.querySelector('[data-k="mobile"]')), notes: r.text(card.querySelector('[data-k="notes"]')) }))

  ui.now('Reading Slotly: appointments', 'Every booking in the diary, including the odd ones')
  await r.press('[data-nav]', 'Appointments')
  if (!r.look('[data-cal="list"][aria-pressed="true"]')) await r.press('[data-cal="list"]')
  seen.appointments = r.all('tr[data-appt]').map(tr => {
    const c = [...tr.cells].map(r.text)
    return { date: tr.cells[0].dataset.date, time: c[1], customer: c[2], service: c[3], staff: c[4], mins: num(c[5]) }
  })

  ui.now('Reading Slotly: reports and settings', 'Sales history, SMS credits and your booking terms')
  await r.press('[data-nav]', 'Reports')
  seen.sales = r.all('.sl-bars tr').map(tr => [r.text(tr.cells[0]), num(r.text(tr.cells[2]))])
  await r.press('[data-nav]', 'Settings')
  seen.terms = r.text(r.look('[data-terms]'))
  seen.smsCredits = num(r.text(r.look('[data-sms]')))
  await r.press('[data-nav]', 'Appointments')
  r.hide()
  return seen
}
