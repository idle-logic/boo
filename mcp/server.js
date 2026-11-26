#!/usr/bin/env node
// An MCP server so Kiro's agent can talk through Boo directly.
// Add it to .kiro/settings/mcp.json, then the agent can call these tools.

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

await server.connect(new StdioServerTransport())
