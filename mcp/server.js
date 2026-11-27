#!/usr/bin/env node
// An MCP server for Kiro's agent: talk through Boo, and use Boo's migration engine
// (find workarounds in an old app's records, check changes before applying them).
// It is set up in .kiro/settings/mcp.json.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'

const port = Number(process.env.HAUNT_PORT ?? 47474)

async function send(type, text) {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/event`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type, text }),
      signal: AbortSignal.timeout(1500),
    })
    return res.ok ? 'Boo got it.' : 'Boo did not understand that.'
  } catch {
    return 'Boo is not running, so nobody saw that. Carry on.'
  }
}

const reply = text => ({ content: [{ type: 'text', text }] })

const server = new McpServer({ name: 'boo', version: '0.1.0' })

server.tool(
  'boo_say',
  'Show a short message to the developer in a speech bubble from Boo, the ghost on their screen. Keep it under 120 characters.',
  { text: z.string().min(1).max(140) },
  async ({ text }) => reply(await send('say', text)),
)

server.tool(
  'boo_status',
  'Tell the developer what you are doing. Use "start" when you begin a long task, "done" when it is finished, "fail" when something broke.',
  { status: z.enum(['start', 'done', 'fail']), text: z.string().max(140).default('') },
  async ({ status, text }) => reply(await send(status, text)),
)

server.tool(
  'boo_needs_you',
  'Get the developer back to the screen. Boo flies to their cursor and knocks until they click. Use when you are blocked on their decision.',
  { reason: z.string().min(1).max(140) },
  async ({ reason }) => reply(await send('needs-you', reason)),
)

// ------------------------------------------------------------- the migration engine, as tools
// The same rules the browser demo uses, so Kiro's agent can find workarounds in any old app's records.

const { readWithRules, findingsFor } = await import('../web/interpret.js')
const { slotlyRecords } = await import('../web/data.js')
const { applyEdits, cleanEdits } = await import('../web/edits.js')

const row = z.record(z.string(), z.any())
const oldApp = {
  customers: z.array(row).describe('Customers as the old app shows them: name, mobile, email, visits, lastVisit, notes'),
  services: z.array(row).describe('Services: name, mins, price, description'),
  staff: z.array(row).describe('Staff: name, mobile, notes'),
  appointments: z.array(row).describe('Appointments: date, time, customer, service, staff, mins'),
  terms: z.string().default('').describe('Cancellation and booking terms, as written'),
}
const json = value => reply(JSON.stringify(value, null, 2))

server.tool(
  'boo_sample_old_app',
  'Get the demo old app (Slotly, a salon booking app shutting down) as raw records, to try the other Boo tools on.',
  {},
  async () => {
    const { truth, ...records } = slotlyRecords()
    return json(records)
  },
)

server.tool(
  'boo_find_workarounds',
  'Read an old app\'s raw records and list the workarounds staff used: data hidden in names, notes, fake services and fake bookings, with an example of each and what it becomes in the new app.',
  oldApp,
  async records => {
    const read = readWithRules({ sales: [], ...records })
    const found = findingsFor({ sales: [], ...records }, read).map(f => ({ key: f.key, title: f.title, count: f.count, example: { old: f.from?.[0], new: f.to?.[0] }, choices: f.choices?.map(c => c[1]) }))
    const unclear = read.clients.flatMap(c => (c.unclear ?? []).map(text => ({ client: c.name, text })))
    return json({ found, notesOnlyAiCanRead: unclear, counts: { clients: read.clients.length, services: read.services.length, products: read.products.length, staff: read.staff.length, bookings: read.bookings.length } })
  },
)

server.tool(
  'boo_check_changes',
  'Check proposed changes against an old app\'s records before applying them. Returns which changes fit and which are refused, with reasons.',
  { ...oldApp, edits: z.array(row).describe('Changes: { action: set|add|remove, target: client|service|staff|product|booking|policy, name, field, value, record }') },
  async ({ edits, ...records }) => {
    const read = readWithRules({ sales: [], ...records })
    return json(applyEdits(read, cleanEdits(edits)))
  },
)

// ------------------------------------------------------------- raise any export, and prove it

const { parseCsv, guessKinds, raise, findingsFromRaise, cleanFiles } = await import('../web/raise.js')
const { certify, checkSeal, sha256 } = await import('../web/certificate.js')
const { certifySample } = await import('../src/boo/engine.mjs')

server.tool(
  'boo_raise_csv',
  'Raise a CSV export from any old software (a CRM, a booking app, a gym, a clinic): work out each column, find data hidden in names and notes (VIP marks, health alerts, prepaid packages, credit, second numbers), and return clean records, clean CSV files and a sealed certificate proving the files hold every record and every dollar.',
  { csv: z.string().max(4_000_000).describe('The CSV text, header row first'), name: z.string().max(120).default('export.csv') },
  async ({ csv, name }) => {
    const [headers, ...rows] = parseCsv(csv)
    if (!headers || !rows.length) return reply('That CSV has no rows.')
    const kinds = guessKinds(headers, rows)
    const { records, found } = raise({ headers, rows, kinds })
    const files = cleanFiles(records)
    const back = parseCsv(files['clients.csv']).slice(1).map(r => ({ name: r[0], phone: r[1], vip: r[3] === 'Yes', credit: r[5] }))
    const backPk = parseCsv(files['packages.csv']).slice(1).map(r => ({ client: r[0], left: r[2], of: r[3], paid: r[4] }))
    const certificate = await certify({
      subject: `Raised ${name}`,
      source: { name, sha256: await sha256(Buffer.from(csv).toString('base64')), rows: rows.length, columns: headers.length },
      expected: { clients: records.map(c => ({ name: c.name, phone: c.phone, vip: c.vip, credit: c.credit })), packages: records.flatMap(c => c.packages.map(p => ({ client: c.name, left: p.left, of: p.of, paid: p.paid }))) },
      actual: { clients: back, packages: backPk },
    })
    return json({ columns: headers.map((h, i) => ({ header: h, kind: kinds[i] })), found: findingsFromRaise(found).map(f => ({ title: f.title, count: f.count, example: f.ex })), notesOnlyAiCanRead: found.unclear.map(u => u.text), files, certificate })
  },
)

server.tool(
  'boo_certify_sample',
  'Run the demo switch (Slotly to Idle) end to end without a browser and certify the result against the hidden truth. Returns the sealed certificate: AT REST when every record and dollar matches, STILL HAUNTED with what is missing otherwise.',
  {},
  async () => json(await certifySample()),
)

server.tool(
  'boo_verify_certificate',
  'Check a Boo certificate: is its SHA-256 seal intact (nothing changed since it was issued), and what was its verdict?',
  { certificate: z.string().max(2_000_000).describe('The certificate JSON') },
  async ({ certificate }) => {
    let cert
    try {
      cert = JSON.parse(certificate)
    } catch {
      return reply('That is not JSON.')
    }
    const sealed = await checkSeal(cert)
    return json({ sealed, verdict: sealed ? cert.verdict : null, subject: cert.subject, checks: sealed ? `${cert.passed}/${cert.checks}` : null })
  },
)

await server.connect(new StdioServerTransport())
