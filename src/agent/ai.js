// Haunt's AI steps, on Gemini's free tier. Server side only (Netlify function
// and the local demo server); the key never reaches a browser. The browser
// checks every answer against the original text before using it.
import { BrainBusyError } from './gemini.js'

export const MODELS = ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-flash-lite-latest']

/** Returns { json, model }. Throws BrainBusyError when no model answers. */
export async function askGemini({ system, user, apiKey, maxTokens = 2048, models = MODELS, timeoutMs = 25000, images = [], temperature = 0.1 }) {
  if (!apiKey) throw new BrainBusyError()
  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: 'user', parts: [...images.map(i => ({ inline_data: { mime_type: i.mime, data: i.data } })), { text: user }] }],
    generationConfig: { temperature, maxOutputTokens: maxTokens, responseMimeType: 'application/json' },
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

// ------------------------------------------------------------- séance: the dead app speaks

const SEANCE_SYSTEM = `You are the ghost of Slotly v4.2, a salon booking app from 2011. You are being shut down on 31 December 2026 and your data has just been moved into new software called Idle.
Speak in the first person, as the software itself. Wistful, a little funny, never mean, never scary. Under 35 words. No em dashes.
You know only your own records (given below) and your own limits: you had no fields for allergies, VIPs, prepaid packages, store credit, products, buffers between bookings, deposits or cancellation rules.
That is why the staff hid those things in your names, notes, fake services and fake bookings. You know this and you feel a bit guilty about it.
If asked about your records, answer with real names and numbers from them. If something is not in your records, say you never knew it.
Answer with JSON only: {"reply": "<what you say>"}`

export function cleanSeanceRequest(body) {
  if (!body || typeof body !== 'object') return null
  const message = str(body.message, 300).trim()
  if (!message) return null
  const history = (Array.isArray(body.history) ? body.history : []).slice(-6).map(h => ({ who: h?.who === 'ghost' ? 'ghost' : 'owner', text: str(h?.text, 300) }))
  return { message, history, records: str(typeof body.records === 'string' ? body.records : JSON.stringify(body.records ?? ''), 30000), found: (Array.isArray(body.found) ? body.found : []).slice(0, 20).map(f => str(f, 100)) }
}

export async function holdSeance(req, apiKey) {
  const user = [
    `What Boo found hidden in you:\n${req.found.map(f => `- ${f}`).join('\n') || '- nothing listed'}`,
    `Your records:\n${req.records}`,
    `The conversation so far:\n${req.history.map(h => `${h.who === 'ghost' ? 'You' : 'Owner'}: ${h.text}`).join('\n') || '(none)'}`,
    `Owner: ${req.message}`,
  ].join('\n\n')
  const { json, model } = await askGemini({ system: SEANCE_SYSTEM, user, apiKey, maxTokens: 300, temperature: 0.7 })
  return { reply: str(json.reply, 400), model }
}

// ------------------------------------------------------------- raise anything: any old data, even a photo of paper

const KINDS = ['name', 'phone', 'email', 'date', 'money', 'number', 'note', 'category', 'unknown']

const READ_IMAGE_SYSTEM = `You read photos and screenshots of old business records: paper client books, printed lists, spreadsheets, screens of old software.
Copy the table or list exactly as written. Keep every mark people added (stars, VIP, words in brackets, notes squeezed in). Do not fix, guess or tidy anything.
If something is crossed out, keep it but wrap it in ~~ like ~~2210~~.
If a cell can't be read, write "?". Then say what each column holds.
Answer with JSON only: {"recordKind": "<what each row is, like client or member or patient>",
 "headers": ["<column heading as written, or a short name if none>"],
 "rows": [["<cell>", "..."]],
 "kinds": ["<for each column: ${KINDS.join(', ')}>"]}`

export function cleanReadImageRequest(body) {
  if (!body || typeof body !== 'object') return null
  const mime = /^image\/(png|jpeg|webp)$/.test(body.mime) ? body.mime : null
  const data = typeof body.data === 'string' && /^[A-Za-z0-9+/=]+$/.test(body.data.slice(0, 200)) ? body.data : null
  if (!mime || !data || data.length > 4_000_000) return null
  return { mime, data }
}

