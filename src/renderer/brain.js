// What Boo is doing right now, and why. Pure logic: given the world and the
// time, it returns where to go, which pose to show and what to say.

import { GHOST, PHYSICS, reachable } from './world.js'

export const SLEEP_AFTER_MS = 120_000
/** In an alert, Boo waits where it is unless the cursor moves this far away. */
export const ALERT_FOLLOW_PX = 320
const SAY_MS_PER_CHAR = 60

/** Events from Kiro (through hooks, the CLI or MCP) and from you. */
export const EVENT_TYPES = ['start', 'tool', 'done', 'fail', 'needs-you', 'say', 'click', 'grab', 'drop', 'wake', 'tuck', 'untuck', 'guide', 'guide-say', 'wait', 'release', 'letgo', 'goto']

export class Brain {
  constructor(rand = Math.random) {
    this.rand = rand
    this.mode = 'wander' // wander | work | celebrate | alert | scared | sleep | held | guide | tucked
    this.plan = null // walk to x | jump to a ledge | drop off an edge | rest
    this.bubble = null // { text, until, sticky, tone }
    this.modeUntil = 0
    this.lastActivity = 0
    this.workText = ''
    this.celebrateJumps = 0
    this.blinkUntil = 0
    this.nextBlink = 0
    this.queued = null
    this.guide = null // where Boo hovers while filling a form: { x, y, h }
  }

  /** Something happened. Returns nothing; the next update reflects it. */
  handle(event, now) {
    const text = (event.text ?? '').toString().slice(0, 140)
    this.lastActivity = now
    // While Kiro is waiting on you, nothing else takes the stage. Keep the latest
    // news and show it once you have clicked.
    if (this.mode === 'alert' && ['start', 'tool', 'done', 'fail', 'say', 'tuck'].includes(event.type)) {
      if (event.type !== 'tool' && event.type !== 'tuck') this.queued = event
      return
    }
    // Tucked away in the corner, Boo ignores small talk. Big news brings it out.
    if (this.mode === 'tucked' && ['start', 'tool', 'say'].includes(event.type)) return
    switch (event.type) {
      case 'start':
        this.mode = 'work'
        this.workText = text || 'Kiro is on it'
        this.say(this.workText, now, { tone: 'work' })
        this.modeUntil = now + 15 * 60_000
        break
      case 'tool':
        if (this.mode !== 'alert') {
          if (this.mode !== 'work') this.mode = 'work'
          this.modeUntil = now + 15 * 60_000
          this.say(text || 'working', now, { tone: 'work', ms: 2600 })
        }
        break
      case 'done':
        this.mode = 'celebrate'
        this.celebrateJumps = 3
        this.modeUntil = now + 4000
        this.say(text ? `Done! ${text}` : 'Done! Come and look.', now, { sticky: true, tone: 'happy', ms: 30_000 })
        break
      case 'fail':
        this.mode = 'scared'
        this.modeUntil = now + 5000
        this.say(text || 'Something broke.', now, { sticky: true, tone: 'scared', ms: 30_000 })
        break
      case 'needs-you':
        this.alertSpot = null
        this.mode = 'alert'
        this.modeUntil = Infinity
        this.say(text ? `Kiro needs you: ${text}` : 'Kiro needs you.', now, { sticky: true, tone: 'alert', ms: Infinity })
        break
      case 'say':
        this.say(text, now, {})
        if (this.mode === 'sleep') this.mode = 'wander'
        break
      case 'click':
        if (this.bubble?.sticky) this.bubble = null
        if (this.mode === 'guide') return // the migration decides what a click means
        if (this.mode === 'tucked') {
          this.mode = 'wander'
          this.say('Peekaboo!', now, { ms: 1500 })
          return
        }
        if (this.mode === 'alert' && this.queued) {
          const next = this.queued
          this.queued = null
          this.mode = 'wander'
          this.handle(next, now)
          return
        }
        if (this.mode === 'alert' || this.mode === 'celebrate' || this.mode === 'scared') this.mode = 'wander'
        else if (this.mode === 'sleep') {
          this.mode = 'wander'
          this.say('Huh? I was resting my eyes.', now, { ms: 2500 })
        } else this.say(pick(['Boo!', 'Hehe.', 'That tickles.', 'Hi!'], this.rand), now, { ms: 1600 })
        this.plan = null
        break
      case 'grab':
        if (this.mode !== 'held') this.beforeHeld = this.mode
        this.mode = 'held'
        this.plan = null
        break
      case 'letgo':
        // Pressed but not dragged: that was a click. Go back to what Boo was doing.
        if (this.mode === 'held') this.mode = this.beforeHeld ?? 'wander'
        break
      case 'drop':
        this.mode = 'wander'
        this.plan = null
        this.say('Wheee!', now, { ms: 1400 })
        break
      case 'wake':
        if (this.mode === 'sleep') this.mode = 'wander'
        break
      case 'tuck':
        this.mode = 'tucked'
        this.bubble = null
        this.plan = null
        break
      case 'untuck':
        if (this.mode === 'tucked') this.mode = 'wander'
        break
      case 'guide':
        // Hover beside a form field while typing into it.
        this.mode = 'guide'
        this.guide = { x: Number(event.x) || 0, y: Number(event.y) || 0, h: Number(event.h) || 0 }
        this.bubble = null
        this.say(text, now, { tone: 'work', ms: 6000 })
        break
      case 'guide-say':
        this.mode = 'guide'
        this.bubble = null
        this.say(text, now, { tone: 'work', ms: 6000 })
        break
      case 'wait':
        // Waiting for you during a migration. Beside the form if Boo is at one, else at your cursor.
        if (this.guide) this.mode = 'guide'
        else {
          this.mode = 'alert'
          this.alertSpot = null
          this.modeUntil = Infinity
        }
        this.bubble = null
        this.say(text, now, { sticky: true, tone: 'alert', ms: Infinity })
        break
      case 'goto':
        // Fly to an exact spot, like back into the mother ghost.
        this.mode = 'goto'
        this.target = { x: Number(event.x) || 0, y: Number(event.y) || 0 }
        break
      case 'release':
        this.guide = null
        if (this.mode === 'guide' || this.mode === 'alert' || this.mode === 'work' || this.mode === 'goto') this.mode = 'wander'
        if (this.bubble?.sticky) this.bubble = null
        break
    }
  }

