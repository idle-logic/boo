// Boo tells you what is going on in your software.
//
// Every few seconds Boo reads the text of the app you are using (never
// password fields). When it changes, the model decides whether anything is
// worth saying: a new booking, an unread message, someone waiting. Most of the
// time the answer is nothing, and Boo stays quiet.
//
// Screen text goes to the model, so this is off until you turn it on.

import { askJson, hasModel } from './model.js'

const READ_EVERY_MS = 6000
const MIN_GAP_MS = 25_000 // at most one model call this often
const MAX_LINES = 160

/** Lines in `now` that were not in `before`. */
export function newLines(before, now) {
  const seen = new Set(before)
  return now.filter(l => !seen.has(l))
}

/** Is the change worth a model call? Ignores clocks and tiny flickers. */
export function meaningfulChange(added) {
  const real = added.filter(l => !/^\d{1,2}:\d{2}(\s?[ap]m)?$/i.test(l.trim()) && l.trim().length > 3)
  return real.length >= 1
}

export function ambientPrompt(title, lines, added, recent) {
  return {
    system: `You sit quietly beside the person at the front desk of a small clinic, spa, salon or groomer. You can see the text of the app they are using.

Speak only when something new needs their attention or is good to know right now: a new booking or cancellation, an unread message, a customer waiting, a payment that failed, a double booking, a form with a mistake. Otherwise stay quiet.

Reply with one JSON object and nothing else: { "say": "<one short sentence, or empty>" }

Rules:
1. Under 15 words. Plain, warm English. No em dashes.
2. Never repeat something you already said.
3. Never read out private details like full phone numbers or card numbers.
4. Do not describe the app or narrate what they are typing.`,
    user: `App: ${title}

New since last look:
${added.slice(0, 40).join('\n')}

Everything on screen now:
${lines.slice(0, MAX_LINES).join('\n')}

You said recently:
${recent.length ? recent.join('\n') : '(nothing)'}`,
  }
}

export class Ambient {
  constructor({ hands, haunt, busy }) {
    this.hands = hands
    this.haunt = haunt
    this.busy = busy // () => true while Boo is doing something else, like a migration
    this.on = false
    this.timer = null
    this.last = { title: '', lines: [] }
    this.lastCall = 0
    this.recent = []
  }

  start() {
    if (this.on) return
    if (!hasModel()) {
      this.haunt({ type: 'say', text: 'Add a free Gemini key to .env.local first, then I can watch for you.' })
      return
    }
    this.on = true
    this.haunt({ type: 'say', text: 'I will keep an eye on your apps and tell you what matters.' })
    this.tick()
  }

  stop() {
    this.on = false
    clearTimeout(this.timer)
    this.haunt({ type: 'say', text: 'Okay, I will stop watching.' })
  }

  async tick() {
    if (!this.on) return
    try {
      if (!this.busy()) await this.look()
    } catch {
      // A failed look is not worth bothering anyone about.
    }
    this.timer = setTimeout(() => this.tick(), READ_EVERY_MS)
  }

  async look() {
    const screen = await this.hands.ask({ cmd: 'read', skipPid: process.pid }, 15000)
    if (!screen.ok || !screen.title) return
    const lines = (screen.lines ?? []).slice(0, MAX_LINES)
    const sameApp = screen.title === this.last.title
    const added = sameApp ? newLines(this.last.lines, lines) : []
    this.last = { title: screen.title, lines }
    if (!sameApp || !meaningfulChange(added)) return
    if (Date.now() - this.lastCall < MIN_GAP_MS) return
    this.lastCall = Date.now()

    const reply = await askJson(ambientPrompt(screen.title, lines, added, this.recent))
    const say = typeof reply?.say === 'string' ? reply.say.trim() : ''
    if (!say || this.recent.includes(say)) return
    this.recent = [...this.recent, say].slice(-6)
    this.haunt({ type: 'say', text: say })
  }
}
