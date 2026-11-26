// Serves site/ on a local port for checking the demo.  node tools/serve-site.mjs [port]
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join, resolve, sep } from 'node:path'

const port = Number(process.argv[2] ?? 4317)
const root = resolve('site')
const types = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
}

createServer(async (req, res) => {
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
