// A day at Tuesday Grooming, from opening to closing, in a few minutes.
// Things happen on their own. Routine work goes to the crew. Real decisions
// go to "Needs you".

export const OPEN = 9 * 60
export const CLOSE = 19 * 60
/** Real milliseconds per shop minute. 600 shop minutes take about 3 minutes. */
export const MS_PER_MINUTE = 300

export const clock = m => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`

const message = (from, text) => ({ kind: 'message', from, text })

/** What happens today, in order. at is shop minutes since midnight. */
export const TIMELINE = [
  { at: 9 * 60 + 4, ...message('Sarah Okafor', 'Hi! Can Luna come in Friday evening for a deshed? With Hana please 🙏') },
  { at: 9 * 60 + 25, ...message('Arjun Rao', 'Hello, is there a slot for Mochi on Wednesday morning? Just a cat groom.') },
  { at: 10 * 60 + 10, kind: 'sale', item: 'Oatmeal shampoo', client: 'Mei Lin', amount: 18 },
  { at: 10 * 60 + 50, kind: 'review', review: { who: 'Ken W.', stars: 2, text: 'Groom was fine but I waited 25 minutes past my booking time.' } },
  { at: 11 * 60 + 40, ...message('Mei Lin', 'Can Kopi get a bath tomorrow afternoon? Anytime after 2.') },
  { at: 13 * 60 + 15, kind: 'review', review: { who: 'Sarah O.', stars: 5, text: 'Hana is amazing with Luna. She used to shake at groomers and now she runs in.' } },
  { at: 13 * 60 + 45, ...message('David Chen', 'I need to cancel Pepper this week, sorry. Something came up.') },
  { at: 14 * 60 + 30, kind: 'sick', staff: 'Tom' },
  { at: 15 * 60 + 20, ...message('New number', 'Hi, how much is a full groom for a small poodle? And are you open Sunday?') },
  { at: 16 * 60 + 10, kind: 'refund', from: 'Grace Tan', text: 'Can I get a refund for Biscuit’s groom on Monday? He came home with a nick on his paw.' },
  { at: 17 * 60 + 30, kind: 'payroll' },
]

/** Turn something that happened into either a job for the crew, or a decision for the person. */
export function plan(event) {
  switch (event.kind) {
    case 'message':
      return {
        job: {
          kind: 'message',
          title: `Reply to ${event.from}`,
          apps: ['Idle DMs', 'Idle Bookings'],
          goal: `Handle the newest message from ${event.from} in Idle DMs. Open their chat and read it. Check the calendar, their client notes and the store rules. Do what they ask if the store can: book, move or cancel in Idle Bookings. Then reply to them in the chat. If they ask something the store cannot do, offer the nearest option.`,
        },
        toast: { app: 'Idle DMs', title: event.from, text: event.text },
      }
    case 'sale':
      return {
        job: {
          kind: 'stock',
          title: 'Reorder low stock',
          apps: ['Idle Back office'],
          goal: 'Open Idle Back office, go to Stock, and reorder anything marked low.',
        },
        toast: { app: 'Idle Back office', title: 'Stock running low', text: `${event.item}: only a few left` },
      }
    case 'review':
      if (event.review.stars <= 3) {
        return {
          decision: {
            title: `${event.review.who} left a ${event.review.stars}-star review`,
            detail: `"${event.review.text}" I can reply with an apology and a 10% discount on their next visit.`,
            yes: 'Send that reply',
            job: {
              kind: 'review',
              title: `Reply to ${event.review.who}`,
              apps: ['Idle Back office'],
              goal: `Open Idle Back office, go to Reviews, and reply to ${event.review.who}'s review. Apologise sincerely in two short sentences and offer 10% off their next visit. Then post the reply.`,
            },
          },
          toast: { app: 'Idle Back office', title: 'New review', text: `${'★'.repeat(event.review.stars)} from ${event.review.who}` },
        }
      }
      return {
        job: {
          kind: 'review',
          title: `Thank ${event.review.who}`,
          apps: ['Idle Back office'],
          goal: `Open Idle Back office, go to Reviews, and reply to ${event.review.who}'s review with a warm thank you in one or two short sentences. Then post it.`,
        },
        toast: { app: 'Idle Back office', title: 'New review', text: `${'★'.repeat(event.review.stars)} from ${event.review.who}` },
      }
    case 'sick':
      return {
        decision: {
          title: `${event.staff} called in sick for tomorrow`,
          detail: `${event.staff} has bookings tomorrow. I can move them to Hana where she is free and let each client know.`,
          yes: 'Move them to Hana',
          job: {
            kind: 'sick',
            title: `Cover ${event.staff}'s bookings`,
            apps: ['Idle DMs', 'Idle Bookings'],
            goal: `${event.staff} is off sick tomorrow. In Idle Bookings, open tomorrow in the calendar and find ${event.staff}'s bookings. For each one, cancel it and book the same client and service with Hana at the same time if she is free, or her nearest free time that day. Then message each client in Idle DMs to say who will look after them and when.`,
          },
        },
        toast: { app: 'Phone', title: `${event.staff}`, text: 'Feeling rough, cannot come in tomorrow. Sorry!' },
      }
    case 'refund':
      return {
        decision: {
          title: `${event.from} is asking for a refund`,
          detail: `"${event.text}" This is money, so it is your call. I can reply kindly and say you will call her today.`,
          yes: 'Reply and I will call',
          job: {
            kind: 'refund',
            title: `Reply to ${event.from}`,
            apps: ['Idle DMs'],
            goal: `Reply to ${event.from} in Idle DMs. Say sorry about the nick on Biscuit's paw, that the owner will call her today about the refund, and ask if Biscuit is okay. Two or three short sentences. Do not promise an amount.`,
          },
        },
        toast: { app: 'Idle DMs', title: event.from, text: event.text },
        message: true,
      }
    case 'payroll':
      return {
        job: {
          kind: 'payroll',
          title: 'Run payroll',
          apps: ['Idle Back office'],
          goal: 'Open Idle Back office, go to Staff and payroll, check the hours, then run payroll for this week.',
        },
        toast: { app: 'Idle Back office', title: 'Payroll', text: 'Payroll for this week is due Friday' },
      }
    default:
      return {}
  }
}