  say(text, now, { sticky = false, tone = 'plain', ms } = {}) {
    if (!text) return
    const life = ms ?? Math.max(1800, text.length * SAY_MS_PER_CHAR)
    // A sticky message is not replaced by small talk.
    if (this.bubble?.sticky && !sticky && this.bubble.until > now) return
    this.bubble = { text, until: now + life, sticky, tone }
  }

  /**
   * ctx: { body, ledges, bounds, cursor: {x, y} | null, now }
   * Returns { intent, pose, flip, lantern, shake, bubble }.
   */
  update(ctx) {
    const { body, ledges, bounds, now } = ctx
    if (this.bubble && this.bubble.until <= now) this.bubble = null

    if ((this.mode === 'celebrate' || this.mode === 'scared') && now > this.modeUntil && this.celebrateJumps <= 0) this.mode = 'wander'
    if (this.mode === 'work' && now > this.modeUntil) this.mode = 'wander'
    if (this.mode === 'wander' && body.ground && now - this.lastActivity > SLEEP_AFTER_MS) {
      this.mode = 'sleep'
      this.say('Zzz', now, { ms: Infinity, tone: 'sleep' })
    }

    const tail = Math.floor(now / 260) % 2 ? 'B' : 'A'
    const centre = body.x + GHOST.w / 2
    const cursorNear = ctx.cursor && Math.hypot(ctx.cursor.x - centre, ctx.cursor.y - (body.y + GHOST.h / 2)) < 160
    let flip = body.vx < -1 ? true : body.vx > 1 ? false : this.lastFlip ?? false

    // Blinking now and then.
    if (now > this.nextBlink) {
      this.blinkUntil = now + 140
      this.nextBlink = now + 2500 + this.rand() * 4000
    }
    const blinking = now < this.blinkUntil

    let intent = { move: 0, jump: false, speed: PHYSICS.walk, fly: null }
    let poseName = blinking ? 'blink' : `idle${tail}`
    let lantern = false
    let shake = 0

    switch (this.mode) {
      case 'held':
        poseName = `happy${tail}`
        break

      case 'sleep':
        poseName = 'sleep'
        break

      case 'alert': {
        // Float to the cursor and knock on the glass. Once there, wait: reaching
        // for Boo must not make it move away. Follow only if the cursor goes far.
        const c = ctx.cursor ?? { x: bounds.x + bounds.w / 2, y: bounds.y + bounds.h / 2 }
        const spot = this.alertSpot
        const strayed = !spot || Math.hypot(c.x - spot.cx, c.y - spot.cy) > ALERT_FOLLOW_PX
        if (strayed) {
          const side = c.x + 24 + GHOST.w < bounds.x + bounds.w ? 1 : -1
          this.alertSpot = {
            x: side > 0 ? c.x + 24 : c.x - 24 - GHOST.w,
            y: c.y - GHOST.h / 2,
            cx: c.x,
            cy: c.y,
            side,
          }
        }
        const { x: tx, y: ty, side } = this.alertSpot
        intent = { move: 0, jump: false, fly: { x: tx, y: ty } }
        const arrived = Math.hypot(tx - body.x, ty - body.y) < 6
        flip = side > 0
        poseName = arrived ? (Math.floor(now / 180) % 2 ? 'knockA' : 'knockB') : `idle${tail}`
        break
      }

      case 'guide': {
        const g = this.guide
        const tx = g ? (g.x - GHOST.w - 8 >= bounds.x ? g.x - GHOST.w - 8 : g.x + 8) : body.x
        const ty = g ? g.y + g.h / 2 - GHOST.h / 2 : body.y
        intent = { move: 0, jump: false, fly: { x: tx, y: ty } }
        const arrived = Math.hypot(tx - body.x, ty - body.y) < 6
        flip = false
        poseName = arrived ? (Math.floor(now / 200) % 2 ? 'knockA' : 'knockB') : `happy${tail}`
        break
      }

      case 'goto': {
        const t = this.target ?? { x: body.x, y: body.y }
        intent = { move: 0, jump: false, fly: { x: t.x, y: t.y } }
        poseName = `happy${tail}`
        break
      }

      case 'tucked': {
        // Curled up small in the bottom corner, peeking now and then.
        intent = { move: 0, jump: false, fly: { x: bounds.x + bounds.w - GHOST.w - 6, y: bounds.y + bounds.h - GHOST.h } }
        poseName = Math.floor(now / 4000) % 3 === 0 ? 'look' : 'sleep'
        flip = true
        break
      }

      case 'scared':
        poseName = `scared${tail}`
        shake = 2
        break

      case 'celebrate':
        poseName = `happy${tail}`
        if (body.ground && this.celebrateJumps > 0) {
          intent = { move: 0, jump: true, speed: 0, fly: null }
          this.celebrateJumps--
        }
        break

      case 'work':
      case 'wander': {
        const working = this.mode === 'work'
        lantern = working
        intent = this.wander(body, ledges, bounds, now, working)
        if (!blinking) poseName = working ? `work${tail}` : cursorNear ? 'look' : `idle${tail}`
        if (!body.ground) poseName = working ? `work${tail}` : `happy${tail}`
        break
      }
    }

    this.lastFlip = flip
    return { intent, pose: poseName, flip, lantern, shake, bubble: this.bubble, tucked: this.mode === 'tucked' }
  }