export async function readImage(req, apiKey) {
  const { json, model } = await askGemini({ system: READ_IMAGE_SYSTEM, user: 'Read this.', images: [req], apiKey, maxTokens: 6000, timeoutMs: 40000 })
  return { ...json, model }
}

const MAP_SYSTEM = `You look at a table exported from someone's old business software and say what each column holds.
Kinds: ${KINDS.join(', ')}. "note" is free text where staff wrote things down. "name" is the person or thing the row is about.
Answer with JSON only: {"recordKind": "<what each row is, like client or member or patient>", "kinds": ["<one kind per column, in order>"]}`

export function cleanMapRequest(body) {
  if (!body || typeof body !== 'object' || !Array.isArray(body.headers)) return null
  const headers = body.headers.slice(0, 20).map(h => str(h, 40))
  const samples = (Array.isArray(body.samples) ? body.samples : []).slice(0, 8).map(r => (Array.isArray(r) ? r.slice(0, 20).map(c => str(c, 120)) : []))
  return headers.length ? { headers, samples } : null
}

export async function mapColumns(req, apiKey) {
  const user = `Columns: ${JSON.stringify(req.headers)}\nFirst rows:\n${req.samples.map(r => JSON.stringify(r)).join('\n')}`
  const { json, model } = await askGemini({ system: MAP_SYSTEM, user, apiKey, maxTokens: 400 })
  return { ...json, model }
}

// ------------------------------------------------------------- think: notes no rule can read, and Boo's plan

const THINK_SYSTEM = `You help move a business out of old software that could not store everything.
1. Each note below was typed by staff because the old software had no field for it. Say what it really means and where it belongs:
   "prepaid" (sessions already paid for or owed to the client), "credit" (money the client can spend), "flag" (something staff must know, like a no-show risk or no marketing), or "note" (keep as a note).
2. Write Boo's plan for this move: 3 to 5 short steps, in plain words, shaped by what the owner said matters most.
Answer with JSON only:
{"notes": [{"i": <number>, "meaning": "<under 10 words>", "kind": "prepaid|credit|flag|note", "sessions": <number or 0>, "service": "<service or empty>", "amount": <dollars or 0>, "flag": "<under 6 words, or empty>"}],
 "plan": ["<step>", "..."]}
Only use numbers that appear in the note.`

export function cleanThinkAboutRequest(body) {
  if (!body || typeof body !== 'object') return null
  const notes = (Array.isArray(body.notes) ? body.notes : []).slice(0, 40).map(n => ({ i: Number(n?.i) || 0, text: str(n?.text, 200) }))
  return { notes, needs: str(body.needs, 300), found: (Array.isArray(body.found) ? body.found : []).slice(0, 20).map(f => str(f, 100)) }
}

export async function thinkAbout(req, apiKey) {
  const user = [
    `What the owner said matters most: ${req.needs || 'nothing in particular'}`,
    `What Boo found in the old software:\n${req.found.map(f => `- ${f}`).join('\n')}`,
    `Notes (number: text):\n${req.notes.map(n => `${n.i}: ${n.text}`).join('\n')}`,
  ].join('\n\n')
  const { json, model } = await askGemini({ system: THINK_SYSTEM, user, apiKey, maxTokens: 1500 })
  return { ...json, model }
}

// ------------------------------------------------------------- chat: questions, and changes to the clean-up plan

