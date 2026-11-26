// An agent's hands on one app: a labelled cursor that moves to what it uses,
// and the clicks, typing and reading a person would do. Fields are found by
// their visible labels, never by the app's internals. The desktop version does
// the same through Windows UI Automation, on any software.

const pause = ms => new Promise(r => setTimeout(r, ms))
const text = el => (el?.textContent ?? '').replace(/\s+/g, ' ').trim()

export function createHands(root, { name, colour, pace = { move: 260, type: 18 } }) {
  const cursor = document.createElement('div')
  cursor.className = 'agent-cursor'
  cursor.style.setProperty('--c', colour)
  cursor.innerHTML = `<svg width="18" height="20" viewBox="0 0 18 20" aria-hidden="true"><path d="M1 1l15 8.5-6.6 1.6L6.3 18z" fill="var(--c)" stroke="#fff" stroke-width="1.4" stroke-linejoin="round"/></svg><span></span>`
  cursor.querySelector('span').textContent = name
  cursor.hidden = true
  document.body.appendChild(cursor)
  let at = null

  const visible = () => root.isConnected && root.offsetParent !== null && root.getClientRects().length > 0

  async function move(el) {
    if (!el || !visible() || pace.move < 20) return
    el.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    const r = el.getBoundingClientRect()
    if (!r.width) return
    const x = r.left + Math.min(r.width / 2, 40)
    const y = r.top + r.height / 2
    cursor.hidden = false
    const dist = at ? Math.hypot(x - at.x, y - at.y) : 0
    const ms = Math.min(pace.move, 120 + dist / 3)
    cursor.style.transition = at ? `transform ${ms}ms cubic-bezier(.3,.7,.3,1)` : 'none'
    cursor.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`
    at = { x, y }
    await pause(at ? ms : 0)
  }

  function ripple() {
    if (cursor.hidden) return
    cursor.classList.remove('click')
    void cursor.offsetWidth
    cursor.classList.add('click')
  }

  /** Find a form control by its visible label. */
  function control(label) {
    const want = label.toLowerCase()
    for (const span of root.querySelectorAll('form label > span, form fieldset > legend')) {
      if (text(span).toLowerCase() !== want) continue
      const box = span.parentElement
      return box.tagName === 'FIELDSET' ? box : box.querySelector('input, select, textarea')
    }
    return null
  }

  async function setControl(el, value, typing) {
    if (el.tagName === 'FIELDSET') {
      for (const box of el.querySelectorAll('input[type="checkbox"]')) {
        const on = [].concat(value).includes(box.value)
        if (box.checked !== on) {
          await move(box)
          box.checked = on
          box.dispatchEvent(new Event('change', { bubbles: true }))
        }
      }
      return
    }
    await move(el)
    if (el.tagName === 'SELECT') {
      const opt = [...el.options].find(o => o.value === String(value) || text(o) === String(value))
      el.value = opt ? opt.value : ''
    } else if (typing && visible() && pace.type > 0 && String(value).length < 60) {
      el.value = ''
      for (const ch of String(value)) {
        el.value += ch
        el.dispatchEvent(new Event('input', { bubbles: true }))
        await pause(pace.type)
      }
    } else el.value = String(value ?? '')
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  }

  return {
    name,
    pace,
    async click(el) {
      if (!el) throw new Error(`${name}: nothing to click`)
      await move(el)
      ripple()
      el.click()
      await pause(Math.min(120, pace.move / 3))
    },
    /** Click the first element matching selector whose text includes words. */
    async press(selector, words = '') {
      const find = () => [...root.querySelectorAll(selector)].find(e => !words || text(e).toLowerCase().includes(words.toLowerCase()))
      const el = find()
      if (!el) throw new Error(`${name}: could not find "${words || selector}"`)
      await move(el)
      // The screen may have redrawn while the cursor travelled (other agents save things too). Look again.
      const now = el.isConnected ? el : find()
      if (!now) throw new Error(`${name}: "${words || selector}" went away`)
      ripple()
      now.click()
      await pause(Math.min(120, pace.move / 3))
    },
    /** Fill fields by label: { Label: value }. Each control is looked up fresh, since apps redraw as you type. */
    async fill(values, { typing = false } = {}) {
      for (const [label, value] of Object.entries(values)) {
        if (value === undefined || value === null) continue
        const el = control(label)
        if (!el) throw new Error(`${name}: no field called ${label}`)
        await setControl(el, value, typing)
      }
    },
    async submit() {
      return this.click(root.querySelector('form button[type="submit"]'))
    },
    /** The table on screen, as objects keyed by column heading. */
    table() {
      const heads = [...root.querySelectorAll('thead th')].map(text)
      return [...root.querySelectorAll('tbody tr')]
        .filter(tr => tr.cells.length === heads.length)
        .map(tr => Object.fromEntries([...tr.cells].map((td, i) => [heads[i], text(td)])))
    },
    /** Label -> value pairs from a details panel or quote (<dt>/<dd>). */
    details(selector = 'dl') {
      const dl = root.querySelector(selector)
      return dl ? Object.fromEntries([...dl.querySelectorAll('dt')].map(dt => [text(dt), text(dt.nextElementSibling)])) : {}
    },
    look: sel => root.querySelector(sel),
    all: sel => [...root.querySelectorAll(sel)],
    text,
    move,
    hide() {
      cursor.hidden = true
      at = null
    },
    remove() {
      cursor.remove()
    },
  }
}
