// The salon being switched: everything it keeps in its current booking
// software. Made up for the demo, shaped like a real salon's records.

export const BUSINESS = { name: 'Maple & Mint Hair Studio', short: 'Maple & Mint' }

// name, category, minutes, clean-up minutes after, price, deposit %
export const SERVICES = [
  ["Women's cut & blow-dry", 'Haircuts', 60, 0, 68, 0],
  ["Men's cut", 'Haircuts', 30, 0, 38, 0],
  ["Kids' cut", 'Haircuts', 30, 0, 25, 0],
  ['Blow-dry', 'Styling & Blowouts', 45, 0, 45, 0],
  ['Bridal trial', 'Styling & Blowouts', 90, 0, 150, 50],
  ['Root colour', 'Colour Services', 90, 10, 120, 30],
  ['Full head colour', 'Colour Services', 120, 15, 168, 30],
  ['Balayage', 'Colour Services', 180, 15, 280, 30],
  ['Toner refresh', 'Colour Services', 45, 10, 65, 0],
  ['Keratin treatment', 'Hair Treatments', 150, 15, 320, 30],
  ['Scalp detox', 'Hair Treatments', 45, 0, 58, 0],
  ['Brow lamination & tint', 'Brows & Lashes', 50, 0, 75, 0],
].map(([name, category, minutes, cleanup, price, deposit]) => ({ name, category, minutes, cleanup, price, deposit }))

// Jas K. is the same person as Jasmine Koh: same phone, added twice years ago.
export const STAFF = [
  { name: 'Hana Lim', role: 'Senior stylist', phone: '+65 9123 4401', does: ['Haircuts', 'Styling & Blowouts', 'Colour Services'] },
  { name: 'Marcus Tan', role: 'Stylist', phone: '+65 9123 4402', does: ['Haircuts', 'Styling & Blowouts', 'Hair Treatments'] },
  { name: 'Jasmine Koh', role: 'Colourist', phone: '+65 9123 4403', does: ['Colour Services', 'Hair Treatments'] },
  { name: 'Jas K.', role: 'Brows', phone: '+65 9123 4403', does: ['Brows & Lashes'] },
  { name: 'Priya Raman', role: 'Brow artist', phone: '+65 9123 4405', does: ['Brows & Lashes'] },
]

export const POLICIES = {
  cancelHours: 24,
  cancelFee: 50, // % of the service price
  noShowFee: 100,
  lateMinutes: 15,
}

// name, SKU, price, in stock
export const PRODUCTS = [
  ['Bond repair treatment 100ml', 'BR-100', 52, 14],
  ['Argan hair oil 50ml', 'AO-50', 38, 22],
  ['Purple toning shampoo 300ml', 'PS-300', 32, 9],
  ['Curl defining cream 150ml', 'CC-150', 29, 6],
  ['Heat protect spray 200ml', 'HP-200', 27, 18],
  ['Scalp serum 30ml', 'SS-30', 46, 4],
  ['Clear brow gel', 'BG-01', 19, 25],
  ['Wide-tooth comb', 'WC-01', 8, 40],
].map(([name, sku, price, stock]) => ({ name, sku, price, stock }))

// What the old app's reports and marketing pages show. Read-only history, not moved.
export const REPORT = {
  months: [['Jun', 15820], ['Jul', 17240], ['Aug', 16910], ['Sep', 18130], ['Oct', 19480], ['Nov', 18420]],
  smsCredits: 1240,
  campaigns: [['Mid-year colour week', 'Sent 412', '18 Jun 2026'], ['Birthday treat', 'Automatic', 'Every month'], ['We miss you', 'Sent 96', '2 Oct 2026']],
}

export const PACKAGE_TYPES = [
  { name: '5 blow-dries', service: 'Blow-dry', sessions: 5, price: 200 },
  { name: "10 men's cuts", service: "Men's cut", sessions: 10, price: 340 },
  { name: '3 scalp detox', service: 'Scalp detox', sessions: 3, price: 150 },
]

