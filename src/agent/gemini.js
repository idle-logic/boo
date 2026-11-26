// Boo's brain on Google Gemini (free tier, no card). Server side only: used by
// the Netlify function and the local demo server. The key never reaches a browser.
import { SYSTEM, buildUserTurn } from './prompt.js'

const MODELS = ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-flash-lite-latest']
const TIMEOUT_MS = 8000

export class BrainBusyError extends Error {
  constructor() {
    super('My brain is busy right now. Try again in a minute.')
  }
}

/** Keep requests small and well formed. Returns null if the body is unusable. */
export function cleanThinkRequest(body) {
  if (!body || typeof body !== 'object') return null
  const goal = typeof body.goal === 'string' ? body.goal.slice(0, 600) : ''
  const observation = typeof body.observation === 'string' ? body.observation.slice(0, 12000) : ''
  const history = Array.isArray(body.history)
    ? body.history.slice(-14).map(h => ({
        thought: String(h?.thought ?? '').slice(0, 200),
        action:
          h?.action && typeof h.action === 'object'
            ? {
                type: String(h.action.type ?? '').slice(0, 20),
                ...(h.action.id ? { id: String(h.action.id).slice(0, 20) } : {}),
                ...(h.action.option ? { option: String(h.action.option).slice(0, 80) } : {}),
                ...(h.action.text ? { text: String(h.action.text).slice(0, 300) } : {}),
              }
            : undefined,
        result: String(h?.result ?? '').slice(0, 300),
        error: h?.error ? String(h.error).slice(0, 200) : undefined,
      }))
    : []
  if (!goal || !observation) return null
  return { goal, observation, history }
}

/** One step of thinking. Returns { thought, action }. Throws BrainBusyError when no model answers. */
export async function think({ goal, observation, history }, apiKey, models = MODELS) {
  if (!apiKey) throw new BrainBusyError()
  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: SYSTEM }] },
    contents: [{ role: 'user', parts: [{ text: buildUserTurn({ goal, observation, history }) }] }],
    generationConfig: { temperature: 0.2, maxOutputTokens: 1024, responseMimeType: 'application/json' },
  })
  for (const model of models) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
        body,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
      if (!res.ok) continue
      const data = await res.json()
      const text = (data.candidates?.[0]?.content?.parts ?? []).filter(p => !p.thought).map(p => p.text ?? '').join('')
      const start = text.indexOf('{')
      const end = text.lastIndexOf('}')
      if (start < 0 || end <= start) continue
      const parsed = JSON.parse(text.slice(start, end + 1))
      if (parsed && typeof parsed === 'object' && (parsed.action || Array.isArray(parsed.actions))) {
        return {
          thought: String(parsed.thought ?? ''),
          ...(parsed.action ? { action: parsed.action } : {}),
          ...(Array.isArray(parsed.actions) ? { actions: parsed.actions.slice(0, 8) } : {}),
        }
      }
    } catch {
      // Try the next model.
    }
  }
  throw new BrainBusyError()
}

/** A small per-visitor limit, so a busy demo cannot burn the free quota. */
export function makeRateLimiter({ perMinute = 40, perDay = 600 } = {}) {
  const hits = new Map()
  return ip => {
    const now = Date.now()
    const list = (hits.get(ip) ?? []).filter(t => now - t < 86_400_000)
    const lastMinute = list.filter(t => now - t < 60_000).length
    if (lastMinute >= perMinute || list.length >= perDay) return false
    list.push(now)
    hits.set(ip, list)
    return true
  }
}
