// Possession: a ghost learns how an old app works by using it, like a new
// member of staff poking at every screen. It never reads the app's code.
//
// For each screen it reads the table and the form, then tries good and bad
// entries and watches what the app says back:
//   leave each field empty        -> which fields are required
//   wrong number shapes           -> exact length, allowed first digits
//   wrong date shapes             -> the date format, real dates only
//   repeat existing values        -> what must be unique, alone or in pairs
//   every day of one week         -> days the business is closed
//   one sale of every service     -> the tax rate and how it is rounded
//
// It does not guess limits on free text, so a hidden length limit slips past.
// Random parity testing catches what this misses.

import { outcome } from './driver.js'

const DATE = /^\d{2}\/\d{2}\/\d{4}$/
const DIGITS = /^\d+$/
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
export const PRICE = /\$\s?([\d,]+\.\d{2})/

const dmy = d => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
const cents = text => Math.round(Number(String(text).replace(/[$,\s]/g, '')) * 100)
const messageOf = status => status.replace(/^.*?\b(?:error|code)\s*\d{3}\s*:?\s*/i, '').trim()

/** Find a column, on any screen, whose values match a drop-down's options. */
function sourceOf(options, screens) {
  const want = new Set(options.map(o => o.value))
  for (const s of screens) {
    for (let c = 0; c < s.columns.length; c++) {
      const have = new Set(s.rows.map(r => r[c]))
      if (have.size && have.size === want.size && [...want].every(v => have.has(v))) return { screen: s.name, column: s.columns[c] }
    }
  }
  return null
}