const FIRST = ['Amelia', 'Rachel', 'Wei Ling', 'Daniel', 'Siti', 'Grace', 'Arjun', 'Hannah', 'Jia Hui', 'Marcus', 'Nur Aisyah', 'Olivia', 'Kenji', 'Mei', 'Farah', 'Lucas', 'Chloe', 'Ravi', 'Isabel', 'Zara', 'Ethan']
const LAST = ['Tan', 'Lim', 'Ng', 'Wong', 'Rahman', 'Goh', 'Pereira', 'Krishnan', 'Teo', 'Chua', 'Lee', 'Ong', 'Fernandez', 'Yeo']
const NOTES = [
  'Allergic to PPD. Patch test 48h before any colour.',
  'Sensitive scalp, use the gentle shampoo.',
  'Prefers Hana. Likes it quiet, no small talk.',
  'Pregnant, no chemical treatments until March.',
  'Always runs 10 min late, book the last slot.',
  'Fine hair, no thinning scissors.',
  'Allergic to latex gloves.',
  'Coming in for wedding on 14 Feb, bridal trial done.',
  '',
  '',
  '',
  'Usually books with her daughter.',
  'Asthma, avoid strong sprays.',
  '',
]

function seeded(seed) {
  let a = seed
  return () => {
    a = (a * 1103515245 + 12345) % 2147483648
    return a / 2147483648
  }
}

export function makeClients(count = 42) {
  const r = seeded(7)
  const pick = list => list[Math.floor(r() * list.length)]
  const used = new Set()
  const clients = []
  for (let i = 0; clients.length < count; i++) {
    const name = `${pick(FIRST)} ${pick(LAST)}`
    if (used.has(name)) continue
    used.add(name)
    const n = clients.length
    const phone = n % 14 === 5 ? '' : `+65 ${r() < 0.5 ? 8 : 9}${String(1000 + Math.floor(r() * 8999))} ${String(1000 + Math.floor(r() * 8999))}`
    const email = `${name.toLowerCase().replace(/[^a-z]+/g, '.')}@${pick(['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com'])}`
    const visits = 1 + Math.floor(r() * 30)
    const last = new Date(2026, 10, 25 - Math.floor(r() * 120))
    clients.push({
      name,
      phone,
      email,
      notes: NOTES[n % NOTES.length],
      visits,
      lastVisit: last.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
      vip: visits > 22,
      credit: n % 9 === 3 ? [20, 50, 35, 80][n % 4] : 0,
      packages: [],
    })
  }
  // Prepaid packages, part used.
  ;[2, 6, 9, 13, 17, 22, 27, 31, 38].forEach((c, i) => {
    const type = PACKAGE_TYPES[i % PACKAGE_TYPES.length]
    clients[c].packages.push({ name: type.name, left: Math.max(1, type.sessions - 1 - (i % 3)), of: type.sessions, paid: type.price })
  })
  return clients
}

const TIMES = ['10:00', '11:00', '12:30', '14:00', '15:30', '17:00']

export function makeBookings(clients) {
  const r = seeded(11)
  const bookings = []
  for (let i = 0; i < 18; i++) {
    const service = SERVICES[Math.floor(r() * SERVICES.length)]
    const staff = STAFF.filter(s => s.does.includes(service.category) && s.name !== 'Jas K.')
    let day = new Date(2026, 10, 27 + Math.floor(i / 2))
    if (day.getDay() === 1) day = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1) // closed Mondays
    bookings.push({
      client: clients[Math.floor(r() * clients.length)].name,
      service: service.name,
      staff: staff[Math.floor(r() * staff.length)].name,
      date: `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`,
      time: TIMES[(i * 5) % TIMES.length],
    })
  }
  return bookings
}

// ------------------------------------------------------------- what Slotly really holds
// Slotly cannot store packages, store credit, alerts, VIPs, products, deposits,
// clean-up time or cancellation rules. So over the years the team found ways
// around it: in names, in notes, as fake services and fake appointments.

export const IDLE_CATEGORY = { Haircuts: 'Cuts', 'Styling & Blowouts': 'Styling', 'Colour Services': 'Colour', 'Hair Treatments': 'Treatments', 'Brows & Lashes': 'Brows' }
const SHORT_PKG = { '5 blow-dries': 'blowdry', "10 men's cuts": 'mens cuts', '3 scalp detox': 'scalp detox' }
const SEVERE = /PPD|latex/i
export const TERMS = 'Cancellations less than 24 hours before your appointment are charged 50% of the service price. No-shows are charged in full. If you arrive more than 15 minutes late we may need to rebook you.'
const STAFF_NOTES = { 'Hana Lim': 'Senior stylist. Cuts, styling, colour', 'Marcus Tan': 'Stylist. Cuts, styling, treatments', 'Jasmine Koh': 'Colourist. Colour + treatments', 'Jas K.': 'brows only', 'Priya Raman': 'Brow artist' }

