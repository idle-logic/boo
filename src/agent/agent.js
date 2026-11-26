// Boo's autonomous loop. The same code runs on the desktop (any app, through
// Windows UI Automation) and in the browser demo (apps on the page). Only the
// adapter changes:
//
//   adapter.observe() -> [{ id, app, role, name, value?, options?, selected? }]
//   adapter.act(action) -> string describing what happened
//
// Each step: look at the screen, ask the model for one action, check it is
// allowed, ask the person first if it matters, then do it.

export const ACTION_TYPES = ['click', 'type', 'select', 'say', 'done']
export const MAX_STEPS = 18

// Buttons that change the world. Boo asks before pressing these.
const CONSEQUENTIAL = /^(book|send|save|confirm|pay|charge|refund|delete|remove|cancel booking|submit|post|reply)\b/i

/** Plain-text view of the screen for the model. Long lists are cut. */
export function renderObservation(elements, maxPerApp = 80) {
  const byApp = new Map()
  for (const el of elements) {
    if (!byApp.has(el.app)) byApp.set(el.app, [])
    byApp.get(el.app).push(el)
  }
  const out = []
  for (const [app, els] of byApp) {
    out.push(`[${app}]`)
    for (const el of els.slice(0, maxPerApp)) {
      let line = `${el.id} ${el.role} "${clip(el.name, 140)}"`
      if (el.value !== undefined && el.value !== null) line += ` value="${clip(String(el.value), 80)}"`
      if (el.options?.length) line += ` options=[${el.options.slice(0, 20).map(o => clip(o, 40)).join(' | ')}]`
      if (el.selected) line += ' (selected)'
      if (el.disabled) line += ' (disabled)'
      out.push(line)
    }
    if (els.length > maxPerApp) out.push(`(${els.length - maxPerApp} more not shown)`)
  }
  return out.join('\n')
}

function clip(text, n) {
  const s = String(text ?? '').replace(/\s+/g, ' ').trim()
  return s.length > n ? `${s.slice(0, n - 1)}…` : s
}

/**
 * Check a model decision against the screen. Returns { ok, action } or { ok: false, error }.
 * The model can only touch elements that exist, and only in ways that fit them.
 */
export function validateAction(decision, elements) {
  const a = decision?.action
  if (!a || typeof a !== 'object' || !ACTION_TYPES.includes(a.type)) {
    return { ok: false, error: `Unknown action. Use one of: ${ACTION_TYPES.join(', ')}.` }
  }
  if (a.type === 'say' || a.type === 'done') {
    const text = String(a.text ?? a.summary ?? '').trim().slice(0, 200)
    return text ? { ok: true, action: { type: a.type, text } } : { ok: false, error: `"${a.type}" needs text.` }
  }
  const el = elements.find(e => e.id === a.id)
  if (!el) return { ok: false, error: `There is no element ${a.id} on screen now.` }
  if (el.disabled) return { ok: false, error: `${a.id} is disabled.` }
  if (el.role === 'password') return { ok: false, error: 'Never type into password fields.' }
  if (a.type === 'click') return { ok: true, action: { type: 'click', id: el.id } }
  if (a.type === 'type') {
    if (!['textbox', 'searchbox'].includes(el.role)) return { ok: false, error: `${a.id} is not a text box.` }
    const text = String(a.text ?? '').slice(0, 1000)
    return text ? { ok: true, action: { type: 'type', id: el.id, text } } : { ok: false, error: '"type" needs text.' }
  }
  if (a.type === 'select') {
    if (el.role !== 'select') return { ok: false, error: `${a.id} is not a drop-down.` }
    const want = String(a.option ?? '').trim().toLowerCase()
    const option = (el.options ?? []).find(o => o.toLowerCase() === want) ?? (el.options ?? []).find(o => o.toLowerCase().includes(want))
    return option && want ? { ok: true, action: { type: 'select', id: el.id, option } } : { ok: false, error: `"${a.option}" is not an option of ${a.id}.` }
  }
  return { ok: false, error: 'Unknown action.' }
}

/** Does this action change the world, so the person should say yes first? */
export function needsApproval(action, elements) {
  if (action.type !== 'click') return false
  const el = elements.find(e => e.id === action.id)
  return Boolean(el && el.role === 'button' && CONSEQUENTIAL.test(el.name.trim()))
}

/** One line a person can read: "Press Book in Bloom Booking". */
export function describeAction(action, elements) {
  const el = elements.find(e => e.id === action.id)
  const where = el ? ` in ${el.app}` : ''
  switch (action.type) {
    case 'click':
      return `Press ${el ? `"${clip(el.name, 60)}"` : action.id}${where}`
    case 'type':
      return `Type "${clip(action.text, 80)}"${el ? ` into ${clip(el.name, 40)}` : ''}${where}`
    case 'select':
      return `Choose ${action.option}${el ? ` for ${clip(el.name, 40)}` : ''}${where}`
    default:
      return action.text
  }
}

/**
 * Run until the model says done, the step limit, or a stop.
 *
 * think({ goal, observation, history }) -> { thought, action }
 * approve(description, action) -> Promise<boolean>
 * onStep({ kind, thought, action, element, result, description })
 * shouldStop() -> boolean
 */
export async function runAgent({ goal, adapter, think, approve, onStep = () => {}, shouldStop = () => false, maxSteps = MAX_STEPS }) {
  const history = []
  let errors = 0
  for (let step = 0; step < maxSteps; step++) {
    if (shouldStop()) return { ok: false, summary: 'Stopped.' , history }
    const elements = await adapter.observe()
    let decision
    try {
      decision = await think({ goal, observation: renderObservation(elements), history })
    } catch (err) {
      return { ok: false, summary: err?.message || 'My brain is busy. Try again in a minute.', history }
    }
    const thought = String(decision?.thought ?? '').slice(0, 200)
    const checked = validateAction(decision, elements)
    if (!checked.ok) {
      history.push({ thought, error: checked.error })
      if (++errors >= 3) return { ok: false, summary: 'I got stuck on this one. Can you take it from here?', history }
      continue
    }
    errors = 0
    const action = checked.action
    const element = elements.find(e => e.id === action.id) ?? null
    const description = describeAction(action, elements)

    if (action.type === 'done') {
      onStep({ kind: 'done', thought, action, description })
      history.push({ thought, action, result: 'Finished.' })
      return { ok: true, summary: action.text, history }
    }
    if (action.type === 'say') {
      onStep({ kind: 'say', thought, action, description })
      history.push({ thought, action, result: 'Said to the person.' })
      continue
    }
    if (needsApproval(action, elements)) {
      onStep({ kind: 'ask', thought, action, element, description })
      const yes = await approve(description, action)
      if (!yes) {
        history.push({ thought, action, result: 'The person said no. Do not do this. Ask what they want instead, or finish.' })
        onStep({ kind: 'declined', thought, action, element, description })
        continue
      }
    }
    onStep({ kind: 'act', thought, action, element, description })
    const result = String((await adapter.act(action)) ?? 'Done.')
    history.push({ thought, action, result })
    onStep({ kind: 'acted', thought, action, element, description, result })
  }
  return { ok: false, summary: 'That took more steps than I expected. Can you check it?', history }
}
