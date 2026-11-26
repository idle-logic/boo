// POST /api/plan: the AI part of a switch plan for the browser demo.
// Set GEMINI_API_KEY in the Netlify site's environment variables.
import { planSwitch, cleanPlanRequest } from '../../src/agent/plan.js'
import { makeRateLimiter, BrainBusyError } from '../../src/agent/gemini.js'

const allow = makeRateLimiter({ perMinute: 10, perDay: 200 })

export default async (req, context) => {
  if (req.method !== 'POST') return new Response('Not found', { status: 404 })
  if (!allow(context.ip ?? 'unknown')) return Response.json({ error: 'Busy. Try again in a minute.' }, { status: 429 })
  const body = cleanPlanRequest(await req.json().catch(() => null))
  if (!body) return Response.json({ error: 'Nothing to plan.' }, { status: 400 })
  try {
    return Response.json(await planSwitch(body, process.env.GEMINI_API_KEY))
  } catch (err) {
    const busy = err instanceof BrainBusyError
    return Response.json({ error: busy ? err.message : 'Something went wrong.' }, { status: busy ? 503 : 500 })
  }
}

export const config = { path: '/api/plan' }
