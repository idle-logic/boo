// POST /api/think: one step of Boo's thinking for the browser demo.
// Set GEMINI_API_KEY in the Netlify site's environment variables.
import { think, cleanThinkRequest, makeRateLimiter, BrainBusyError } from '../../src/agent/gemini.js'

const allow = makeRateLimiter()

export default async (req, context) => {
  if (req.method !== 'POST') return new Response('Not found', { status: 404 })
  if (!allow(context.ip ?? 'unknown')) {
    return Response.json({ error: 'Boo needs a short rest. Try again in a minute.' }, { status: 429 })
  }
  const body = cleanThinkRequest(await req.json().catch(() => null))
  if (!body) return Response.json({ error: 'I could not see the app. Open it and try again.' }, { status: 400 })
  try {
    return Response.json(await think(body, process.env.GEMINI_API_KEY))
  } catch (err) {
    const busy = err instanceof BrainBusyError
    return Response.json({ error: busy ? err.message : 'Something went wrong.' }, { status: busy ? 503 : 500 })
  }
}

export const config = { path: '/api/think' }
