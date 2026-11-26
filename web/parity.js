// Proof: the same entries, made in the old app and the new one, side by side.
// Every rule is tried from both sides on purpose, then random entries look for
// whatever exploring missed. Any disagreement is either a rule Boo missed
// (it goes back and learns it) or a real choice (it asks you).

import { outcome } from './driver.js'
import { addRule } from './spec.js'

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const dmy = d => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`

/** Small seeded random numbers, so a proof run can be repeated exactly. */
export function random(seed) {
  let a = seed >>> 0
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const int = (lo, hi) => lo + Math.floor(next() * (hi - lo + 1))
  return { next, int, pick: list => list[int(0, list.length - 1)], chance: p => next() < p }
}

const FIRST = ['Mei', 'Arjun', 'Siti', 'Wei Ling', 'Daniel', 'Nur', 'Jia Hui', 'Ravi', 'Hannah', 'Farhan', 'Grace', 'Marcus']
const LAST = ['Tan', 'Lim', 'Krishnan', 'Abdullah', 'Ong', 'Fernandez', 'Goh', 'Pereira', 'Teo', 'Rahman', 'Chandrasekaran', 'Wong']
const PETS = ['Biscuit', 'Luna', 'Kopi', 'Momo', 'Teddy', 'Mochi']
const BREEDS = ['Shih Tzu', 'Poodle', 'Golden Retriever', 'British Shorthair', 'Schnauzer']

/**
 * The entries to try. start: rows already in both apps, by screen.
 * Returns [{ screen, values, why }].
 */
export function makeScenarios(spec, start, { seed = 11, randomCount = 40 } = {}) {
  const rnd = random(seed)
  const rulesFor = (screen, field, kind) => spec.rules.find(r => r.screen === screen && r.fields.includes(field) && r.kind === kind)
  let day = new Date(2027, 1, 1)
  const closedDays = new Set(spec.rules.filter(r => r.kind === 'closed').flatMap(r => r.days))
  const openDate = () => {
    do day = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1)
    while (closedDays.has(day.getDay()))
    return dmy(day)
  }
  const optionsOf = f => {
    if (!f.source) return (f.options ?? []).map(o => o.value)
    const src = spec.screens.find(s => s.name === f.source.screen)
    const col = src.columns.indexOf(f.source.column)
    return (start[src.name] ?? []).map(r => r[col])
  }
  const digitsLike = rule => {
    const len = rule?.length ?? 8
    const first = rule?.first ? rnd.pick(rule.first) : rnd.int(1, 9)
    return `${first}${Array.from({ length: len - 1 }, () => rnd.int(0, 9)).join('')}`
  }
  const nameOf = () => `${rnd.pick(FIRST)} ${rnd.pick(LAST)}`

  // One good entry for a screen, with new values everywhere.
  function valid(screen) {
    const values = {}
    for (const f of screen.fields) {
      if (f.kind === 'select') values[f.label] = rnd.pick(optionsOf(f))
      else if (f.kind === 'digits') values[f.label] = digitsLike(rulesFor(screen.name, f.label, 'digits'))
      else if (f.kind === 'date') values[f.label] = f.required ? openDate() : `${String(rnd.int(1, 28)).padStart(2, '0')}/${String(rnd.int(1, 12)).padStart(2, '0')}/${rnd.int(1965, 2004)}`
      else values[f.label] = f.required ? nameOf() : rnd.pick([...PETS, ...BREEDS, 'Nervous with dryers'])
    }
    return values
  }

  const list = []
  const add = (screen, values, why) => list.push({ screen: screen.name, values, why })

  // Every rule from both sides.
  for (const screen of spec.screens) {
    if (!screen.fields.length) continue
    add(screen, valid(screen), `A good ${screen.name.toLowerCase().replace(/s$/, '')}`)
    for (const r of spec.rules.filter(x => x.screen === screen.name)) {
      const field = r.fields[0]
      const v = () => valid(screen)
      if (r.kind === 'required') add(screen, { ...v(), [field]: '' }, `${field} left empty`)
      if (r.kind === 'digits') {
        const good = digitsLike(r)
        add(screen, { ...v(), [field]: good.slice(0, -1) }, `${field} one digit short`)
        const wrongFirst = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].find(d => !(r.first ?? []).includes(d))
        if (r.first) add(screen, { ...v(), [field]: `${wrongFirst}${good.slice(1)}` }, `${field} starting with ${wrongFirst}`)
        if (r.digitsOnly) add(screen, { ...v(), [field]: `${good.slice(0, -2)}xy` }, `${field} with letters`)
      }
      if (r.kind === 'date') add(screen, { ...v(), [field]: '2027-02-10' }, `${field} written year first`)
      if (r.kind === 'closed') {
        let d = new Date(2027, 2, 1)
        while (!r.days.includes(d.getDay())) d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)
        add(screen, { ...v(), [field]: dmy(d) }, `${field} on a ${WEEKDAYS[d.getDay()]}`)
      }
      if (r.kind === 'unique') {
        const row = (start[screen.name] ?? [])[0]
        if (row) add(screen, { ...v(), ...Object.fromEntries(r.fields.map(f => [f, row[screen.columns.indexOf(f)]])) }, `${r.fields.join(' and ')} already taken`)
      }
    }
    const priced = screen.fields.find(f => f.prices)
    if (priced) for (const o of priced.options) add(screen, { ...valid(screen), [priced.label]: o.value }, `A sale of ${o.value}`)
  }

  // Then random entries, any shape at all.
  const screens = spec.screens.filter(s => s.fields.length)
  for (let i = 0; i < randomCount; i++) {
    const screen = rnd.pick(screens)
    const values = valid(screen)
    for (const f of screen.fields) {
      if (f.kind === 'select' && rnd.chance(0.1)) values[f.label] = ''
      if (f.kind === 'digits' && rnd.chance(0.3)) values[f.label] = Array.from({ length: rnd.int(6, 10) }, () => rnd.int(0, 9)).join('')
      if (f.kind === 'date' && rnd.chance(0.2)) values[f.label] = rnd.pick(['2027-03-02', '3/2/2027', '30/02/2027', 'next Tuesday', ''])
      if (f.kind === 'date' && f.required && rnd.chance(0.3)) values[f.label] = dmy(new Date(2027, 2, rnd.int(1, 31)))
      if (f.kind === 'text' && f.required) {
        // Names of every length, including long ones nobody thought to try.
        const len = rnd.chance(0.4) ? rnd.int(24, 44) : rnd.int(0, 22)
        let name = nameOf()
        while (name.length < len) name += ` ${rnd.pick(LAST)}`
        values[f.label] = name.slice(0, len).trim()
      }
      if (f.kind === 'text' && !f.required && rnd.chance(0.4)) values[f.label] = ''
    }
    add(screen, values, 'Random entry')
  }
  return list
}

/** Make one entry in one app. */
export async function enter(drive, sc) {
  if (drive.current() !== sc.screen) await drive.goto(sc.screen)
  if (!drive.fields().length) await drive.openForm()
  await drive.fill(sc.values)
  const status = await drive.submit()
  const code = outcome(status)
  return { code, status, row: code === 'ok' ? drive.rows().at(-1) : null }
}

const tidy = row => (row ?? []).map(c => c.replace(/[$,]/g, '').trim()).join(' | ')

/** Compare the two answers. */
export function compare(spec, sc, a, b) {
  if (a.code === b.code && (a.code !== 'ok' || tidy(a.row) === tidy(b.row))) return { same: true }
  const known = spec.rules.some(r => r.screen === sc.screen && r.code === a.code)
  if (a.code !== 'ok' && b.code === 'ok' && !known) return { same: false, kind: 'missed' }
  const m = spec.money
  if (m && a.code === 'ok' && b.code === 'ok' && sc.screen === m.screen) {
    const screen = spec.screens.find(s => s.name === sc.screen)
    const diffCols = screen.columns.filter((c, i) => tidy([a.row[i]]) !== tidy([b.row[i]]))
    if (diffCols.every(c => Object.values(m.columns).includes(c))) return { same: false, kind: 'money', intended: m.decision === 'fix' }
  }
  return { same: false, kind: 'other' }
}

/** Run every entry in both apps at once. onResult(i, scenario, a, b, verdict). */
export async function prove({ spec, oldDrive, newDrive, scenarios, onResult = () => {}, shouldStop = () => false }) {
  const results = []
  for (let i = 0; i < scenarios.length && !shouldStop(); i++) {
    const sc = scenarios[i]
    const [a, b] = await Promise.all([enter(oldDrive, sc), enter(newDrive, sc)])
    const verdict = compare(spec, sc, a, b)
    results.push({ i, sc, a, b, ...verdict })
    onResult(i, sc, a, b, verdict)
  }
  return results
}

/**
 * The old app refused something the spec does not know about. Find which field
 * did it and where the limit is, by trying the old app again. Adds the rule.
 */
export async function learnMissedRule({ spec, drive, miss, freshUnique }) {
  const screen = spec.screens.find(s => s.name === miss.sc.screen)
  const tryIt = async values => (await enter(drive, { screen: screen.name, values: { ...values, ...freshUnique(screen) } })).code
  const evidence = [`Entry ${miss.i + 1}: old app "${miss.a.status}", new app saved it`]
  for (const f of screen.fields.filter(x => x.kind === 'text' && miss.sc.values[x.label])) {
    const value = miss.sc.values[f.label]
    if ((await tryIt({ ...miss.sc.values, [f.label]: 'Test' })) === miss.a.code) continue
    // This field. Is it a length limit? Plain letters of the same length should fail too.
    if ((await tryIt({ ...miss.sc.values, [f.label]: 'x'.repeat(value.length) })) !== miss.a.code) return null
    // Find the longest that passes.
    let lo = 4
    let hi = value.length
    while (hi - lo > 1) {
      const mid = Math.floor((lo + hi) / 2)
      if ((await tryIt({ ...miss.sc.values, [f.label]: 'x'.repeat(mid) })) === miss.a.code) hi = mid
      else lo = mid
    }
    evidence.push(`${f.label} with ${lo} letters: accepted`, `${f.label} with ${hi} letters: error ${miss.a.code}`)
    const rule = {
      screen: screen.name,
      kind: 'maxLength',
      fields: [f.label],
      code: miss.a.code,
      message: miss.a.status.replace(/^.*?\b(?:error|code)\s*\d{3}\s*:?\s*/i, '').trim(),
      max: lo,
      foundBy: 'random testing',
      evidence,
    }
    addRule(spec, rule)
    return rule
  }
  return null
}