export async function explore(drive, { say = () => {}, progress = () => {}, firstSlow = () => {} } = {}) {
  const findings = { app: 'ClinicMaster 98', probes: 0, screens: [], rules: [], money: null }
  const rule = r => {
    findings.rules.push(r)
    progress({ probes: findings.probes, rules: findings.rules.length, rule: r })
  }

  // ---------------------------------------------------------------- map every screen
  for (const name of drive.screens()) {
    await drive.goto(name)
    const columns = drive.columns()
    const rows = drive.rows()
    const action = drive.formButton()
    const fields = await drive.openForm()
    const title = drive.formTitle()
    await drive.cancel()
    findings.screens.push({ name, columns, rows, action, title, fields: fields ?? [] })
    say(`${name}: ${rows.length} rows, a form with ${fields?.length ?? 0} fields.`)
  }

  // What each field holds, from the values already in the tables.
  for (const screen of findings.screens) {
    for (const f of screen.fields) {
      const examples = findings.screens.flatMap(s => {
        const c = s.columns.findIndex(col => col.toLowerCase() === f.label.toLowerCase())
        return c < 0 ? [] : s.rows.map(r => r[c]).filter(Boolean)
      })
      f.examples = [...new Set(examples)]
      if (f.kind === 'select') {
        f.source = sourceOf(f.options, findings.screens)
        if (f.options.every(o => PRICE.test(o.text))) f.prices = Object.fromEntries(f.options.map(o => [o.value, cents(PRICE.exec(o.text)[1]) / 100]))
      } else if (f.examples.length && f.examples.every(v => DATE.test(v))) f.kind = 'date'
      else if (f.examples.length && f.examples.every(v => DIGITS.test(v))) f.kind = 'digits'
      f.required = false
    }
  }

  // ---------------------------------------------------------------- probe each form
  let n = 0
  let day = new Date(2026, 11, 14) // a Monday a few weeks out, away from real bookings
  const closed = new Set()
  const nextDate = () => {
    do day = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1)
    while (closed.has(day.getDay()))
    return dmy(day)
  }
  const fresh = f => {
    n++
    // Different picks each time, so test entries never trip over each other.
    if (f.kind === 'select') return f.options[n % f.options.length]?.value ?? ''
    if (f.kind === 'digits') {
      const ex = f.examples[0]
      return ex.slice(0, -3) + String(500 + n).padStart(3, '0')
    }
    if (f.kind === 'date') return nextDate()
    return `Test ${f.label.toLowerCase()} ${n}`
  }

  for (const screen of findings.screens) {
    if (!screen.fields.length) continue
    const valid = () => Object.fromEntries(screen.fields.map(f => [f.label, fresh(f)]))
    let slow = findings.probes === 0

    async function probe(values) {
      if (drive.current() !== screen.name) await drive.goto(screen.name)
      if (!drive.fields().length) await drive.openForm()
      if (slow) firstSlow(true)
      await drive.fill(values, { show: slow })
      const status = await drive.submit()
      if (slow) firstSlow(false)
      slow = false
      findings.probes++
      progress({ probes: findings.probes, rules: findings.rules.length })
      return { code: outcome(status), status, row: outcome(status) === 'ok' ? drive.rows().at(-1) : null }
    }
    const fieldsOf = kind => screen.fields.filter(f => f.kind === kind)

    say(`Trying the ${screen.title || screen.name} form.`)
    const base = await probe(valid())
    screen.success = base.code === 'ok' ? base.status : null

    // Required fields: leave one empty at a time.
    for (const f of screen.fields) {
      const v = valid()
      v[f.label] = ''
      const r = await probe(v)
      if (r.code !== 'ok') {
        f.required = true
        rule({ screen: screen.name, kind: 'required', fields: [f.label], code: r.code, message: messageOf(r.status), evidence: [`Left ${f.label} empty: "${r.status}"`] })
      }
    }

    // Number shapes: length, first digit, letters.
    for (const f of fieldsOf('digits')) {
      const tries = []
      const attempt = async (value, label) => {
        const v = valid()
        v[f.label] = value
        const r = await probe(v)
        tries.push({ value, label, ...r })
        return r
      }
      const sample = fresh(f)
      const shorter = await attempt(fresh(f).slice(0, -1), 'one digit short')
      const longer = await attempt(`${fresh(f)}0`, 'one digit long')
      const letters = await attempt(`${fresh(f).slice(0, -2)}ab`, 'letters')
      const first = []
      for (let d = 0; d <= 9; d++) {
        const r = await attempt(`${d}${fresh(f).slice(1)}`, `starts with ${d}`)
        if (r.code === 'ok') first.push(d)
      }
      const bad = tries.find(t => t.code !== 'ok')
      if (bad) {
        rule({
          screen: screen.name,
          kind: 'digits',
          fields: [f.label],
          code: bad.code,
          message: messageOf(bad.status),
          length: shorter.code !== 'ok' && longer.code !== 'ok' ? sample.length : null,
          first: first.length && first.length < 10 ? first : null,
          digitsOnly: letters.code !== 'ok',
          evidence: tries.map(t => `${t.value} (${t.label}): ${t.code === 'ok' ? 'accepted' : `error ${t.code}`}`),
        })
      }
    }

    // Date shapes.
    for (const f of fieldsOf('date')) {
      const tries = []
      for (const [value, label] of [
        ['2026-12-15', 'year first'],
        ['15/12/26', 'short year'],
        ['31/02/2027', 'a day that does not exist'],
      ]) {
        const v = valid()
        v[f.label] = value
        const r = await probe(v)
        tries.push({ value, label, ...r })
      }
      const bad = tries.find(t => t.code !== 'ok')
      if (bad) {
        rule({
          screen: screen.name,
          kind: 'date',
          fields: [f.label],
          code: bad.code,
          message: messageOf(bad.status),
          format: 'DD/MM/YYYY',
          realDate: tries[2].code !== 'ok',
          evidence: tries.map(t => `${t.value} (${t.label}): ${t.code === 'ok' ? 'accepted' : `error ${t.code}`}`),
        })
      }

      // A whole week, to find closed days. Only for dates that are bookings, not birthdays.
      if (!f.required) continue
      const week = []
      const start = new Date(2027, 0, 4) // Monday
      for (let i = 0; i < 7; i++) {
        const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)
        const v = valid()
        v[f.label] = dmy(d)
        const r = await probe(v)
        week.push({ day: d.getDay(), value: dmy(d), ...r })
      }
      const shut = week.filter(w => w.code !== 'ok')
      if (shut.length && shut.length < 7 && new Set(shut.map(s => s.code)).size === 1) {
        shut.forEach(s => closed.add(s.day))
        rule({
          screen: screen.name,
          kind: 'closed',
          fields: [f.label],
          code: shut[0].code,
          message: messageOf(shut[0].status),
          days: shut.map(s => s.day),
          evidence: [
            ...shut.map(w => `${WEEKDAYS[w.day]} ${w.value}: "${w.status}"`),
            `${week.filter(w => w.code === 'ok').map(w => WEEKDAYS[w.day]).join(', ')} of the same week: accepted`,
          ],
        })
      }
    }

    // Uniqueness: repeat a value that is already on file, one field at a time, then in pairs.
    const known = screen.fields.filter(f => f.examples.length)
    let single = false
    for (const f of known) {
      const v = valid()
      v[f.label] = f.examples[0]
      const r = await probe(v)
      if (r.code === 'ok' || findings.rules.some(x => x.screen === screen.name && x.code === r.code && x.kind !== 'unique')) continue
      // Again with every other field changed, so a clash with an earlier test entry is not mistaken for a rule.
      const again = await probe({ ...valid(), [f.label]: f.examples[0] })
      if (again.code !== r.code) continue
      single = true
      rule({ screen: screen.name, kind: 'unique', fields: [f.label], code: r.code, message: messageOf(r.status), evidence: [`Used ${f.label} ${f.examples[0]}, already on file: "${r.status}"`, 'The same again, everything else changed: refused again'] })
    }
    if (!single) {
      const rowsHere = screen.rows
      for (let a = 0; a < known.length; a++) {
        for (let b = a + 1; b < known.length; b++) {
          const ca = screen.columns.indexOf(known[a].label)
          const cb = screen.columns.indexOf(known[b].label)
          if (ca < 0 || cb < 0 || !rowsHere.length) continue
          const v = valid()
          v[known[a].label] = rowsHere[0][ca]
          v[known[b].label] = rowsHere[0][cb]
          const r = await probe(v)
          // Check it again with every other field changed, so an earlier test entry is not the cause.
          const again = r.code === 'ok' ? r : await probe({ ...valid(), [known[a].label]: v[known[a].label], [known[b].label]: v[known[b].label] })
          if (r.code !== 'ok' && again.code === r.code) {
            rule({
              screen: screen.name,
              kind: 'unique',
              fields: [known[a].label, known[b].label],
              code: r.code,
              message: messageOf(r.status),
              evidence: [`${known[a].label} ${rowsHere[0][ca]} with ${known[b].label} ${rowsHere[0][cb]}, already on file: "${r.status}"`, 'The same pair again, everything else changed: refused again', 'Each one alone with new values: accepted'],
            })
          }
        }
      }
    }

    // Money: one sale of every priced option, then work out the sums.
    const priced = screen.fields.find(f => f.prices)
    if (priced) {
      const samples = []
      for (const opt of priced.options) {
        const v = valid()
        v[priced.label] = opt.value
        const r = await probe(v)
        if (r.code !== 'ok') continue
        const extra = Object.fromEntries(screen.columns.map((c, i) => [c, r.row[i]]).filter(([c]) => !screen.fields.some(f => f.label === c)))
        samples.push({ option: opt.value, price: cents(priced.prices[opt.value]), extra })
      }
      findings.money = inferMoney(screen.name, priced.label, samples)
      if (findings.money) say(`Tax is ${findings.money.rate}%, rounded ${findings.money.rounding === 'down' ? 'down' : findings.money.rounding === 'up' ? 'up' : 'to the nearest cent'}.`)
    }
  }
  return findings
}

