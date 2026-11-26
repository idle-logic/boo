// ClinicMaster Reborn: the old app's screens and rules, raised again in Idle's
// look. It has no rules of its own. Everything it checks comes from the spec
// Boo wrote, so when Boo learns a missed rule, the app follows it at once.

import { hint } from './spec.js'

const SCREEN_ICONS = { Clients: 'users', Appointments: 'calendar', Invoices: 'receipt' }
const esc = t => String(t ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])

/** Strict DD/MM/YYYY, real dates only. Returns a Date or null. Written fresh, not copied. */
export function readDate(text) {
  const parts = String(text ?? '').trim().split('/')
  if (parts.length !== 3 || parts[0].length !== 2 || parts[1].length !== 2 || parts[2].length !== 4) return null
  if (!parts.every(p => /^\d+$/.test(p))) return null
  const [d, m, y] = parts.map(Number)
  const date = new Date(y, m - 1, d)
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d ? date : null
}

/**
 * Run a screen's checks, in order, and stop at the first that fails.
 * values: { Label: text }. rows: the screen's rows (arrays in column order).
 * Returns null when everything passes, or { code, message, field }.
 */
export function check(spec, screenName, values, rows) {
  const screen = spec.screens.find(s => s.name === screenName)
  const v = label => String(values[label] ?? '').trim()
  for (const r of spec.rules.filter(x => x.screen === screenName)) {
    const field = r.fields[0]
    const value = v(field)
    let broken = false
    if (r.kind === 'required') broken = !value
    if (r.kind === 'digits') broken = !(/^\d+$/.test(value) || !r.digitsOnly) || (r.length && value.length !== r.length) || (r.first && !r.first.includes(Number(value[0])))
    if (r.kind === 'date') broken = value !== '' && !readDate(value)
    if (r.kind === 'closed') broken = r.days.includes(readDate(value)?.getDay())
    if (r.kind === 'maxLength') broken = value.length > r.max
    if (r.kind === 'unique') {
      const cols = r.fields.map(f => screen.columns.indexOf(f))
      broken = rows.some(row => cols.every((c, i) => c >= 0 && row[c] === v(r.fields[i])))
    }
    if (broken) return { code: r.code, message: r.message, field }
  }
  return null
}

/** The row a saved entry adds, in column order. Money is worked out from the spec. */
export function rowFor(spec, screenName, values) {
  const screen = spec.screens.find(s => s.name === screenName)
  const m = spec.money?.screen === screenName ? spec.money : null
  let sums = {}
  if (m) {
    const priceField = screen.fields.find(f => f.label === m.priceField)
    const price = Math.round((priceField.prices[String(values[m.priceField]).trim()] ?? 0) * 100)
    const exact = (price * m.rate) / 100
    const way = m.decision === 'keep' ? 'down' : m.use
    const tax = way === 'down' ? Math.floor(exact + 1e-9) : way === 'up' ? Math.ceil(exact - 1e-9) : Math.round(exact)
    sums = { [m.columns.subtotal]: price, [m.columns.tax]: tax, [m.columns.total]: price + tax }
  }
  return screen.columns.map(c => (c in sums ? (sums[c] / 100).toFixed(2) : String(values[c] ?? '').trim()))
}

