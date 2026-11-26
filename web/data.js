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
