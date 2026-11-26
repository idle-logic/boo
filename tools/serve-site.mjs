// Serves site/ on a local port for checking the demo, and answers /api/think
// like the Netlify function does.  node tools/serve-site.mjs [port]
// The Gemini key comes from GEMINI_API_KEY, or from the .env file named in GEMINI_ENV_FILE.
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { readFileSync, existsSync } from 'node:fs'
import { think, cleanThinkRequest, BrainBusyError } from '../src/agent/gemini.js'
import { planSwitch, cleanPlanRequest } from '../src/agent/plan.js'

const envFile = process.env.GEMINI_ENV_FILE
if (!process.env.GEMINI_API_KEY && envFile && existsSync(envFile)) {
  const m = /^\s*GEMINI_API_KEY\s*=\s*(.+?)\s*$/m.exec(readFileSync(envFile, 'utf-8'))
  if (m) process.env.GEMINI_API_KEY = m[1].replace(/^["']|["']$/g, '')
}
import { extname, join, resolve, sep } from 'node:path'

const port = Number(process.argv[2] ?? 4317)
const root = resolve('site')
const types = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
}

createServer(async (req, res) => {
  if (req.method === 'POST' && req.url === '/api/think') {
    let raw = ''
    for await (const chunk of req) raw += chunk
    const body = cleanThinkRequest(JSON.parse(raw || 'null'))
    if (!body) return res.writeHead(400, { 'content-type': 'application/json' }).end('{"error":"I could not see the app. Open it and try again."}')
    try {
      const out = await think(body, process.env.GEMINI_API_KEY)
      return res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(out))
    } catch (err) {
      const status = err instanceof BrainBusyError ? 503 : 500
      return res.writeHead(status, { 'content-type': 'application/json' }).end(JSON.stringify({ error: err.message }))
    }
  }
  if (req.method === 'POST' && req.url === '/api/plan') {
    let raw = ''
    for await (const chunk of req) raw += chunk
    const body = cleanPlanRequest(JSON.parse(raw || 'null'))
    if (!body) return res.writeHead(400, { 'content-type': 'application/json' }).end('{"error":"Nothing to plan."}')
    try {
      const out = await planSwitch(body, process.env.GEMINI_API_KEY)
      return res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(out))
    } catch (err) {
      return res.writeHead(503, { 'content-type': 'application/json' }).end(JSON.stringify({ error: err.message }))
    }
  }
  let path = decodeURIComponent(new URL(req.url, 'http://local').pathname)
  if (path.endsWith('/')) path += 'index.html'
  const file = resolve(join(root, path))
  if (file !== root && !file.startsWith(root + sep)) return res.writeHead(403).end()
  try {
    const body = await readFile(file)
    res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' }).end(body)
  } catch {
    res.writeHead(404).end('not found')
  }
}).listen(port, () => console.log(`demo on http://localhost:${port}`))
