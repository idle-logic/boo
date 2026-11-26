// Moving clients from an old export into any software, one form at a time.
//
//   1. You pick the export. Boo asks you to open the "new client" form.
//   2. You click Boo. Boo reads the form in the window you are using.
//   3. Boo flies to each field and types the value.
//   4. Boo waits for you to check. Click Boo to save, and the next one starts.

import { readFileSync } from 'node:fs'
import { basename } from 'node:path'
import { cleanValues, fillableFields, heuristicValues, mappingPrompt, parseCsv, recordName, saveButton } from './mapping.js'
import { askJson, hasModel } from './model.js'

const pause = ms => new Promise(r => setTimeout(r, ms))

/** "New client - Bloom Booking and 2 more pages - Microsoft Edge" to "New client - Bloom Booking". */
export function shortTitle(title = '') {
  return title.split(/ and \d+ more pages?| - (Microsoft|Google|Mozilla)|\s-\s[^-]*$/)[0].trim() || 'this window'
}

export class Migration {
  /**
   * hands: Hands. haunt(event): tell Boo something.
   * toOverlay({x, y, w, h}): screen pixels to overlay coordinates.
   */
  constructor({ hands, haunt, toOverlay }) {
    this.autopilot = false // carry on without waiting for clicks
    this.hands = hands
    this.haunt = haunt
    this.toOverlay = toOverlay
    this.reset()
  }

  reset() {
    this.state = 'idle' // idle | waiting-for-form | filling | waiting-to-save | paused
    this.target = '' // window title to use, when set; otherwise the window in front
    this.rows = []
    this.headers = []
    this.at = 0
    this.saved = 0
    this.form = null
    this.file = ''
  }

  get active() {
    return this.state !== 'idle'
  }

  /** Start with an export file. Returns false if it holds no records. */
  begin(path, { target = '' } = {}) {
    const { headers, rows } = parseCsv(readFileSync(path, 'utf-8'))
    if (rows.length === 0) {
      this.haunt({ type: 'fail', text: `I could not find any clients in ${basename(path)}.` })
      return false
    }
    this.reset()
    Object.assign(this, { headers, rows, file: basename(path), state: 'waiting-for-form', target })
    this.haunt({
      type: 'wait',
      text: `${rows.length} clients in ${this.file}. Open the new client form in your software, then click me.`,
    })
    this.carryOn()
    return true
  }

  /** In autopilot, act as if you clicked, after a short pause to read the bubble. */
  carryOn() {
    if (!this.autopilot) return
    const at = this.state
    setTimeout(() => {
      if (this.state === at) this.clicked()
    }, 1600)
  }

  stop() {
    if (!this.active) return
    const saved = this.saved
    this.reset()
    this.haunt({ type: 'release' })
    this.haunt({ type: 'say', text: saved ? `Stopped. ${saved} clients moved so far.` : 'Stopped. Nothing was saved.' })
  }

  /** Boo was clicked. What that means depends on where we are. */
  async clicked() {
    if (this.state === 'waiting-for-form') return this.readForm()
    if (this.state === 'waiting-to-save') return this.saveAndNext()
    if (this.state === 'paused') {
      this.state = 'filling'
      return this.fillRecord()
    }
  }

  async readForm() {
    this.state = 'filling'
    this.haunt({ type: 'guide-say', text: 'Let me look at this form.' })
    const scan = await this.hands.scan(this.target)
    const fields = scan.ok ? fillableFields(scan.fields) : []
    if (fields.length === 0) {
      this.state = 'waiting-for-form'
      this.haunt({ type: 'wait', text: 'I cannot see a form here. Open the new client form, then click me.' })
      return
    }
    this.form = scan
    // Say which window Boo is about to type into, so it is never a surprise.
    this.haunt({ type: 'guide-say', text: `Filling forms in ${shortTitle(scan.window)}.` })
    await pause(1200)
    await this.fillRecord()
  }

  async fillRecord() {
    const row = this.rows[this.at]
    const name = recordName(row)
    this.haunt({ type: 'guide-say', text: `Client ${this.at + 1} of ${this.rows.length}: ${name}` })

    let values = null
    if (hasModel()) values = cleanValues((await askJson(mappingPrompt(row, this.form.fields)))?.values, this.form.fields)
    if (!values || Object.keys(values).length === 0) values = heuristicValues(row, this.headers, this.form.fields)

    for (const field of fillableFields(this.form.fields)) {
      const value = values[field.index]
      if (!value) continue
      const spot = this.toOverlay(field)
      this.haunt({ type: 'guide', x: spot.x, y: spot.y, h: spot.h, text: `${field.label}: ${value}` })
      await pause(420)
      const res = await this.hands.fill(field.index, value)
      if (!res.ok && (res.error === 'not-in-front' || res.error === 'no-focus')) {
        // The form is not in front any more. Never type anywhere else: stop and ask.
        this.autopilot = false
        this.state = 'paused'
        this.haunt({ type: 'wait', text: `I paused on ${name} because the form is not in front. Bring it back, then click me.` })
        return
      }
      if (!res.ok) {
        this.haunt({ type: 'guide-say', text: `I could not type into ${field.label}.` })
        await pause(900)
      }
      if (!this.active) return
    }

    this.state = 'waiting-to-save'
    const save = saveButton(this.form.fields)
    this.haunt({
      type: 'wait',
      text: save
        ? `${name} is filled in. Check it, then click me and I will press ${save.label}.`
        : `${name} is filled in. Save it in your software, then click me for the next one.`,
    })
    this.carryOn()
  }

  async saveAndNext() {
    this.state = 'filling'
    const save = saveButton(this.form.fields)
    if (save) {
      const spot = this.toOverlay(save)
      this.haunt({ type: 'guide', x: spot.x, y: spot.y, h: spot.h, text: `Pressing ${save.label}` })
      await pause(400)
      const pressed = await this.hands.press(save.index)
      if (!pressed.ok) {
        this.autopilot = false
        this.state = 'waiting-to-save'
        this.haunt({ type: 'wait', text: 'I could not press the button. Bring the form to the front, then click me.' })
        return
      }
      await pause(900)
    }
    this.saved++
    this.at++
    if (this.at >= this.rows.length) {
      const total = this.saved
      this.reset()
      this.haunt({ type: 'release' })
      this.haunt({ type: 'done', text: `${total} clients moved from ${this.file || 'your old system'}.` })
      return
    }
    // The form is usually blank again after saving. Read it fresh in case it moved.
    const scan = await this.hands.scan('@same')
    if (scan.ok && fillableFields(scan.fields).length > 0) {
      this.form = scan
      await this.fillRecord()
    } else {
      this.state = 'waiting-for-form'
      this.haunt({ type: 'wait', text: 'Open the new client form again, then click me.' })
    }
  }
}
