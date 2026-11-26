// The switch plan: how what Haunt read in the old software becomes records in
// Idle. The AI reads the parts that need judgement (category names, health
// notes, people entered twice). Every AI answer is checked before it is used,
// and plain rules stand in when the AI is unavailable, so the switch never stalls.

export const IDLE_CATEGORIES = ['Cuts', 'Styling', 'Colour', 'Treatments', 'Brows']

const KEYWORDS = [
  ['Cuts', /cut|trim|barber/i],
  ['Styling', /styl|blow|updo|bridal/i],
  ['Colour', /colou?r|tint|balayage|highlight|toner/i],
  ['Treatments', /treat|keratin|scalp|mask/i],
  ['Brows', /brow|lash/i],
]
const HEALTH = /allerg|pregnan|asthma|latex|eczema|sensitive|patch test|medical|epilep|diabet/i

/** What the AI is asked about. Small and free of anything it does not need. */
export function planRequest(learned) {
  return {
    categories: [...new Set(learned.services.map(s => s.category))],
    idleCategories: IDLE_CATEGORIES,
    notes: learned.clients.map((c, i) => ({ i, text: c.notes })).filter(n => n.text),
    staff: learned.staff.map((s, i) => ({ i, name: s.name, phone: s.phone, role: s.role })),
  }
}

/** Plain-rule answers, used when the AI is unavailable and to fill any gaps. */
export function rulePlan(req) {
  const categories = Object.fromEntries(req.categories.map(c => [c, KEYWORDS.find(([, re]) => re.test(c))?.[0] ?? null]))
  const alerts = req.notes.filter(n => HEALTH.test(n.text)).map(n => ({ i: n.i, alert: n.text.split(/[.,]/)[0].slice(0, 60) }))
  const sameStaff = []
  req.staff.forEach((a, i) => req.staff.slice(i + 1).forEach(b => a.phone && a.phone === b.phone && sameStaff.push([a.i, b.i])))
  return { categories, alerts, sameStaff, by: 'rules' }
}

/** Keep only answers that fit what was asked. Anything missing comes from the rules. */
export function checkPlan(req, ai) {
  const rules = rulePlan(req)
  if (!ai || typeof ai !== 'object') return rules
  const categories = { ...rules.categories }
  for (const [src, dest] of Object.entries(ai.categories ?? {})) {
    if (req.categories.includes(src) && IDLE_CATEGORIES.includes(dest)) categories[src] = dest
  }
  const noteIds = new Set(req.notes.map(n => n.i))
  const alerts = (Array.isArray(ai.alerts) ? ai.alerts : [])
    .filter(a => noteIds.has(a?.i) && typeof a.alert === 'string' && a.alert.trim())
    .map(a => ({ i: a.i, alert: a.alert.trim().slice(0, 60) }))
  const staffIds = new Set(req.staff.map(s => s.i))
  const sameStaff = (Array.isArray(ai.sameStaff) ? ai.sameStaff : []).filter(p => Array.isArray(p) && p.length === 2 && p.every(i => staffIds.has(i)) && p[0] !== p[1])
  return {
    categories,
    alerts: alerts.length ? alerts : rules.alerts,
    sameStaff: sameStaff.length ? sameStaff : rules.sameStaff,
    by: 'ai',
  }
}

/** Ask the AI, with a time limit. Falls back to the rules on any problem. */
export async function makePlan(learned, { endpoint = '/api/plan', timeoutMs = 12000 } = {}) {
  const req = planRequest(learned)
  // The free AI tier is sometimes busy for a moment, so try twice.
  for (const wait of [0, 1500]) {
    if (wait) await new Promise(r => setTimeout(r, wait))
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(req),
        signal: AbortSignal.timeout(timeoutMs),
      })
      if (res.ok) return { req, plan: checkPlan(req, await res.json()) }
      if (res.status !== 503 && res.status !== 429) break
    } catch {
      // Try again, then fall back.
    }
  }
  return { req, plan: rulePlan(req) }
}

/** Turn what was read into the values each Idle form takes. */
export function idleRecords(learned, plan, { merge = true } = {}) {
  const cat = c => plan.categories[c] ?? 'Cuts'
  const alertFor = new Map(plan.alerts.map(a => [a.i, a.alert]))
  const dropped = new Map() // duplicate staff name -> the name they merge into
  if (merge) for (const [a, b] of plan.sameStaff) dropped.set(learned.staff[b].name, learned.staff[a].name)
  const staff = learned.staff
    .filter(s => !dropped.has(s.name))
    .map(s => {
      const twins = learned.staff.filter(t => dropped.get(t.name) === s.name)
      const does = [...new Set([s, ...twins].flatMap(x => x.does).map(cat))]
      return { Name: s.name, Role: s.role, Phone: s.phone, Does: does }
    })
  return {
    services: learned.services.map(s => ({
      Name: s.name,
      Category: cat(s.category),
      'Duration (min)': String(s.minutes),
      'Buffer after (min)': s.cleanup === undefined ? '0' : String(s.cleanup),
      Price: String(s.price),
      'Deposit (%)': String(s.deposit),
    })),
    staff,
    clients: learned.clients.map((c, i) => ({
      Name: c.name,
      Phone: c.phone,
      Email: c.email,
      VIP: c.vip ? 'Yes' : 'No',
      Visits: String(c.visits ?? ''),
      'Last visit': c.lastVisit ?? '',
      'Store credit': c.credit ? String(c.credit) : '',
      Alert: alertFor.get(i) ?? '',
      Notes: c.notes,
    })),
    products: (learned.products ?? []).map(x => ({ Name: x.name, SKU: x.sku, Price: String(x.price), 'In stock': String(x.stock) })),
    packages: learned.clients.flatMap(c => c.packages.map(p => ({ Client: c.name, Package: p.name, 'Sessions left': String(p.left), 'Sessions total': String(p.of), Paid: String(p.paid) }))),
    bookings: learned.bookings.map(b => ({ Client: b.client, Service: b.service, 'Team member': dropped.get(b.staff) ?? b.staff, Date: b.date, Time: b.time })),
    policies: {
      'Late cancellation window (hours)': String(learned.policies.cancelHours),
      'Late cancellation fee (%)': String(learned.policies.cancelFee),
      'No-show fee (%)': String(learned.policies.noShowFee),
      'Late arrival grace (min)': String(learned.policies.lateMinutes),
    },
  }
}
