// Reading the workarounds. Old software could not hold everything, so the
// salon kept packages in notes, allergies in names and products as fake
// services. Here they become proper records, plus a list of findings the
// owner confirms ("is this right?") before anything moves.
//
// Gemini reads everything; its answers are only used when they are grounded
// in the original text. Plain rules read it too, and stand in when needed.

import { callAi } from './ai.js'

export const IDLE_CATEGORIES = ['Cuts', 'Styling', 'Colour', 'Treatments', 'Brows']
const CAT_WORDS = [
  ['Brows', /brow|lash/i],
  ['Treatments', /treat|keratin|scalp|mask/i],
  ['Colour', /colou?r|tint|balayage|highlight|toner/i],
  ['Cuts', /cut|trim|barber/i],
  ['Styling', /styl|blow|updo|bridal/i],
]
const HEALTH = /allerg|pregnan|asthma|latex|eczema|sensitive|patch test|medical|epilep|diabet/i
const PKG_NAMES = { blowdry: 'blow-dries', 'mens cuts': "men's cuts", 'scalp detox': 'scalp detox' }
const PKG = [
  [/^PKG (.+?): (\d+) left of (\d+), paid \$(\d+)/i, m => ({ short: m[1], left: +m[2], of: +m[3], paid: +m[4] })],
  [/^prepaid (\d+) (.+?) \(\$(\d+)\) - (\d+) remaining/i, m => ({ short: m[2], of: +m[1], paid: +m[3], left: +m[4] })],
  [/^(\d+)x (.+?) pkg, (\d+) used\. pd \$(\d+)/i, m => ({ short: m[2], of: +m[1], left: +m[1] - +m[3], paid: +m[4] })],
]
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
const iso = text => {
  const m = /(\d{1,2})\s+([A-Za-z]{3})[A-Za-z]*\s+(\d{4})/.exec(String(text))
  const mo = m ? MONTHS.indexOf(m[2].toLowerCase()) : -1
  return mo >= 0 ? `${m[3]}-${String(mo + 1).padStart(2, '0')}-${m[1].padStart(2, '0')}` : ''
}
export const categoryOf = name => CAT_WORDS.find(([, re]) => re.test(name))?.[0] ?? 'Cuts'

/** A customer's name without the marks the team added to it. */
export function cleanName(raw) {
  return String(raw).replace(/\s*★/g, '').replace(/\s*\*\*VIP\*\*/g, '').replace(/\s*\((PPD|LATEX) ALLERGY\)/gi, '').trim()
}

