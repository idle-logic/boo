// The language model, used for mapping old records to new forms and for
// noticing what matters on screen. Google Gemini's free tier, no card needed.
// Set GEMINI_API_KEY in .env.local next to package.json.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const MODELS = ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-flash-lite-latest']

export function loadEnv(root) {
  const path = join(root, '.env.local')
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf-8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}

export const hasModel = () => Boolean(process.env.GEMINI_API_KEY)

/** One prompt, JSON reply. Returns the parsed object, or null on any failure. */
export async function askJson({ system, user }) {
  if (!hasModel()) return null
  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: 'user', parts: [{ text: user }] }],
    generationConfig: { temperature: 0.1, maxOutputTokens: 2048, responseMimeType: 'application/json' },
  })
  const models = process.env.GEMINI_MODEL ? [process.env.GEMINI_MODEL] : MODELS
  for (const model of models) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
        body,
        signal: AbortSignal.timeout(15000),
      })
      if (!res.ok) continue
      const data = await res.json()
      const text = (data.candidates?.[0]?.content?.parts ?? []).map(p => p.text ?? '').join('')
      const start = text.indexOf('{')
      const end = text.lastIndexOf('}')
      if (start < 0 || end <= start) continue
      return JSON.parse(text.slice(start, end + 1))
    } catch {
      // Try the next model.
    }
  }
  return null
}
