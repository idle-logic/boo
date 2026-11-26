// Boo's hands in the browser. The same contract as the desktop adapter:
//   observe() -> elements on screen, grouped by app
//   act(action) -> what happened
// It reads the page the way a screen reader does: labelled controls and text.

const SELECTOR = 'button, input, textarea, select, [role="tab"], [data-boo-text]'

function visible(el) {
  if (el.closest('[hidden], [data-boo-ignore]')) return false
  return el.getClientRects().length > 0
}

function labelOf(el) {
  if (el.getAttribute('aria-label')) return el.getAttribute('aria-label')
  if (el.id) {
    const forLabel = el.ownerDocument.querySelector(`label[for="${el.id}"]`)
    if (forLabel) return forLabel.textContent.trim()
  }
  const wrap = el.closest('label')
  if (wrap) return [...wrap.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join(' ').trim()
  return el.getAttribute('placeholder') || el.name || ''
}

function roleOf(el) {
  if (el.getAttribute('role') === 'tab') return 'tab'
  const tag = el.tagName
  if (tag === 'BUTTON') return 'button'
  if (tag === 'SELECT') return 'select'
  if (tag === 'TEXTAREA') return 'textbox'
  if (tag === 'INPUT') return el.type === 'password' ? 'password' : 'textbox'
  return 'text'
}

export function domAdapter({ windows, beforeAct = async () => {} }) {
  const ids = new WeakMap()
  let next = 1
  let current = new Map()
  const idOf = el => {
    if (!ids.has(el)) ids.set(el, `e${next++}`)
    return ids.get(el)
  }

  return {
    async observe() {
      current = new Map()
      const out = []
      for (const win of windows()) {
        if (!visible(win)) continue
        const app = win.dataset.app
        for (const el of win.querySelectorAll(SELECTOR)) {
          if (!visible(el)) continue
          // Text inside a button belongs to the button.
          if (el.hasAttribute('data-boo-text') && el.closest('button')) continue
          const role = roleOf(el)
          const id = idOf(el)
          current.set(id, el)
          const item = { id, app, role, name: role === 'text' ? textOf(el) : labelOf(el) || textOf(el) }
          if (role === 'textbox') item.value = el.value
          if (role === 'select') {
            item.options = [...el.options].map(o => o.text)
            item.value = el.selectedOptions[0]?.text ?? ''
          }
          if (role === 'tab') item.selected = el.getAttribute('aria-selected') === 'true'
          if (el.disabled) item.disabled = true
          out.push(item)
        }
      }
      return out
    },

    /** The page element for an id from the last observation. */
    elementFor(id) {
      return current.get(id) ?? null
    },

    async act(action) {
      const el = current.get(action.id)
      if (!el || !el.isConnected) return 'That is no longer on screen. Look again.'
      await beforeAct(el, action)
      if (action.type === 'click') {
        el.click()
        return 'Clicked.'
      }
      if (action.type === 'type') {
        el.focus({ preventScroll: true })
        el.value = ''
        for (const ch of action.text) {
          el.value += ch
          el.dispatchEvent(new Event('input', { bubbles: true }))
          await new Promise(r => setTimeout(r, action.text.length > 80 ? 6 : 16))
        }
        return `Typed into ${labelOf(el) || 'the box'}.`
      }
      if (action.type === 'select') {
        const opt = [...el.options].find(o => o.text === action.option)
        if (!opt) return `No option "${action.option}".`
        el.value = opt.value
        el.dispatchEvent(new Event('change', { bubbles: true }))
        return `Chose ${action.option}.`
      }
      return 'Nothing to do.'
    },
  }
}

function textOf(el) {
  // Visible text only, without the text of buttons inside it.
  const clone = el.cloneNode(true)
  clone.querySelectorAll('button').forEach(b => b.remove())
  return clone.textContent.replace(/\s+/g, ' ').trim()
}