export function createReborn(body, initialSpec) {
  let spec = initialSpec
  const state = { screen: spec.screens[0].name, form: false, status: '', error: null, rows: Object.fromEntries(spec.screens.map(s => [s.name, []])) }
  const screen = () => spec.screens.find(s => s.name === state.screen)
  const isMoney = c => spec.money && Object.values(spec.money.columns).includes(c)

  function options(f) {
    if (f.source) {
      const src = spec.screens.find(s => s.name === f.source.screen)
      const col = src.columns.indexOf(f.source.column)
      return state.rows[src.name].map(r => ({ value: r[col], text: r[col] }))
    }
    if (f.prices) return f.options.map(o => ({ value: o.value, text: `${o.value} · $${f.prices[o.value].toFixed(2)}` }))
    return f.options ?? []
  }

  function render() {
    const s = screen()
    const kept = state.form ? Object.fromEntries([...body.querySelectorAll('form[data-form] [name]')].map(el => [el.name, el.value])) : {}
    body.innerHTML = `
      <div class="app-shell">
        <nav class="sidebar" role="tablist" aria-label="${esc(spec.name)}">
          <div class="store-pill"><span>Tuesday Grooming</span></div>
          ${spec.screens
            .map(x => `<button type="button" role="tab" data-screen aria-selected="${x.name === s.name}"><span data-icon="${SCREEN_ICONS[x.name] ?? 'box'}"></span>${esc(x.name)}</button>`)
            .join('')}
          <p class="reborn-note">Rules from Boo's spec: ${spec.rules.length}</p>
        </nav>
        <section class="app-main">
          <div class="page-head"><h3 class="page-title">${esc(s.name)}</h3>${state.form ? '' : `<button type="button" class="mini primary" data-open>${esc(s.action)}</button>`}</div>
          <p role="status" class="notice${state.error ? ' bad' : state.status ? ' good' : ''}">${esc(state.error ? `${state.error.message.replace(/\.$/, '')} (code ${state.error.code})` : state.status)}</p>
          ${state.form ? formHtml(s, kept) : ''}
          <div class="table-card"><table class="reborn-table"><thead><tr>${s.columns.map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>
            ${state.rows[s.name].map(r => `<tr data-row>${r.map((v, i) => `<td>${isMoney(s.columns[i]) ? `$${esc(v)}` : esc(v)}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="${s.columns.length}" class="empty">Nothing here yet.</td></tr>`}
          </tbody></table></div>
        </section>
      </div>`
    body.querySelectorAll('[data-icon]').forEach(el => (el.outerHTML = iconSvg(el.dataset.icon)))
  }

  function formHtml(s, kept) {
    const fields = s.fields
      .map((f, i) => {
        const rule = spec.rules.find(r => r.screen === s.name && r.fields[0] === f.label && hint(r))
        const bad = state.error?.field === f.label
        const name = `f${i}`
        const input =
          f.kind === 'select'
            ? `<select name="${name}"${bad ? ' aria-invalid="true"' : ''}><option value=""></option>${options(f).map(o => `<option value="${esc(o.value)}"${kept[name] === o.value ? ' selected' : ''}>${esc(o.text)}</option>`).join('')}</select>`
            : `<input name="${name}" value="${esc(kept[name] ?? '')}" autocomplete="off"${bad ? ' aria-invalid="true"' : ''} />`
        return `<label class="field"><span>${esc(f.label)}${f.required ? '' : '<em> optional</em>'}</span>${input}${rule ? `<small>${esc(hint(rule))}</small>` : ''}</label>`
      })
      .join('')
    return `<form data-form class="reborn-form" aria-label="${esc(s.action)}"><h4 data-form-title>${esc(s.action)}</h4><div class="fields">${fields}</div>
      <div class="form-actions"><button type="submit">Save</button><button type="button" class="mini" data-cancel>Cancel</button></div></form>`
  }

  body.addEventListener('click', e => {
    const tab = e.target.closest('[data-screen]')
    if (tab) {
      state.screen = tab.textContent.trim()
      Object.assign(state, { form: false, status: '', error: null })
      return render()
    }
    if (e.target.closest('[data-open]')) {
      Object.assign(state, { form: true, status: '', error: null })
      return render()
    }
    if (e.target.closest('[data-cancel]')) {
      Object.assign(state, { form: false, status: '', error: null })
      render()
    }
  })

  body.addEventListener('submit', e => {
    e.preventDefault()
    const s = screen()
    const values = Object.fromEntries(s.fields.map((f, i) => [f.label, e.target.querySelector(`[name="f${i}"]`).value]))
    const error = check(spec, s.name, values, state.rows[s.name])
    if (error) {
      state.error = error
      state.status = ''
    } else {
      state.rows[s.name].push(rowFor(spec, s.name, values))
      Object.assign(state, { form: false, error: null, status: `Saved. ${s.name === 'Appointments' ? 'Booked in.' : ''}`.trim() })
    }
    render()
  })

  render()
  return {
    state,
    render,
    get spec() {
      return spec
    },
    /** Follow a new version of the spec. */
    setSpec(next) {
      spec = next
      render()
    },
    /** Moving in: rows copied exactly, past totals as they were charged. */
    importRows(screenName, rows) {
      state.rows[screenName].push(...rows.map(r => [...r]))
      render()
    },
    snapshot: () => structuredClone(state.rows),
    restore(rows) {
      state.rows = structuredClone(rows)
      Object.assign(state, { form: false, status: '', error: null })
      render()
    },
  }
}

let iconSvg = name => `<span class="ico-${name}"></span>`
/** Use the desktop's icon set. */
export function useIcons(fn) {
  iconSvg = name => fn(name, 18)
}