  /** Walk about, hop between window ledges, rest now and then. */
  wander(body, ledges, bounds, now, busy) {
    const speed = busy ? PHYSICS.walk * 1.6 : PHYSICS.walk
    const none = { move: 0, jump: false, speed, fly: null }
    if (!body.ground) {
      if (this.plan?.kind === 'drop') this.plan = null
      return { ...none, move: Math.sign(body.vx) }
    }

    const ground = body.ground
    const centre = body.x + GHOST.w / 2

    if (!this.plan || (this.plan.kind === 'rest' && now > this.plan.until)) this.plan = this.choose(body, ledges, now, busy)
    const plan = this.plan

    if (plan.kind === 'rest') return none

    if (plan.kind === 'walk') {
      const dx = plan.x - centre
      if (Math.abs(dx) < 4 || plan.x < ground.x1 || plan.x > ground.x2) {
        this.plan = { kind: 'rest', until: now + (busy ? 300 : 800 + this.rand() * 3000) }
        return none
      }
      return { ...none, move: Math.sign(dx) }
    }

    if (plan.kind === 'drop') {
      // Keep walking until we step off the end. Physics takes over from there.
      return { ...none, move: plan.dir }
    }

    if (plan.kind === 'jump') {
      // Walk under the near end of the target ledge, then jump.
      const dx = plan.x - centre
      if (Math.abs(dx) < 10) {
        this.plan = null
        const dir = plan.ledge.x1 + 20 > centre ? 1 : plan.ledge.x2 - 20 < centre ? -1 : 0
        return { ...none, jump: true, move: dir }
      }
      if (plan.x < ground.x1 || plan.x > ground.x2) {
        this.plan = null
        return none
      }
      return { ...none, move: Math.sign(dx) }
    }
    return none
  }

  choose(body, ledges, now, busy) {
    const ground = body.ground
    const roll = this.rand()
    const options = reachable(body, ledges)
    if (options.length > 0 && roll < (busy ? 0.35 : 0.3)) {
      const ledge = options[Math.floor(this.rand() * options.length)]
      // Stand just outside the ledge's near end, within our own ground.
      const centre = body.x + GHOST.w / 2
      let x = centre < ledge.x1 ? ledge.x1 - 6 : centre > ledge.x2 ? ledge.x2 + 6 : centre
      x = Math.min(ground.x2 - GHOST.w / 2, Math.max(ground.x1 + GHOST.w / 2, x))
      return { kind: 'jump', ledge, x }
    }
    if (roll < 0.45 && !ground.floor && !busy) {
      // Hop down: walk off the end of this ledge.
      return { kind: 'drop', dir: this.rand() < 0.5 ? -1 : 1 }
    }
    if (roll < 0.85 || busy) {
      const span = ground.x2 - ground.x1 - GHOST.w
      return { kind: 'walk', x: ground.x1 + GHOST.w / 2 + this.rand() * Math.max(0, span) }
    }
    return { kind: 'rest', until: now + 1500 + this.rand() * 4000 }
  }
}

function pick(list, rand) {
  return list[Math.floor(rand() * list.length)]
}
