#!/usr/bin/env node
// An MCP server for Kiro's agent: talk through Boo, and use Haunt's migration engine
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
    return 'Haunt is not running, so nobody saw that. Carry on.'
  }
}

const reply = text => ({ content: [{ type: 'text', text }] })

const server = new McpServer({ name: 'haunt', version: '0.1.0' })

server.tool(
  'haunt_say',
  'Show a short message to the developer in a speech bubble from Boo, the ghost on their screen. Keep it under 120 characters.',
  { text: z.string().min(1).max(140) },
  async ({ text }) => reply(await send('say', text)),
)

server.tool(
  'haunt_status',
  'Tell the developer what you are doing. Use "start" when you begin a long task, "done" when it is finished, "fail" when something broke.',
  { status: z.enum(['start', 'done', 'fail']), text: z.string().max(140).default('') },
  async ({ status, text }) => reply(await send(status, text)),
)

server.tool(
  'haunt_needs_you',
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
  'haunt_sample_old_app',
  'Get the demo old app (Slotly, a salon booking app shutting down) as raw records, to try the other Haunt tools on.',
  {},
  async () => {
    const { truth, ...records } = slotlyRecords()
    return json(records)
  },
)

server.tool(
  'haunt_find_workarounds',
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
  'haunt_check_changes',
  'Check proposed changes against an old app\'s records before applying them. Returns which changes fit and which are refused, with reasons.',
  { ...oldApp, edits: z.array(row).describe('Changes: { action: set|add|remove, target: client|service|staff|product|booking|policy, name, field, value, record }') },
  async ({ edits, ...records }) => {
    const read = readWithRules({ sales: [], ...records })
    return json(applyEdits(read, cleanEdits(edits)))
  },
)

await server.connect(new StdioServerTransport())
