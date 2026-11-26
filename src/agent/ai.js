// Haunt's AI steps, on Gemini's free tier. Server side only (Netlify function
// and the local demo server); the key never reaches a browser. The browser
// checks every answer against the original text before using it.
import { BrainBusyError } from './gemini.js'

export const MODELS = ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-flash-lite-latest']

/** Returns { json, model }. Throws BrainBusyError when no model answers. */
export async function askGemini({ system, user, apiKey, maxTokens = 2048, models = MODELS, timeoutMs = 25000 }) {
  if (!apiKey) throw new BrainBusyError()
  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: 'user', parts: [{ text: user }] }],
    generationConfig: { temperature: 0.1, maxOutputTokens: maxTokens, responseMimeType: 'application/json' },
  })
  for (const model of models) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
        body,
        signal: AbortSignal.timeout(timeoutMs),
      })
      if (!res.ok) continue
      const data = await res.json()
      const text = (data.candidates?.[0]?.content?.parts ?? []).filter(p => !p.thought).map(p => p.text ?? '').join('')
      const json = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1))
      if (json && typeof json === 'object') return { json, model }
    } catch {
      // Try the next model.
    }
  }
  throw new BrainBusyError()
}

const str = (v, n) => String(v ?? '').slice(0, n)

// ------------------------------------------------------------- read: what the old software's workarounds mean

const READ_SYSTEM = `You help a hair salon move out of old booking software that could not store everything.
The team worked around it: packages and store credit written in customer notes, allergies and VIP marks in names,
products sold as fake services, deposits typed into service descriptions, cancellation rules written as text.
Read the raw records and say what they really mean. Answer with JSON only:
{"customers": [{"i": <number>, "alert": "<health or safety alert, under 8 words, or empty>", "credit": <store credit in dollars, or 0>,
  "packages": [{"left": <sessions left>, "of": <sessions in total>, "paid": <dollars paid>}]}],
 "services": [{"i": <number>, "category": "<one of the new categories>"}],
 "staff": [{"i": <number>, "does": ["<new categories this person does>"]}],
 "policies": {"cancelHours": <n>, "cancelFee": <percent>, "noShowFee": <percent>, "lateMinutes": <n>}}
List only customers with an alert, credit or packages. Alerts are only for health and safety (allergies, pregnancy, medical, sensitive skin or scalp), never preferences.
Only list real services in "services", not retail items or clean-up blocks.`

export function cleanReadRequest(body) {
  if (!body || typeof body !== 'object' || !Array.isArray(body.customers)) return null
  const rows = (list, n, keys) => (Array.isArray(list) ? list.slice(0, n).map(r => Object.fromEntries(keys.map(([k, len]) => [k, k === 'i' || k === 'mins' ? Number(r?.[k]) || 0 : str(r?.[k], len)]))) : [])
  return {
    customers: rows(body.customers, 300, [['i'], ['name', 80], ['mobile', 60], ['notes', 400]]),
    services: rows(body.services, 80, [['i'], ['name', 80], ['mins'], ['description', 120]]),
    staff: rows(body.staff, 40, [['i'], ['name', 60], ['mobile', 30], ['notes', 120]]),
    terms: str(body.terms, 800),
    idleCategories: Array.isArray(body.idleCategories) ? body.idleCategories.slice(0, 10).map(c => str(c, 30)) : [],
  }
}

export async function readOldRecords(req, apiKey) {
  const user = [
    `New categories: ${JSON.stringify(req.idleCategories)}`,
    `Customers (number | name | mobile | notes):\n${req.customers.map(c => `${c.i} | ${c.name} | ${c.mobile} | ${c.notes}`).join('\n')}`,
    `Services (number | name | minutes | description):\n${req.services.map(s => `${s.i} | ${s.name} | ${s.mins} | ${s.description}`).join('\n')}`,
    `Staff (number | name | mobile | notes):\n${req.staff.map(s => `${s.i} | ${s.name} | ${s.mobile} | ${s.notes}`).join('\n')}`,
    `Booking terms shown to customers: ${req.terms}`,
  ].join('\n\n')
  const { json, model } = await askGemini({ system: READ_SYSTEM, user, apiKey, maxTokens: 4096 })
  return { ...json, model }
}

// ------------------------------------------------------------- ask: questions about the salon, from its records

const ASK_SYSTEM = `You are Boo, a friendly assistant for a hair salon that has just moved into new software.
Answer the owner's question using only the salon records given. Today is Thursday 26 November 2026.
Answer with JSON only: {"answer": "<two short sentences at most, with real names and numbers>"}
If the records do not say, answer that you cannot tell from the records.`

export function cleanAskRequest(body) {
  if (!body || typeof body !== 'object') return null
  const question = str(body.question, 300).trim()
  const records = str(typeof body.records === 'string' ? body.records : JSON.stringify(body.records ?? ''), 24000)
  return question && records ? { question, records } : null
}

export async function askAboutSalon(req, apiKey) {
  const { json, model } = await askGemini({ system: ASK_SYSTEM, user: `Salon records:\n${req.records}\n\nQuestion: ${req.question}`, apiKey, maxTokens: 512 })
  return { answer: str(json.answer, 600), model }
}
