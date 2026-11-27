// The browser side of Boo's AI (Gemini, through /api/*). Every answer is
// checked before it is used, and each step has a plain-rule fallback, so a
// busy AI never stops a switch. Results carry `by: 'ai'` or `by: 'rules'` so
// the page can say honestly which one decided.

const pause = ms => new Promise(r => setTimeout(r, ms))

/** POST to an AI endpoint. Tries twice when the free tier is busy. Returns JSON or null. */
export async function callAi(path, body, { timeoutMs = 14000 } = {}) {
  for (const wait of [0, 1500]) {
    if (wait) await pause(wait)
    try {
      const res = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(timeoutMs) })
      if (res.ok) return await res.json()
      if (res.status !== 503 && res.status !== 429) return null
    } catch {
      // Try again, then give up.
    }
  }
  return null
}

const NUMBER = /\d+(?:\.\d+)?/g

/**
 * Why do the apps disagree? differences: [{ service, old, new }],
 * settings: [{ service, fields: { label: text } }], fields: the new app's form labels.
 */
export function ruleDiagnosis({ differences, settings }) {
  const fixes = []
  for (const d of differences) {
    const s = settings.find(x => x.service === d.service)
    const entry = Object.entries(s?.fields ?? {}).find(([k, v]) => /clean|buffer|after/i.test(k) && /\d/.test(String(v)))
    if (entry) fixes.push({ service: d.service, field: 'Buffer after (min)', value: String(entry[1]).match(NUMBER)[0] })
  }
  return { cause: fixes.length ? 'The old app adds clean-up time after these services, so bookings end later there.' : 'I could not tell why.', fixes, by: 'rules' }
}

/** Keep only fixes that touch a differing service, a real field, and a number the old app shows. */
export function checkDiagnosis(req, ai) {
  if (!ai || typeof ai !== 'object' || !Array.isArray(ai.fixes)) return ruleDiagnosis(req)
  const fixes = ai.fixes.filter(f => {
    if (!f || !req.differences.some(d => d.service === f.service) || !req.fields.includes(f.field)) return false
    const shown = Object.values(req.settings.find(s => s.service === f.service)?.fields ?? {}).join(' ').match(NUMBER) ?? []
    return /^\d+(\.\d+)?$/.test(String(f.value)) && shown.includes(String(f.value))
  })
  if (!fixes.length) return ruleDiagnosis(req)
  return { cause: String(ai.cause ?? '').slice(0, 240) || 'Found the difference.', fixes: fixes.map(f => ({ service: f.service, field: f.field, value: String(f.value) })), by: 'ai', model: ai.model }
}

export async function diagnoseWithAi(req) {
  return checkDiagnosis(req, await callAi('/api/diagnose', req))
}

/** The salon's records in a compact form for questions. */
export function recordsFor(store) {
  return JSON.stringify({
    clients: store.clients.map(c => ({ name: c.name, vip: c.vip === 'Yes', visits: Number(c.visits) || 0, lastVisit: c.lastVisit, alert: c.alert || undefined, credit: Number(c.credit) || undefined })),
    bookings: store.bookings.map(b => ({ date: b.date, time: b.time, client: b.client, service: b.service, with: b.staff })),
    packages: store.packages.map(p => ({ client: p.client, name: p.name, left: Number(p.left), of: Number(p.of), paid: Number(p.paid) })),
    team: store.staff.map(s => ({ name: s.name, role: s.role, does: s.does })),
    services: store.services.map(s => ({ name: s.name, category: s.category, minutes: Number(s.minutes), price: Number(s.price) })),
    products: store.products.map(p => ({ name: p.name, price: Number(p.price), stock: Number(p.stock) })),
  })
}

/**
 * The chat bar. Gemini answers, and may ask to change one clean-up decision.
 * The change is only used if that decision and option really exist.
 */
