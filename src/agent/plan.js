// The planning call for a switch: category names, health notes and people
// entered twice. Server side only, on the Gemini free tier. The browser checks
// every answer again before using it (web/plan.js).
import { BrainBusyError } from './gemini.js'

const MODELS = ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-flash-lite-latest']

const SYSTEM = `You help move a hair salon from its old booking software into a new one.
Answer with JSON only, in this shape:
{"categories": {"<old category>": "<one of the new categories>"},
 "alerts": [{"i": <note number>, "alert": "<short alert, under 8 words>"}],
 "sameStaff": [[<staff number to keep>, <staff number that is the same person>]]}
Rules:
- Map every old category to the closest new category.
- Make an alert only for health and safety: allergies, pregnancy, medical conditions, sensitive skin or scalp. Not for preferences or habits.
- Two staff entries are the same person only with strong signs, like the same phone number and a matching name. Keep the fuller name.`

/** Keep the request small and well formed. Returns null if unusable. */
export function cleanPlanRequest(body) {
  if (!body || typeof body !== 'object') return null
  const strings = (list, n, len) => (Array.isArray(list) ? list.slice(0, n).map(x => String(x).slice(0, len)) : [])
  const notes = Array.isArray(body.notes) ? body.notes.slice(0, 200).map(n => ({ i: Number(n?.i), text: String(n?.text ?? '').slice(0, 200) })).filter(n => Number.isInteger(n.i)) : []
  const staff = Array.isArray(body.staff) ? body.staff.slice(0, 50).map(s => ({ i: Number(s?.i), name: String(s?.name ?? '').slice(0, 60), phone: String(s?.phone ?? '').slice(0, 30), role: String(s?.role ?? '').slice(0, 60) })).filter(s => Number.isInteger(s.i)) : []
  const categories = strings(body.categories, 40, 60)
  const idleCategories = strings(body.idleCategories, 40, 60)
  if (!categories.length || !idleCategories.length) return null
  return { categories, idleCategories, notes, staff }
}

export async function planSwitch(req, apiKey, models = MODELS) {
  if (!apiKey) throw new BrainBusyError()
  const turn = [
    `Old categories: ${JSON.stringify(req.categories)}`,
    `New categories: ${JSON.stringify(req.idleCategories)}`,
    `Client notes (number: text):\n${req.notes.map(n => `${n.i}: ${n.text}`).join('\n')}`,
    `Staff (number: name, role, phone):\n${req.staff.map(s => `${s.i}: ${s.name}, ${s.role}, ${s.phone}`).join('\n')}`,
  ].join('\n\n')
  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: SYSTEM }] },
    contents: [{ role: 'user', parts: [{ text: turn }] }],
    generationConfig: { temperature: 0.1, maxOutputTokens: 2048, responseMimeType: 'application/json' },
  })
  for (const model of models) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
        body,
        signal: AbortSignal.timeout(10000),
      })
      if (!res.ok) continue
      const data = await res.json()
      const text = (data.candidates?.[0]?.content?.parts ?? []).filter(p => !p.thought).map(p => p.text ?? '').join('')
      const parsed = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1))
      if (parsed && typeof parsed === 'object') return parsed
    } catch {
      // Try the next model.
    }
  }
  throw new BrainBusyError()
}
