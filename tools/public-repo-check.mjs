#!/usr/bin/env node
// Before a commit: nothing private or off-voice goes into this public repository.
//   node tools/public-repo-check.mjs            checks what is staged (git pre-commit)
//   node tools/public-repo-check.mjs --hook     the same for a Kiro PreToolUse hook (event on stdin)
// Blocks: em or en dashes in added lines, env and key files, anything shaped like an API key,
// and home folder paths.

import { execFileSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

const KEY = /\b(AIza[0-9A-Za-z_-]{30,}|sk-[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{30,}|AKIA[0-9A-Z]{16})\b/
const HOME = /[A-Z]:\\Users\\[A-Za-z0-9._-]+|\/Users\/[A-Za-z0-9._-]+\/|\/home\/[A-Za-z0-9._-]+\//
const SECRET_FILE = /(^|\/)(\.env(\..*)?|.*\.pem|.*\.key|credentials\.json|\.claude\/settings\.local\.json)$/

/** Findings for staged files and the lines they add. Pure, so it is tested. */
export function findings(files, diff) {
  const out = []
  for (const f of files) if (SECRET_FILE.test(f) && !f.endsWith('.env.example')) out.push(`${f}: secret or env file`)
  let file = ''
  for (const line of diff.split('\n')) {
    if (line.startsWith('+++ b/')) file = line.slice(6)
    if (!line.startsWith('+') || line.startsWith('+++')) continue
    const text = line.slice(1)
    // Text people read: no em or en dashes (Boo's voice). Code files are checked too, since their strings are read.
    if (/[—–]/.test(text) && !/\.(json|lock)$/.test(file) && !/years|2011/.test(text)) out.push(`${file}: dash in "${text.trim().slice(0, 60)}"`)
    if (KEY.test(text)) out.push(`${file}: looks like an API key`)
    if (HOME.test(text) && !file.startsWith('tests/') && !file.endsWith('.md')) out.push(`${file}: a home folder path`)
  }
  return out
}

const git = args => execFileSync('git', args, { encoding: 'utf-8' })

async function main() {
  if (process.argv.includes('--hook')) {
    let raw = ''
    for await (const chunk of process.stdin) raw += chunk
    let command = ''
    try {
      command = JSON.parse(raw || '{}')?.tool_input?.command ?? ''
    } catch {}
    if (!/\bgit\s+commit\b/.test(command)) process.exit(0)
  }
  const files = git(['diff', '--cached', '--name-only']).split('\n').filter(Boolean)
  const found = findings(files, git(['diff', '--cached', '-U0']))
  if (!found.length) return
  const reason = `Public repo check: ${found.length} problem${found.length > 1 ? 's' : ''}. ${found.slice(0, 8).join(' | ')}`
  if (process.argv.includes('--hook')) console.log(JSON.stringify({ decision: 'block', reason }))
  console.error(reason)
  process.exit(2)
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) await main()