function rawCustomer(c, i) {
  let name = c.name
  let notes = c.notes
  if (c.vip) name = i % 2 ? `${name} ★` : `${name} **VIP**`
  if (SEVERE.test(notes) && i % 2 === 0) {
    name = `${name} (${/PPD/i.test(notes) ? 'PPD' : 'LATEX'} ALLERGY)`
    notes = notes.replace(/^Allergic to (PPD|latex gloves)\.?\s*/i, '')
  }
  const extra = []
  for (const p of c.packages) {
    const short = SHORT_PKG[p.name]
    extra.push(
      [
        `PKG ${short}: ${p.left} left of ${p.of}, paid $${p.paid}`,
        `prepaid ${p.of} ${short} ($${p.paid}) - ${p.left} remaining`,
        `${p.of}x ${short} pkg, ${p.of - p.left} used. pd $${p.paid}`,
      ][i % 3],
    )
  }
  // Some notes follow no pattern at all. Only something that understands language can read them.
  const ODD = {
    4: 'owes 2 blowdries from the Nov promo',
    8: 'paid ahead for 3 mens cuts in cash',
    11: 'voucher $40 from her mum, not used yet',
    15: 'NO SHOW twice, take a deposit next time',
    19: 'moving overseas in Jan, no promo msgs',
    24: "comped one scalp detox after a complaint, honour it next visit",
  }
  if (ODD[i]) extra.push(ODD[i])
  if (c.credit) extra.push([`credit $${c.credit}`, `$${c.credit} store credit (refund for late start)`, `has $${c.credit} credit on account`][i % 3])
  const phone = c.phone && i % 7 === 2 ? `${c.phone.replace('+65 ', '')} / 9${String(100 + i).padStart(3, '0')} 4410 (husband)` : c.phone.replace('+65 ', '')
  return { name, mobile: phone, email: c.email, visits: c.visits, lastVisit: c.lastVisit, notes: [notes, ...extra].filter(Boolean).join(' | ') }
}

/** Everything as Slotly shows it, workarounds and all. */
export function slotlyRecords() {
  const clients = makeClients()
  const bookings = makeBookings(clients)
  const appointments = []
  const time = mins => `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`
  for (const b of bookings) {
    const s = SERVICES.find(x => x.name === b.service)
    appointments.push({ date: b.date, time: b.time, customer: clients.find(c => c.name === b.client) ? rawCustomer(clients.find(c => c.name === b.client), clients.findIndex(c => c.name === b.client)).name : b.client, service: b.service, staff: b.staff, mins: s.minutes })
    if (s.cleanup) {
      const [h, m] = b.time.split(':').map(Number)
      appointments.push({ date: b.date, time: time(h * 60 + m + s.minutes), customer: '-', service: 'CLEAN UP', staff: b.staff, mins: s.cleanup })
    }
  }
  const days = [...new Set(bookings.map(b => b.date))].sort().slice(0, 4)
  days.forEach((d, i) => appointments.push({ date: d, time: '13:00', customer: 'BLOCKED', service: 'Lunch', staff: ['Hana Lim', 'Marcus Tan', 'Jasmine Koh', 'Priya Raman'][i], mins: 60 }))
  appointments.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
  return {
    truth: { clients, bookings },
    customers: clients.map(rawCustomer),
    services: [
      ...SERVICES.map(s => ({ name: s.name, mins: s.minutes, price: s.price, description: s.deposit ? `DEPOSIT ${s.deposit}% at booking` : '' })),
      ...PRODUCTS.map(p => ({ name: `RETAIL - ${p.name}`, mins: 0, price: p.price, description: 'sell at front desk' })),
      { name: 'CLEAN UP', mins: 15, price: 0, description: 'block after colour / keratin' },
    ],
    staff: STAFF.map(s => ({ name: s.name, mobile: s.phone.replace('+65 ', ''), notes: STAFF_NOTES[s.name] })),
    appointments,
    terms: TERMS,
    smsCredits: REPORT.smsCredits,
    sales: REPORT.months,
  }
}

/** What a booking costs and when it ends. Both apps quote the same way, if set up the same. */
export function quote(service, start, { cleanup = service.cleanup, policies = POLICIES } = {}) {
  const [h, m] = start.split(':').map(Number)
  const end = h * 60 + m + service.minutes + cleanup
  const time = mins => `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`
  return {
    price: service.price.toFixed(2),
    ends: time(end),
    deposit: ((service.price * service.deposit) / 100).toFixed(2),
    cancelFee: ((service.price * policies.cancelFee) / 100).toFixed(2),
  }
}
