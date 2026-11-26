// A tiny local server for Kiro. Hooks, the haunt CLI and the MCP server POST
// events here, and Boo reacts. It only listens on 127.0.0.1.
import { createServer } from 'node:http'

export const EVENT_PORT = Number(process.env.HAUNT_PORT ?? 47474)
const TYPES = new Set(['start', 'tool', 'done', 'fail', 'needs-you', 'say', 'do', 'stop'])
const MAX_BODY = 4096

/** Validate one event. Returns null when it is not something Boo understands. */
export function parseEvent(body) {
  if (!body || typeof body !== 'object') return null
  const type = String(body.type ?? '')
  if (!TYPES.has(type)) return null
  const limit = type === 'do' ? 400 : 140
  const text = typeof body.text === 'string' ? body.text.replace(/\s+/g, ' ').trim().slice(0, limit) : ''
  // "do" may name the window to work in, by part of its title.
  const window = type === 'do' && typeof body.window === 'string' ? body.window.trim().slice(0, 80) : ''
  return window ? { type, text, window } : { type, text }
}

export function startEventServer(onEvent) {
  const server = createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200, { 'content-type': 'application/json' })
      return res.end('{"ok":true,"name":"haunt"}')
    }
    if (req.method !== 'POST' || req.url !== '/event') {
      res.writeHead(404)
      return res.end()
    }
    let raw = ''
    req.on('data', chunk => {
      raw += chunk
      if (raw.length > MAX_BODY) req.destroy()
    })
    req.on('end', () => {
      let event = null
      try {
        event = parseEvent(JSON.parse(raw))
      } catch {
        event = null
      }
      if (!event) {
        res.writeHead(400, { 'content-type': 'application/json' })
        return res.end('{"ok":false}')
      }
      onEvent(event)
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end('{"ok":true}')
    })
  })
  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(EVENT_PORT, '127.0.0.1', () => resolve(server))
  })
}
