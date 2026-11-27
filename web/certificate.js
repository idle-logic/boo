// Boo's proof certificate. A switch is done when every record and every dollar is
// accounted for, not when the typing stops. The certificate says so in a way anyone
// can check again later: each record set is hashed, money is totalled, every check
// is listed, and the whole thing is sealed with SHA-256.
//
// Verdicts: "AT REST" (everything matched) or "STILL HAUNTED" (something did not).
// Pure module: runs in the browser and in Node (both have crypto.subtle).

const norm = v => (typeof v === 'boolean' ? (v ? 'yes' : 'no') : String(v ?? '').trim().toLowerCase().replace(/\s+/g, ' '))
const num = v => {
  const n = Number(String(v ?? '').replace(/[$,]/g, ''))
  return Number.isFinite(n) ? n : 0
}
const yes = v => v === true || /^yes|true$/i.test(String(v))

/** What identifies each record in each set. Only fields every system keeps the same way. */
export const KEYS = {
  clients: c => [norm(c.name), norm(c.phone).replace(/^\+65 /, ''), yes(c.vip) ? 'vip' : '', num(c.credit)].join('|'),
  packages: p => [norm(p.client), num(p.left), num(p.of), num(p.paid)].join('|'),
  bookings: b => [norm(b.client), norm(b.service), norm(b.staff), norm(b.date), norm(b.time)].join('|'),
  services: s => [norm(s.name), num(s.price), num(s.minutes)].join('|'),
  products: p => [norm(p.name), num(p.price)].join('|'),
  staff: s => norm(s.name),
}

export async function sha256(text) {
  const bytes = new TextEncoder().encode(text)
  const hash = await globalThis.crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('')
}

/** Multiset difference: what is in a but not in b. */
function minus(a, b) {
  const left = new Map()
  for (const k of b) left.set(k, (left.get(k) ?? 0) + 1)
  const out = []
  for (const k of a) {
    const n = left.get(k) ?? 0
    if (n) left.set(k, n - 1)
    else out.push(k)
  }
  return out
}

/** JSON with sorted keys, so the same content always gives the same seal. */
export function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`
  return JSON.stringify(value)
}

/**
 * Compare what should have arrived with what did.
 * expected and actual: { clients, packages, bookings, services, products, staff } (any subset).
 */
export async function certify({ subject, source = null, expected, actual, applied = [] }) {
  const sets = {}
  const checks = []
  for (const name of Object.keys(KEYS).filter(k => expected[k])) {
    const e = (expected[name] ?? []).map(KEYS[name]).sort()
    const a = (actual[name] ?? []).map(KEYS[name]).sort()
    const missing = minus(e, a)
    const extra = minus(a, e)
    sets[name] = { count: e.length, arrived: a.length, sha256: await sha256(e.join('\n')), missing: missing.slice(0, 5), extra: extra.slice(0, 5) }
    checks.push({ check: `${name}: count`, pass: e.length === a.length, detail: `${e.length} expected, ${a.length} arrived` })
    checks.push({ check: `${name}: every record`, pass: !missing.length && !extra.length, detail: missing.length || extra.length ? `${missing.length} missing, ${extra.length} extra` : 'all match' })
  }
  const money = {}
  if (expected.packages) {
    const e = expected.packages.reduce((s, p) => s + num(p.paid), 0)
    const a = (actual.packages ?? []).reduce((s, p) => s + num(p.paid), 0)
    money.prepaid = { expected: e, arrived: a }
    checks.push({ check: 'prepaid dollars', pass: e === a, detail: `$${e} = $${a}` })
  }
  if (expected.clients) {
    const e = expected.clients.reduce((s, c) => s + num(c.credit), 0)
    const a = (actual.clients ?? []).reduce((s, c) => s + num(c.credit), 0)
    money.credit = { expected: e, arrived: a }
    checks.push({ check: 'store credit dollars', pass: e === a, detail: `$${e} = $${a}` })
  }
  const passed = checks.filter(c => c.pass).length
  const body = {
    type: 'boo/certificate',
    version: 1,
    subject,
    source,
    verdict: passed === checks.length ? 'AT REST' : 'STILL HAUNTED',
    passed,
    checks: checks.length,
    sets,
    money,
    detail: checks,
    applied,
  }
  return { ...body, seal: await sha256(canonical(body)), issued: new Date().toISOString() }
}

/** Is this certificate exactly as it was sealed? */
export async function checkSeal(cert) {
  if (!cert || cert.type !== 'boo/certificate') return false
  const { seal, issued, ...body } = cert
  return seal === (await sha256(canonical(body)))
}

/** Two certificates for the same work agree when their sets and verdict agree, whenever they were issued. */
export function sameResult(a, b) {
  const pick = c => canonical({ verdict: c.verdict, sets: Object.fromEntries(Object.entries(c.sets).map(([k, v]) => [k, v.sha256])), money: c.money, source: c.source?.sha256 ?? null })
  return pick(a) === pick(b)
}