export async function chatBoo({ message, stage, decisions, records }) {
  const out = await callAi('/api/chat', { message, stage, records, decisions: decisions.map(d => ({ key: d.key, title: d.title, options: d.choices.map(c => c[1]), chosen: d.choices.findIndex(c => c[0] === d.value) })) })
  if (!out?.reply) return { reply: 'Gemini is busy right now. Try me again in a minute.', change: null }
  const d = decisions.find(x => x.key === out.change?.key)
  const months = Number(out.change?.months)
  const change = !d
    ? null
    : d.key === 'packages' && Number.isInteger(months) && months >= 1 && months <= 60
      ? { key: d.key, months }
      : Number.isInteger(out.change.option) && d.choices[out.change.option]
        ? { key: d.key, option: out.change.option }
        : null
  return { reply: out.reply, change, edits: out.edits ?? out.edit ?? null, model: out.model }
}

const CATS = ['Cuts', 'Styling', 'Colour', 'Treatments', 'Brows']
const same = (a, b) => String(a).trim().toLowerCase() === String(b).trim().toLowerCase()

/**
 * A correction from the owner ("Kenji's allergy is latex"), checked before it touches anything.
 * Returns a sentence saying what changed, or null if the edit does not fit the data.
 */
export function applyEdit(read, edit) {
  if (!edit || !read) return null
  const v = edit.value
  if (edit.target === 'client') {
    const c = read.clients.find(x => same(x.name, edit.name))
    if (!c) return null
    if (edit.field === 'alert' && typeof v === 'string' && v.length <= 60) return (c.alert = v.trim()), v.trim() ? `${c.name}'s alert is now “${c.alert}”` : `${c.name} has no alert now`
    if (edit.field === 'credit' && Number.isFinite(Number(v)) && Number(v) >= 0 && Number(v) <= 10000) return (c.credit = Number(v)), `${c.name}'s store credit is now $${c.credit}`
    if (edit.field === 'vip' && typeof v === 'boolean') return (c.vip = v), `${c.name} is ${v ? 'now' : 'no longer'} a VIP`
    if (edit.field === 'packageLeft' && c.packages.length && Number.isInteger(Number(v))) {
      const p = c.packages[0]
      if (Number(v) < 0 || Number(v) > p.of) return null
      p.left = Number(v)
      return `${c.name}'s ${p.name} now has ${p.left} of ${p.of} left`
    }
    return null
  }
  if (edit.target === 'service') {
    const s = read.services.find(x => same(x.name, edit.name))
    if (!s) return null
    if (edit.field === 'category' && CATS.includes(v)) return (s.category = v), `${s.name} is now in ${v}`
    if (edit.field === 'buffer' && Number.isInteger(Number(v)) && Number(v) >= 0 && Number(v) <= 120) return (s.buffer = Number(v)), `${s.name} now has ${s.buffer} min after it`
    if (edit.field === 'deposit' && Number.isFinite(Number(v)) && Number(v) >= 0 && Number(v) <= 100) return (s.deposit = Number(v)), `${s.name} now takes a ${s.deposit}% deposit`
    return null
  }
  if (edit.target === 'staff') {
    const s = read.staff.find(x => same(x.name, edit.name))
    if (!s || edit.field !== 'does' || !Array.isArray(v) || !v.length || !v.every(c => CATS.includes(c))) return null
    s.does = [...new Set(v)]
    return `${s.name} now does ${s.does.join(', ')}`
  }
  return null
}

/**
 * The notes no rule could read, and Boo's plan. Every number Gemini gives must appear in the note.
 * Returns { notes: [{ src, text, meaning, kind, sessions, service, amount, flag }], plan: [...] } or null.
 */
