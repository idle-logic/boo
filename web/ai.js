// The browser side of Haunt's AI (Gemini, through /api/*). Every answer is
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

export async function askBoo(question, store) {
  const out = await callAi('/api/ask', { question, records: recordsFor(store) })
  return out?.answer ? { answer: out.answer, model: out.model, by: 'ai' } : { answer: 'Gemini is busy right now. Ask me again in a minute.', by: 'none' }
}