/** Read everything Slotly showed, with plain rules. */
export function readWithRules(old) {
  const clients = old.customers.map((c, i) => {
    const out = { src: i, name: cleanName(c.name), phone: '', email: c.email, visits: c.visits, lastVisit: iso(c.lastVisit), vip: /★|\*\*VIP\*\*/.test(c.name), alert: '', credit: 0, packages: [], notes: [] }
    const named = /\((PPD|LATEX) ALLERGY\)/i.exec(c.name)
    if (named) out.alert = named[1].toUpperCase() === 'PPD' ? 'Allergic to PPD' : 'Allergic to latex'
    const [main, second] = String(c.mobile || '').split(' / ')
    out.phone = main ? `+65 ${main}` : ''
    if (second) out.notes.push(`Second number: ${second}`)
    for (const part of String(c.notes || '').split(' | ').filter(Boolean)) {
      const pkg = PKG.map(([re, f]) => re.exec(part) && f(re.exec(part))).find(Boolean)
      if (pkg) {
        out.packages.push({ name: `${pkg.of} ${PKG_NAMES[pkg.short] ?? pkg.short}`, left: pkg.left, of: pkg.of, paid: pkg.paid, from: part })
        continue
      }
      if (/credit/i.test(part) && /\$(\d+)/.test(part)) {
        out.credit = Number(/\$(\d+)/.exec(part)[1])
        out.creditFrom = part
        continue
      }
      if (!out.alert && HEALTH.test(part)) out.alert = part.split(/[.,]/)[0].slice(0, 60)
      // Something owed, prepaid or promised, in no fixed shape: the rules cannot read it.
      if (/\b(owes?|paid ahead|voucher|no show|promo|comped|honou?r)\b/i.test(part)) out.unclear = [...(out.unclear ?? []), part]
      out.notes.push(part)
    }
    out.notes = out.notes.join(' ')
    return out
  })
  const services = []
  const products = []
  old.services.forEach((s, i) => {
    if (/^RETAIL\s*-\s*/i.test(s.name)) products.push({ src: i, name: s.name.replace(/^RETAIL\s*-\s*/i, ''), price: s.price })
    else if (/^CLEAN UP$/i.test(s.name)) return
    else services.push({ src: i, name: s.name, category: categoryOf(s.name), minutes: s.mins, buffer: 0, price: s.price, deposit: Number(/DEPOSIT (\d+)%/i.exec(s.description)?.[1] ?? 0) })
  })
  // Clean-up blocks booked straight after a service, by the same person, become that service's buffer.
  const toMins = t => Number(t.slice(0, 2)) * 60 + Number(t.slice(3))
  const bookings = []
  const cleanups = []
  const breaks = []
  old.appointments.forEach((a, i) => {
    if (a.customer === 'BLOCKED') return breaks.push({ src: i, ...a })
    if (/^CLEAN UP$/i.test(a.service)) {
      const before = old.appointments.find(b => b.date === a.date && b.staff === a.staff && b.service !== 'CLEAN UP' && toMins(b.time) + b.mins === toMins(a.time))
      cleanups.push({ src: i, after: before?.service, mins: a.mins })
      return
    }
    bookings.push({ src: i, date: a.date, time: a.time, client: cleanName(a.customer), service: a.service, staff: a.staff })
  })
  for (const c of cleanups) {
    const s = services.find(x => x.name === c.after)
    if (s) s.buffer = Math.max(s.buffer, c.mins)
  }
  const staff = old.staff.map((s, i) => {
    const does = IDLE_CATEGORIES.filter(cat => ({ Cuts: /cut/i, Styling: /styl/i, Colour: /colou?r/i, Treatments: /treat/i, Brows: /brow/i })[cat].test(s.notes))
    return { src: i, name: s.name, role: s.notes.includes('.') ? s.notes.split('.')[0] : s.notes.replace(/ only$/, ''), phone: `+65 ${s.mobile}`, does }
  })
  const sameStaff = []
  staff.forEach((a, i) => staff.slice(i + 1).forEach(b => a.phone === b.phone && sameStaff.push([a.src, b.src])))
  const t = old.terms
  const policies = {
    cancelHours: Number(/less than (\d+) hours/i.exec(t)?.[1] ?? 0),
    cancelFee: Number(/charged (\d+)%/i.exec(t)?.[1] ?? 0),
    noShowFee: /no-shows are charged in full/i.test(t) ? 100 : Number(/no-shows? .*?(\d+)%/i.exec(t)?.[1] ?? 0),
    lateMinutes: Number(/more than (\d+) minutes late/i.exec(t)?.[1] ?? 0),
  }
  return { clients, services, products, staff, sameStaff, bookings, cleanups, breaks, policies, by: 'rules' }
}

/** What Gemini is asked. Raw text only, as Slotly showed it. */
export function aiRequest(old) {
  return {
    customers: old.customers.map((c, i) => ({ i, name: c.name, mobile: c.mobile, notes: c.notes })),
    services: old.services.map((s, i) => ({ i, name: s.name, mins: s.mins, description: s.description })),
    staff: old.staff.map((s, i) => ({ i, name: s.name, mobile: s.mobile, notes: s.notes })),
    terms: old.terms,
    idleCategories: IDLE_CATEGORIES,
  }
}

const grounded = (n, text) => n === 0 || String(text).includes(String(n))

/** Use Gemini's reading wherever it is grounded in the original text; rules everywhere else. */
export function mergeReading(old, rules, ai) {
  if (!ai || typeof ai !== 'object') return rules
  const out = structuredClone(rules)
  let used = 0
  for (const a of Array.isArray(ai.customers) ? ai.customers : []) {
    const c = out.clients.find(x => x.src === a?.i)
    if (!c) continue
    const raw = old.customers[c.src]
    const text = `${raw.name} ${raw.notes}`
    if (typeof a.alert === 'string' && a.alert.trim() && HEALTH.test(text)) (c.alert = a.alert.trim().slice(0, 60)), used++
    if (Number.isFinite(a.credit) && a.credit > 0 && grounded(a.credit, raw.notes) && a.credit === c.credit) used++
    if (Array.isArray(a.packages) && a.packages.length === c.packages.length && a.packages.every((p, k) => grounded(p?.paid, raw.notes) && p.left === c.packages[k].left && p.of === c.packages[k].of)) used++
  }
  for (const a of Array.isArray(ai.services) ? ai.services : []) {
    const s = out.services.find(x => x.src === a?.i)
    if (s && IDLE_CATEGORIES.includes(a.category)) (s.category = a.category), used++
  }
  for (const a of Array.isArray(ai.staff) ? ai.staff : []) {
    const s = out.staff.find(x => x.src === a?.i)
    if (s && Array.isArray(a.does) && a.does.length && a.does.every(d => IDLE_CATEGORIES.includes(d))) (s.does = a.does), used++
  }
  const p = ai.policies
  if (p && typeof p === 'object') for (const k of Object.keys(out.policies)) if (Number.isFinite(p[k]) && (grounded(p[k], old.terms) || (k === 'noShowFee' && p[k] === 100))) out.policies[k] = p[k]
  return used ? { ...out, by: 'ai', model: typeof ai.model === 'string' ? ai.model : '', aiCount: used } : out
}

