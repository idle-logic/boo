// Boo doing what you ask, in the app you are using. The same brain as the
// browser demo, driving real software through the universal connector.

import { runAgent } from '../agent/agent.js'
import { think as geminiThink, BrainBusyError } from '../agent/gemini.js'

// The free AI tier sometimes says "busy". Wait a little and try again before giving up.
const RETRY_WAITS_MS = [2000, 5000, 10000]
async function thinkPatiently(input) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await geminiThink(input, process.env.GEMINI_API_KEY)
    } catch (err) {
      if (!(err instanceof BrainBusyError) || attempt >= RETRY_WAITS_MS.length) throw err
      await new Promise(r => setTimeout(r, RETRY_WAITS_MS[attempt]))
    }
  }
}
import { uiaAdapter, NotAllowedError } from './uia-adapter.js'

function dateContext() {
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)
  const long = d => d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
  return `Today is ${long(today)}. Tomorrow is ${long(tomorrow)}.`
}

export class Operator {
  /**
   * hands: Hands. haunt(event): tell Boo something.
   * toOverlay(rect): screen pixels to overlay coordinates.
   * ask(text) -> Promise<boolean>: Yes or No from the person.
   */
  constructor({ hands, haunt, toOverlay, ask }) {
    Object.assign(this, { hands, haunt, toOverlay, ask })
    this.running = false
    this.stopRequested = false
  }

  stop() {
    this.stopRequested = true
  }

  async run(goal, { startTitle = '' } = {}) {
    if (this.running) {
      this.haunt({ type: 'say', text: 'One thing at a time. I am still on the last one.' })
      return
    }
    if (!process.env.GEMINI_API_KEY) {
      this.haunt({ type: 'fail', text: 'Add a free Gemini key to .env.local, then ask me again.' })
      return
    }
    this.running = true
    this.stopRequested = false
    this.haunt({ type: 'start', text: 'On it.' })
    let thought = ''
    const adapter = uiaAdapter({
      hands: this.hands,
      startTitle,
      guide: async el => {
        const spot = this.toOverlay({ x: el.x, y: el.y, w: el.w, h: el.h })
        this.haunt({ type: 'guide', x: spot.x, y: spot.y, h: spot.h, text: thought })
        await new Promise(r => setTimeout(r, 450))
      },
    })
    let result
    try {
      result = await runAgent({
        goal: `${dateContext()}\n\nThe person asked: "${goal}". Do it in the app on screen. If it is a question, look and answer it with done. Ask nothing you can find out by looking.`,
        adapter,
        think: thinkPatiently,
        approve: description => (process.env.HAUNT_AUTOPILOT === '1' ? Promise.resolve(true) : this.ask(`${description}?`)),
        onStep: s => {
          thought = s.thought || s.description
          if (s.kind === 'say') this.haunt({ type: 'say', text: s.action.text })
        },
        shouldStop: () => this.stopRequested,
      })
    } catch (err) {
      result = { ok: false, summary: err instanceof NotAllowedError ? err.message : `Something went wrong: ${err?.message ?? err}` }
    }
    this.running = false
    this.haunt({ type: 'release' })
    this.haunt(result.ok ? { type: 'done', text: result.summary } : { type: 'fail', text: result.summary })
    console.log(`[operator] ${result.ok ? 'done' : 'stopped'}: ${result.summary}`)
    return result
  }
}
