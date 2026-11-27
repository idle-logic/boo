// The switch's AI steps for the browser demo, on the Gemini free tier:
//   POST /api/read      what the old software's workarounds really mean
//   POST /api/ask       questions about the salon, from its moved records
//   POST /api/chat      the chat bar: questions, and changes to the clean-up plan
// Set GEMINI_API_KEY in the Netlify site's environment variables.
import { readOldRecords, cleanReadRequest, askAboutSalon, cleanAskRequest, chatWithBoo, cleanChatRequest, thinkAbout, cleanThinkAboutRequest, holdSeance, cleanSeanceRequest, readImage, cleanReadImageRequest, mapColumns, cleanMapRequest } from '../../src/agent/ai.js'
import { makeRateLimiter, BrainBusyError } from '../../src/agent/gemini.js'

const allow = makeRateLimiter({ perMinute: 20, perDay: 600 })
const TASKS = {
  '/api/read': [cleanReadRequest, readOldRecords],
  '/api/ask': [cleanAskRequest, askAboutSalon],
  '/api/chat': [cleanChatRequest, chatWithBoo],
  '/api/think-about': [cleanThinkAboutRequest, thinkAbout],
  '/api/seance': [cleanSeanceRequest, holdSeance],
  '/api/read-image': [cleanReadImageRequest, readImage],
  '/api/map-columns': [cleanMapRequest, mapColumns],
}

export default async (req, context) => {
  const task = TASKS[new URL(req.url).pathname]
  if (req.method !== 'POST' || !task) return new Response('Not found', { status: 404 })
  if (!allow(context.ip ?? 'unknown')) return Response.json({ error: 'Busy. Try again in a minute.' }, { status: 429 })
  const [clean, run] = task
  const body = clean(await req.json().catch(() => null))
  if (!body) return Response.json({ error: 'Nothing to work on.' }, { status: 400 })
  try {
    return Response.json(await run(body, process.env.GEMINI_API_KEY))
  } catch (err) {
    const busy = err instanceof BrainBusyError
    return Response.json({ error: busy ? err.message : 'Something went wrong.' }, { status: busy ? 503 : 500 })
  }
}

export const config = { path: ['/api/read', '/api/ask', '/api/chat', '/api/think-about', '/api/seance', '/api/read-image', '/api/map-columns'] }