/**
 * Work out what the money columns mean from real sales.
 * samples: [{ option, price (cents), extra: { Column: '12.34' } }]
 */
export function inferMoney(screen, priceField, samples) {
  if (!samples.length) return null
  const columns = Object.keys(samples[0].extra)
  const value = (s, c) => cents(s.extra[c])
  const subtotal = columns.find(c => samples.every(s => value(s, c) === s.price))
  const rest = columns.filter(c => c !== subtotal)
  const total = rest.find(c => rest.some(t => t !== c && samples.every(s => value(s, c) === s.price + value(s, t))))
  const tax = rest.find(c => c !== total)
  if (!subtotal || !tax) return null
  const rate = Math.round((samples.reduce((a, s) => a + value(s, tax) / s.price, 0) / samples.length) * 100)
  const ways = {
    nearest: x => Math.round(x),
    down: x => Math.floor(x + 1e-9),
    up: x => Math.ceil(x - 1e-9),
  }
  const fits = Object.keys(ways).filter(w => samples.every(s => ways[w]((s.price * rate) / 100) === value(s, tax)))
  const rounding = fits.length === 1 ? fits[0] : fits.includes('nearest') ? 'nearest' : fits[0] ?? 'unknown'
  return {
    screen,
    priceField,
    columns: { subtotal, tax, total },
    rate,
    rounding,
    evidence: samples.map(s => {
      const exact = ((s.price * rate) / 100 / 100).toFixed(4)
      return `${s.option}: ${(s.price / 100).toFixed(2)} × ${rate}% = ${exact}, app shows ${s.extra[tax]}`
    }),
  }
}
