#!/usr/bin/env node
// Tell Boo something. Built for Kiro hooks, so it never fails a hook:
// if Haunt is not running, it exits quietly.
//
//   haunt start "Writing tests for Spec 2"
//   haunt tool "npm test"
//   haunt done "All tasks complete"
//   haunt fail "3 tests failed"
//   haunt needs-you "Approve a shell command"
//   haunt say "Hello"

const TYPES = ['start', 'tool', 'done', 'fail', 'needs-you', 'say']
const port = Number(process.env.HAUNT_PORT ?? 47474)

const [type, ...words] = process.argv.slice(2)
if (!TYPES.includes(type)) {
  console.log(`Usage: haunt <${TYPES.join('|')}> [text]`)
  process.exit(type ? 1 : 0)
}

try {
  await fetch(`http://127.0.0.1:${port}/event`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ type, text: words.join(' ') }),
    signal: AbortSignal.timeout(1500),
  })
} catch {
  // Haunt is not running. That is fine.
}
