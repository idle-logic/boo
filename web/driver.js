// A ghost's hands on one app window, the way a person uses it: open a screen,
// open its form, fill fields by their labels, press OK, read the status line
// and the table. Works on any app built from those parts, old or new.
//
// The desktop version does the same through Windows UI Automation.

const pause = ms => new Promise(r => setTimeout(r, ms))

export function createDriver(root, { touch = async () => {}, speed = () => 1 } = {}) {
  const $ = sel => root.querySelector(sel)
  const $$ = sel => [...root.querySelectorAll(sel)]
  const text = el => (el?.textContent ?? '').replace(/\s+/g, ' ').trim()
  const wait = ms => pause(ms * speed())

  async function press(el, label = '') {
    await touch(el, label)
    el.click()
    await wait(60)
  }

  // A field's name is the first words of its label, before any extra note like "optional".
  const labelOf = control => {
    const span = control.closest('label')?.querySelector('span')
    const first = span?.firstChild
    return (first?.nodeType === 3 ? first.textContent : text(span)).trim()
  }

  return {
    /** Names of the app's screens, from its menu. */
    screens: () => $$('[data-screen]').map(text),

    current: () => text($('[data-screen].on, [data-screen][aria-selected="true"]')),

    async goto(name) {
      const btn = $$('[data-screen]').find(b => text(b).toLowerCase() === name.toLowerCase())
      if (!btn) throw new Error(`No screen called ${name}`)
      await press(btn, name)
    },

    /** Column headings of the table on this screen. */
    columns: () => $$('thead th').map(text),

    /** Rows of the table on this screen, as lists of cell text. */
    rows: () => $$('[data-row]').map(tr => [...tr.cells].map(text)),

    /** The button that opens this screen's form, and its label. */
    formButton: () => text($('[data-open]')),

    /** Open the form. Returns its fields: { label, kind, options }. */
    async openForm() {
      const btn = $('[data-open]')
      if (!btn) return null
      await press(btn, text(btn))
      return this.fields()
    },

    fields() {
      const form = $('form[data-form]')
      if (!form) return []
      return [...form.querySelectorAll('input, select, textarea')].map(c => ({
        label: labelOf(c),
        kind: c.tagName === 'SELECT' ? 'select' : 'text',
        options: c.tagName === 'SELECT' ? [...c.options].filter(o => o.value !== '').map(o => ({ value: o.value, text: text(o) })) : null,
      }))
    },

    formTitle: () => text($('form[data-form] [data-form-title], form[data-form] .w98-dialog-title')) || $('form[data-form]')?.getAttribute('aria-label') || '',

    /** Fill fields by label. values: { Label: value }. Missing labels are left blank. */
    async fill(values, { show = false } = {}) {
      const form = $('form[data-form]')
      for (const c of form.querySelectorAll('input, select, textarea')) {
        const want = values[labelOf(c)] ?? ''
        if (show) await touch(c, '')
        if (c.tagName === 'SELECT') {
          const opt = [...c.options].find(o => o.value === want || text(o) === want)
          c.value = opt ? opt.value : ''
        } else if (show && want) {
          c.value = ''
          for (const ch of want) {
            c.value += ch
            await wait(want.length > 24 ? 8 : 22)
          }
        } else c.value = want
      }
    },

    /** Press OK. Returns the status line afterwards. */
    async submit() {
      const btn = $('form[data-form] button[type="submit"]')
      await press(btn, '')
      return this.status()
    },

    async cancel() {
      const btn = $('form[data-form] [data-cancel]')
      if (btn) await press(btn, '')
    },

    status: () => text($('[role="status"]')),
  }
}

/** The error code in a status line, or 'ok'. "Error 102: ..." -> '102'. */
export function outcome(status) {
  const m = /\b(?:error|code)\s*(\d{3})\b/i.exec(status)
  return m ? m[1] : 'ok'
}