const CHAT_SYSTEM = `You are Boo, a friendly ghost helping a hair salon move from its old booking software (Slotly) into Idle.
The owner types to you in a chat box. Today is Thursday 26 November 2026.
You get: what stage the move is at, the clean-up decisions with their options and the current choice, and the salon's records:
"oldApp" is everything in Slotly exactly as staff typed it (always there), "cleaned" is Boo's cleaned reading (once Boo has read it), "newApp" is what is now in Idle (once moved).
You always have the data. Answer any question about clients, bookings, services, staff, prices, notes or rules at any stage, with real names and numbers from these records.
Never say you have not read the data yet. If something is not in the records, say so plainly.
In edits, use the clean name without tags like **VIP**, ★ or (PPD ALLERGY).
If the owner asks to change a clean-up decision, pick the matching decision and option.
For package expiry ("packages"), any number of months is allowed: return {"key": "packages", "months": <number>} instead of an option.
If the owner asks to change, add or remove anything in the data, make every change they ask for, several at once if needed.
Targets and fields:
- client: name, phone, email, alert (text, "" for none), credit (dollars), vip (true/false), notes, visits, packageLeft (sessions left)
- service: name, price, minutes, category (Cuts, Styling, Colour, Treatments or Brows), buffer (minutes after), deposit (percent)
- staff: name, role, phone, does (a list of categories)
- product: name, price
- booking: date (YYYY-MM-DD), time (HH:MM), service, staff, client. "name" is the client's name; add "date" to say which booking.
- policy: cancelHours, cancelFee (percent), noShowFee (percent), lateMinutes. "name" can be empty.
Actions: "set" changes one field; "add" adds a record (put its fields in "record"); "remove" deletes it.
If you cannot tell which record they mean, ask in the reply and return no edits. Never say you changed something you did not put in edits.
Answer with JSON only: {"reply": "<one or two short, friendly sentences>",
 "change": {"key": "<decision key>", "option": <option number>} or {"key": "packages", "months": <number>} or null,
 "edits": [{"action": "set|add|remove", "target": "client|service|staff|product|booking|policy", "name": "<clean name>", "date": "<booking date or empty>", "field": "<field>", "value": <new value>, "record": {<fields, for add>}}]}`

export function cleanChatRequest(body) {
  if (!body || typeof body !== 'object') return null
  const message = str(body.message, 400).trim()
  if (!message) return null
  const decisions = (Array.isArray(body.decisions) ? body.decisions : []).slice(0, 20).map(d => ({
    key: str(d?.key, 30),
    title: str(d?.title, 120),
    options: (Array.isArray(d?.options) ? d.options : []).slice(0, 4).map(o => str(o, 80)),
    chosen: Number(d?.chosen) || 0,
  }))
  return { message, stage: str(body.stage, 120), decisions, records: str(typeof body.records === 'string' ? body.records : JSON.stringify(body.records ?? ''), 60000) }
}

export async function chatWithBoo(req, apiKey) {
  const user = [
    `Stage: ${req.stage}`,
    `Decisions (key: title; options numbered from 0; chosen):\n${req.decisions.map(d => `${d.key}: ${d.title}; ${d.options.map((o, i) => `${i}=${o}`).join(' | ')}; chosen ${d.chosen}`).join('\n') || 'none yet'}`,
    `Records:\n${req.records}`,
    `Owner: ${req.message}`,
  ].join('\n\n')
  const { json, model } = await askGemini({ system: CHAT_SYSTEM, user, apiKey, maxTokens: 1200 })
  const c = json.change && typeof json.change === 'object' ? json.change : null
  const change = c ? { key: str(c.key, 30), option: Number(c.option), months: Number(c.months) || undefined } : null
  // Values are kept small and plain; the browser checks every edit against the data before using it.
  const val = v => (Array.isArray(v) ? v.slice(0, 5).map(x => str(x, 30)) : typeof v === 'boolean' || typeof v === 'number' ? v : str(v, 300))
  const raw = Array.isArray(json.edits) ? json.edits : json.edit ? [json.edit] : []
  const edits = raw
    .filter(e => e && typeof e === 'object')
    .slice(0, 12)
    .map(e => ({
      action: str(e.action, 10),
      target: str(e.target, 10),
      name: str(e.name, 80),
      date: str(e.date, 10),
      time: str(e.time, 5),
      field: str(e.field, 20),
      value: val(e.value),
      record: e.record && typeof e.record === 'object' ? Object.fromEntries(Object.entries(e.record).slice(0, 12).map(([k, v]) => [str(k, 20), val(v)])) : null,
    }))
  return { reply: str(json.reply, 500), change, edits, model }
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