export async function thinkAboutNotes({ unclear, needs, found }) {
  const out = await callAi('/api/think-about', { notes: unclear.map((u, i) => ({ i, text: u.text })), needs, found })
  if (!out || !Array.isArray(out.notes)) return null
  const KINDS = ['prepaid', 'credit', 'flag', 'note']
  const inText = (n, text) => !n || String(text).includes(String(n))
  const notes = out.notes
    .filter(n => unclear[n?.i] && KINDS.includes(n.kind) && typeof n.meaning === 'string')
    .map(n => {
      const u = unclear[n.i]
      const sessions = Number(n.sessions) || 0
      const amount = Number(n.amount) || 0
      const ok = inText(sessions, u.text) && inText(amount, u.text)
      return { src: u.src, text: u.text, meaning: n.meaning.slice(0, 80), kind: ok ? n.kind : 'note', sessions: ok ? sessions : 0, service: String(n.service ?? '').slice(0, 40), amount: ok ? amount : 0, flag: String(n.flag ?? '').slice(0, 40) }
    })
  const plan = (Array.isArray(out.plan) ? out.plan : []).slice(0, 5).map(s => String(s).slice(0, 120)).filter(Boolean)
  return { notes, plan, model: out.model }
}

/** The séance: Slotly's ghost answers. Returns { reply, model } or null when the spirits are busy. */
export async function seance({ message, history, records, found }) {
  const out = await callAi('/api/seance', { message, history, records, found }, { timeoutMs: 20000 })
  return out?.reply ? { reply: String(out.reply).slice(0, 400), model: out.model } : null
}

const KINDS = ['name', 'phone', 'email', 'date', 'money', 'number', 'note', 'category', 'duration', 'role', 'stock', 'sku', 'unknown']
const TARGET_IDS = ['clients', 'products', 'services', 'team']
const targetOf = t => (TARGET_IDS.includes(t) ? t : null)
const titleText = t => String(t ?? '').replace(/[^\p{L}\p{N} '&.,-]/gu, '').trim().slice(0, 50)
const kindsFor = (kinds, n) => Array.from({ length: n }, (_, i) => (KINDS.includes(kinds?.[i]) ? kinds[i] : 'unknown'))

/** A photo or screenshot of old records, read by Gemini. Returns { headers, rows, kinds, recordKind, model } or null. */
export async function readPhoto({ mime, data }) {
  const out = await callAi('/api/read-image', { mime, data }, { timeoutMs: 45000 })
  if (!out || !Array.isArray(out.headers) || !Array.isArray(out.rows) || !out.headers.length) return null
  const headers = out.headers.slice(0, 20).map(h => String(h ?? '').slice(0, 40))
  const rows = out.rows
    .filter(Array.isArray)
    .slice(0, 500)
    .map(r => headers.map((_, i) => String(r[i] ?? '').slice(0, 300)))
  return { headers, rows, kinds: kindsFor(out.kinds, headers.length), recordKind: String(out.recordKind ?? 'record').slice(0, 30), target: targetOf(out.target), title: titleText(out.title), model: out.model }
}

/** What each column of an export holds. Returns { kinds, recordKind, model } or null. */
export async function mapColumnsAi(headers, samples) {
  const out = await callAi('/api/map-columns', { headers, samples })
  if (!out || !Array.isArray(out.kinds)) return null
  return { kinds: kindsFor(out.kinds, headers.length), recordKind: String(out.recordKind ?? 'record').slice(0, 30), target: targetOf(out.target), title: titleText(out.title), model: out.model }
}

/** Which of Boo's fields fills each of another app's columns. Anything Gemini names that is not a real field is left blank. */
export async function mapTemplateAi(headers, fields, example) {
  const out = await callAi('/api/map-template', { headers, fields, example })
  if (!out || !Array.isArray(out.map)) return null
  const ok = [...fields, 'yes', 'blank']
  return { map: headers.map((_, i) => (ok.includes(out.map[i]) && out.map[i] !== 'blank' ? out.map[i] : '')), model: out.model }
}

export async function askBoo(question, store) {
  const out = await callAi('/api/ask', { question, records: recordsFor(store) })
  return out?.answer ? { answer: out.answer, model: out.model, by: 'ai' } : { answer: 'Gemini is busy right now. Ask me again in a minute.', by: 'none' }
}