export async function readOldApp(old) {
  const rules = readWithRules(old)
  const ai = await callAi('/api/read', aiRequest(old), { timeoutMs: 30000 })
  return mergeReading(old, rules, ai)
}

/** Start Gemini reading now; the answer comes back later and is checked then. */
export function askGeminiToRead(old) {
  return callAi('/api/read', aiRequest(old), { timeoutMs: 30000 })
}

const money = n => `$${Math.round(n).toLocaleString('en')}`

/**
 * The findings the owner confirms. Each shows one real example: what Slotly
 * had, and what it becomes in Idle. The first choice is the recommended one.
 */
export function findingsFor(old, read) {
  const ex = list => list.slice(0, 1)
  const f = []
  const vips = read.clients.filter(c => c.vip)
  if (vips.length) f.push({ key: 'vip', title: 'VIP status typed into names', count: vips.length, from: ex(vips.map(c => old.customers[c.src].name)), to: ex(vips.map(c => `${c.name} · VIP tag`)), choices: [[true, "Yes, that's right"], [false, 'Leave names as they are']] })
  const alerts = read.clients.filter(c => c.alert)
  if (alerts.length) f.push({ key: 'alerts', title: 'Health alerts typed into names', count: alerts.length, from: ex(alerts.map(c => old.customers[c.src].name.includes('ALLERGY') ? old.customers[c.src].name : old.customers[c.src].notes.split(' | ')[0])), to: ex(alerts.map(c => `${c.name} · alert: ${c.alert}`)), choices: [[true, "Yes, make them alerts"], [false, 'Keep them as notes only']], ai: read.by === 'ai' })
  const pk = read.clients.flatMap(c => c.packages.map(p => ({ c, p })))
  if (pk.length) f.push({ key: 'packages', title: 'Prepaid balances hidden in notes', count: pk.length, sub: `${money(pk.reduce((a, x) => a + x.p.paid, 0))} prepaid. Idle needs an expiry date on each.`, from: [pk[0].p.from, pk[1]?.p.from].filter(Boolean), to: [pk[0], pk[1]].filter(Boolean).map(x => `${x.c.name} · ${x.p.name} · ${x.p.left} of ${x.p.of} left · paid $${x.p.paid}`), choices: [['2027-11-26', 'Yes, expire in 12 months'], ['2027-05-26', 'Yes, expire in 6 months']], ai: read.by === 'ai' })
  const credit = read.clients.filter(c => c.credit)
  if (credit.length) f.push({ key: 'credit', title: 'Account credit hidden in notes', count: credit.length, sub: `${money(credit.reduce((a, c) => a + c.credit, 0))} in total`, from: ex(credit.map(c => c.creditFrom)), to: ex(credit.map(c => `${c.name} · store credit $${c.credit}`)), choices: [[true, "Yes, that's right"], [false, 'Leave it in the notes']] })
  const two = read.clients.filter(c => c.notes.includes('Second number'))
  if (two.length) f.push({ key: 'phones', title: 'Two numbers in one field', count: two.length, from: ex(two.map(c => old.customers[c.src].mobile)), to: ex(two.map(c => `Phone ${c.phone} · the other number goes in the notes`)), choices: [[true, "Yes, that's right"]] })
  if (read.products.length) f.push({ key: 'retail', title: 'Products disguised as services', count: read.products.length, sub: 'Slotly never tracked stock, so Idle will ask you to count it.', from: ex(read.products.map(p => old.services[p.src].name)), to: ex(read.products.map(p => `Product: ${p.name} · $${p.price}`)), choices: [[true, 'Yes, make them products'], [false, 'Leave them out']] })
  const dep = read.services.filter(s => s.deposit)
  if (dep.length) f.push({ key: 'deposits', title: 'Deposit rules typed into descriptions', count: dep.length, from: ex(dep.map(s => `${s.name}: “${old.services[s.src].description}”`)), to: ex(dep.map(s => `${s.name} · deposit ${s.deposit}%`)), choices: [[true, "Yes, that's right"], [false, 'No deposits for now']] })
  if (read.cleanups.length) {
    const svc = read.services.filter(s => s.buffer)
    f.push({ key: 'cleanup', title: 'Fake bookings used to block time', count: read.cleanups.length, sub: `These become clean-up time on ${svc.length} services, so you never book them by hand again.`, from: ex(read.cleanups.map(c => `CLEAN UP, ${c.mins} min, after ${c.after}`)), to: svc.slice(0, 1).map(s => `${s.name} · ${s.buffer} min buffer after`), choices: [[true, "Yes, that's right"], [false, 'No buffer, I will book clean-ups myself']] })
  }
  if (read.breaks.length) f.push({ key: 'breaks', title: 'Fake bookings used for breaks', count: read.breaks.length, sub: 'They are not clients, so they will not move as bookings. Set breaks in each person’s hours in Idle.', from: ex(read.breaks.map(b => `BLOCKED, ${b.service}, ${b.staff}`)), to: ['Not moved as bookings'], choices: [[true, 'Got it']] })
  if (read.sameStaff.length) {
    const [a, b] = read.sameStaff[0].map(i => read.staff.find(s => s.src === i))
    f.push({ key: 'merge', title: `“${b.name}” looks like “${a.name}”`, count: 2, sub: `Same phone number, ${a.phone}.`, from: [`${a.name} (${a.role}) and ${b.name} (${b.role})`], to: [`One team member: ${a.name}, doing ${[...new Set([...a.does, ...b.does])].join(', ')}`], choices: [[true, 'Yes, same person'], [false, 'No, two people']] })
  }
  const p = read.policies
  f.push({ key: 'terms', title: 'Rules written as plain text', count: 4, from: [old.terms], to: [`${p.cancelHours}h window · ${p.cancelFee}% late fee · ${p.noShowFee}% no-show · late arrivals (${p.lateMinutes} min) in your policy note`], choices: [[true, 'Yes, use these settings'], [false, 'I will set them myself']], ai: read.by === 'ai' })
  if (old.smsCredits || old.sales?.length) f.push({ key: 'stays', title: 'What the new app can’t take', count: 2, sub: 'Idle messages clients on WhatsApp and starts its reports today.', from: [`${(old.smsCredits ?? 0).toLocaleString('en')} SMS credits`, `${old.sales?.length ?? 0} months of sales history`], to: ['SMS credits cannot move', 'Old sales totals are not moved'], choices: [[true, 'OK']] })
  const WHY = {
    vip: 'Slotly has no VIP field, so your team adds a ★ to VIP names.',
    alerts: 'Slotly has no allergy alerts, so your team types them into names and notes.',
    packages: 'Slotly has no packages, so your team writes them in the notes and counts by hand.',
    credit: 'Slotly has no store credit, so your team writes it in the notes.',
    phones: 'Slotly has one phone field, so two numbers get squeezed into it.',
    retail: 'Slotly cannot sell products, so your team made each one a fake service.',
    deposits: 'Slotly has no deposits, so your team types them into the description.',
    cleanup: 'Slotly cannot add clean-up time, so your team books a fake appointment after each colour.',
    breaks: 'Slotly has no breaks, so lunch is booked as a fake appointment.',
    merge: 'The same person was added to Slotly twice.',
    terms: 'Slotly has no cancellation settings, so the rules are just a paragraph of text.',
    stays: 'A few things only exist in Slotly.',
  }
  const BUT = {
    vip: 'But Idle has a VIP tag on every client.',
    alerts: 'But Idle has health alerts that show on every booking.',
    packages: 'But Idle tracks packages: sessions left, counted off by itself, with an expiry date.',
    credit: 'But Idle keeps store credit on each client and uses it at checkout.',
    phones: 'But Idle keeps one clean phone number, with any other number in the notes.',
    retail: 'But Idle sells products, with prices and stock.',
    deposits: 'But Idle takes a deposit % on each service by itself.',
    cleanup: 'But Idle adds buffer time after a service by itself.',
    breaks: "But Idle keeps breaks in each person's working hours.",
    merge: 'But Idle has one profile per person, with everything they do.',
    terms: 'But Idle has real cancellation settings and a policy note.',
    stays: 'But Idle messages clients on WhatsApp and starts its reports today.',
  }
  for (const x of f) {
    x.value = x.choices[0][0]
    x.why = WHY[x.key]
    x.but = BUT[x.key]
  }
  return f
}
