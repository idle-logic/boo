// The demo shop's data: Tuesday Grooming. Everything here is fictional.

export const STAFF = ['Hana', 'Tom']
export const SERVICES = [
  { name: 'Bath and tidy', hours: 1, price: 45 },
  { name: 'Full groom', hours: 2, price: 85 },
  { name: 'Deshed', hours: 2, price: 70 },
  { name: 'Nail trim', hours: 1, price: 15 },
  { name: 'Cat groom', hours: 2, price: 75 },
]
export const HOURS = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18]

export const CLIENTS = [
  { name: 'Mei Lin', pet: 'Kopi, toy poodle', staff: 'Hana', notes: 'Sensitive skin. Oatmeal shampoo only. No ear powder.', phone: '+65 9123 4567' },
  { name: 'Arjun Rao', pet: 'Mochi, cat', staff: 'Tom', notes: 'Towel dry only, hates the dryer. Mornings best.', phone: '+65 8234 5678' },
  { name: 'Sarah Okafor', pet: 'Luna, husky', staff: 'Hana', notes: 'Luna is nervous with men she does not know. Always Hana. Evenings suit Sarah.', phone: '+65 9345 6789' },
  { name: 'David Chen', pet: 'Pepper, shiba inu', staff: 'Tom', notes: 'Bites when nails are cut. Muzzle for nail trims.', phone: '+65 8456 7890' },
  { name: 'Grace Tan', pet: 'Biscuit, golden retriever', staff: 'Hana', notes: 'Senior dog, 12. Gentle handling, short sessions.', phone: '+65 9567 8901' },
]

/** The next six open days (the shop is closed on Sundays), starting today. */
export function openDays(from = new Date()) {
  const days = []
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate())
  while (days.length < 6) {
    if (d.getDay() !== 0) days.push(new Date(d))
    d.setDate(d.getDate() + 1)
  }
  return days
}

export const dayLabel = d => d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
export const timeLabel = h => `${String(h).padStart(2, '0')}:00`

/** A believable week: some slots already taken. Deterministic, so the demo is the same for everyone. */
export function seedBookings(days) {
  const pattern = [
    [0, 10, 'Hana', 'Mei Lin', 'Bath and tidy'],
    [0, 14, 'Tom', 'David Chen', 'Nail trim'],
    [0, 16, 'Hana', 'Grace Tan', 'Full groom'],
    [1, 9, 'Tom', 'Arjun Rao', 'Cat groom'],
    [1, 13, 'Hana', 'Grace Tan', 'Bath and tidy'],
    [2, 11, 'Hana', 'Mei Lin', 'Full groom'],
    [2, 15, 'Tom', 'David Chen', 'Full groom'],
    [3, 9, 'Hana', 'Grace Tan', 'Bath and tidy'],
    [3, 17, 'Hana', 'Mei Lin', 'Bath and tidy'],
    [3, 12, 'Tom', 'David Chen', 'Bath and tidy'],
    [4, 10, 'Hana', 'Grace Tan', 'Full groom'],
    [4, 10, 'Tom', 'Arjun Rao', 'Nail trim'],
    [5, 9, 'Hana', 'Mei Lin', 'Bath and tidy'],
  ]
  return pattern.map(([day, hour, staff, client, service]) => ({ day: dayLabel(days[day]), hour, staff, client, service }))
}

export const STOCK = [
  { item: 'Oatmeal shampoo', count: 2, low: 5, reorder: 12 },
  { item: 'Dog treats', count: 4, low: 10, reorder: 40 },
  { item: 'Towels', count: 30, low: 10, reorder: 20 },
  { item: 'Nail clippers', count: 6, low: 2, reorder: 4 },
]

export const SALES_TODAY = [
  { time: '09:40', client: 'Grace Tan', what: 'Bath and tidy', amount: 45 },
  { time: '11:15', client: 'Walk-in', what: 'Nail trim', amount: 15 },
  { time: '12:30', client: 'Mei Lin', what: 'Oatmeal shampoo (retail)', amount: 18 },
]

export const HOURS_THIS_WEEK = [
  { staff: 'Hana', hours: 36, rate: 30 },
  { staff: 'Tom', hours: 41, rate: 28 },
]

export const REVIEWS = [
  { who: 'Sarah O.', stars: 5, text: 'Hana is amazing with Luna. She used to shake at groomers and now she runs in.' },
  { who: 'Ken W.', stars: 2, text: 'Groom was fine but I waited 25 minutes past my booking time.' },
]

/** Messages already waiting when the demo opens. */
export const INBOX = [
  { from: 'Sarah Okafor', text: 'Hi! Can Luna come in Friday evening for a deshed? With Hana please 🙏' },
  { from: 'Arjun Rao', text: 'Hello, is there a slot for Mochi on Wednesday morning? Just a cat groom.' },
]

/** Messages a visitor can send as a customer, to watch Boo handle them. */
export const EXAMPLES = [
  { from: 'Mei Lin', text: 'Can Kopi get a bath tomorrow afternoon? Anytime after 2.' },
  { from: 'David Chen', text: 'I need to cancel Pepper this week, sorry. Something came up.' },
  { from: 'New number', text: 'Hi, how much is a full groom for a small poodle? And are you open Sunday?' },
]
