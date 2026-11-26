// What Boo learned, written down two ways:
//   1. a spec object the reborn app runs on (screens, fields, rules, money)
//   2. a Kiro spec: requirements.md (EARS), design.md and tasks.md
// Every requirement cites the probe that proved it.

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const noun = screen => screen.toLowerCase().replace(/s$/, '')
const an = word => `${/^[aeiou]/i.test(word) ? 'an' : 'a'} ${word}`
const list = items => (items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`)
const ROUNDING = { down: 'down', up: 'up', nearest: 'to the nearest cent' }

const STORIES = {
  Clients: 'keep a record of every client and their pet',
  Appointments: 'book clients into time slots',
  Invoices: 'charge for services with the right tax',
}

export function buildSpec(findings) {
  const money = findings.money
    ? {
        ...findings.money,
        // Rounding tax down under-collects it. Boo flags that instead of copying it blindly.
        use: findings.money.rounding === 'down' ? 'nearest' : findings.money.rounding,
        decision: findings.money.rounding === 'down' ? 'pending' : null,
      }
    : null
  const spec = {
    source: findings.app,
    name: 'ClinicMaster Reborn',
    probes: findings.probes,
    screens: findings.screens.map(s => ({
      name: s.name,
      columns: s.columns,
      action: s.action.replace(/\.+$/, ''),
      title: s.title,
      success: s.success,
      fields: s.fields.map(f => ({ label: f.label, kind: f.kind, required: f.required, options: f.options, source: f.source ?? null, prices: f.prices ?? null })),
    })),
    rules: [],
    money,
    learned: [],
  }
  findings.rules.forEach(r => addRule(spec, { ...r, foundBy: 'exploring' }))
  return spec
}

/** Add a rule, keeping each screen's checks in the old app's order (by error code). */
export function addRule(spec, rule) {
  spec.rules.push(rule)
  spec.rules.sort((a, b) => spec.screens.findIndex(s => s.name === a.screen) - spec.screens.findIndex(s => s.name === b.screen) || Number(a.code) - Number(b.code))
  if (rule.kind === 'maxLength') spec.learned.push(rule)
  return spec
}

/** One sentence for a rule, in the shape Kiro uses: WHEN ... THEN the system SHALL ... */
export function ears(rule, spec) {
  const f = list(rule.fields)
  const refuse = `THEN the system SHALL refuse it with error ${rule.code} "${rule.message}"`
  switch (rule.kind) {
    case 'required':
      return `WHEN staff save ${an(noun(rule.screen))} without ${f} ${refuse}`
    case 'digits': {
      const shape = [rule.length ? `exactly ${rule.length} digits` : 'digits only', rule.first ? `starting with ${list(rule.first.map(String)).replace(' and ', ' or ')}` : ''].filter(Boolean).join(', ')
      return `WHEN ${f} is not ${shape} ${refuse}`
    }
    case 'date':
      return `WHEN ${f} is given and is not ${rule.realDate ? 'a real calendar date ' : ''}written ${rule.format} ${refuse}`
    case 'closed':
      return `WHEN ${f} falls on a ${list(rule.days.map(d => WEEKDAYS[d]))} ${refuse}`
    case 'unique':
      return `WHEN another ${noun(rule.screen)} already has the same ${f} ${refuse}`
    case 'maxLength':
      return `WHEN ${f} is longer than ${rule.max} characters ${refuse}`
    default:
      return `WHEN ${f} breaks rule ${rule.code} ${refuse}`
  }
}

/** Short hint shown under a field in the new app. */
export function hint(rule) {
  if (rule.kind === 'digits') return [rule.length && `${rule.length} digits`, rule.first && `starts with ${rule.first.join(' or ')}`].filter(Boolean).join(', ')
  if (rule.kind === 'date') return rule.format
  if (rule.kind === 'closed') return `Closed ${rule.days.map(d => WEEKDAYS[d]).join(', ')}`
  if (rule.kind === 'maxLength') return `Up to ${rule.max} letters`
  return ''
}

export function specFiles(spec) {
  return {
    'requirements.md': requirements(spec),
    'design.md': design(spec),
    'tasks.md': tasks(spec),
  }
}

// Requirement numbers, shared by the three files.
function numbering(spec) {
  const out = []
  for (const s of spec.screens) {
    const criteria = spec.rules.filter(r => r.screen === s.name).map(r => ({ text: ears(r, spec), rule: r }))
    criteria.push({ success: true, text: `WHEN every check passes THEN the system SHALL save the ${noun(s.name)}, add it to the ${s.name} list and confirm it${s.success ? ` (the old app said "${s.success}")` : ''}` })
    if (spec.money?.screen === s.name) criteria.push({ text: moneyEars(spec.money), money: true })
    criteria.push({ text: 'WHEN more than one check fails THEN the system SHALL report only the first, in the order of the error codes, like the old app' })
    out.push({ screen: s, criteria })
  }
  return out
}

function moneyEars(m) {
  const how = m.decision === 'keep' ? ROUNDING.down : ROUNDING[m.use]
  const why =
    m.rounding === 'down' && m.decision === 'fix' ? ' (the old app rounded down; the owner chose the nearest cent)'
    : m.rounding === 'down' && m.decision === 'pending' ? ' (the old app rounds down; the owner decides, see Proof)'
    : m.decision === 'keep' ? ' (kept from the old app, as the owner chose)'
    : ''
  return `WHEN ${an(noun(m.screen))} is saved THEN the system SHALL set ${m.columns.subtotal} to the price of the ${m.priceField}, ${m.columns.tax} to ${m.rate}% of it rounded ${how}${why}, and ${m.columns.total} to ${m.columns.subtotal} plus ${m.columns.tax}`
}

function requirements(spec) {
  const lines = [
    '# Requirements Document',
    '',
    '## Introduction',
    '',
    `${spec.name} replaces ${spec.source}, a desktop clinic system from 1998 with no source code and no documentation. Haunt learned these rules by using ${spec.source} the way staff do: ${spec.probes} entries, good and bad, on every screen, reading what the app said back. Nothing here comes from the old code. Each criterion lists the evidence that proved it.`,
    '',
    'Error codes stay the same, so staff who know them are not surprised.',
    '',
    '## Requirements',
    '',
  ]
  numbering(spec).forEach(({ screen, criteria }, i) => {
    lines.push(`### Requirement ${i + 1}: ${screen.name}`, '')
    lines.push(`**User Story:** As front desk staff, I want to ${STORIES[screen.name] ?? `use ${screen.name} the way I did in ${spec.source}`}, so that my day works the same in the new app.`, '')
    lines.push('#### Acceptance Criteria', '')
    criteria.forEach((c, j) => {
      lines.push(`${j + 1}. ${c.text}`)
      const evidence = c.rule?.evidence ?? (c.money ? spec.money.evidence : [])
      if (c.rule?.foundBy && c.rule.foundBy !== 'exploring') lines.push(`   - _Found by ${c.rule.foundBy}._`)
      evidence.slice(0, 4).forEach(e => lines.push(`   - _Evidence:_ ${e}`))
    })
    lines.push('')
  })
  const n = spec.screens.length
  lines.push(`### Requirement ${n + 1}: Moving in`, '')
  lines.push(`**User Story:** As the owner, I want every record from ${spec.source} in the new app, so that I can switch off the old one.`, '')
  lines.push('#### Acceptance Criteria', '')
  lines.push(`1. WHEN the records are moved THEN the system SHALL copy every row of every screen exactly, including past ${spec.money ? `${noun(spec.money.screen)} totals as they were charged` : 'records'}`)
  lines.push('2. WHEN the move finishes THEN the system SHALL show each screen side by side with the old one, row for row', '')
  lines.push(`### Requirement ${n + 2}: Proof`, '')
  lines.push(`**User Story:** As the owner, I want proof the new app behaves like the old one, so that I can trust the switch.`, '')
  lines.push('#### Acceptance Criteria', '')
  lines.push(`1. WHEN the same entry is made in both apps THEN they SHALL give the same error code, or both save the same row`)
  lines.push('2. WHEN the apps disagree THEN the system SHALL show the entry, both answers, and either learn the missing rule or ask the owner')
  if (spec.money?.decision === 'pending') lines.push(`3. IF ${spec.source} rounds tax down THEN the system SHALL ask the owner whether to keep that before switching`)
  lines.push('')
  return lines.join('\n')
}

function design(spec) {
  const lines = [
    '# Design Document',
    '',
    '## Overview',
    '',
    `${spec.name} is a modern app with the same screens and the same checks as ${spec.source}. The checks are data, not code: one ordered list of rules per screen, taken from this spec. When proof testing finds a rule that was missed, it is added to the list and the app follows it at once.`,
    '',
    '## Architecture',
    '',
    '```mermaid',
    'flowchart LR',
    `  old["${spec.source}"] -- "used by ghosts" --> learn[Explore]`,
    '  learn --> spec[This spec]',
    '  spec --> app[New app]',
    `  old -- "same entries" --> proof[Parity proof]`,
    '  app -- "same entries" --> proof',
    '  proof -- "missed rule" --> spec',
    '  proof -- "a choice" --> owner[Owner]',
    '```',
    '',
    '## Data Models',
    '',
  ]
  for (const s of spec.screens) {
    lines.push(`### ${s.name}`, '', '| Column | Kind | Required | Notes |', '| --- | --- | --- | --- |')
    for (const c of s.columns) {
      const f = s.fields.find(x => x.label === c)
      const money = spec.money?.screen === s.name && Object.values(spec.money.columns).includes(c)
      const notes = f?.source ? `one of ${f.source.screen} → ${f.source.column}` : f?.prices ? Object.entries(f.prices).map(([k, v]) => `${k} $${v.toFixed(2)}`).join(', ') : f?.options ? f.options.map(o => o.value).join(', ') : money ? 'worked out, see Money' : ''
      lines.push(`| ${c} | ${f ? f.kind : 'money'} | ${f?.required ? 'yes' : f ? 'no' : '-'} | ${notes} |`)
    }
    lines.push('')
  }
  lines.push('## Checks', '', 'Checked in this order. The first one that fails is the only one reported.', '', '| Screen | Code | Check | Message | Found by |', '| --- | --- | --- | --- | --- |')
  for (const r of spec.rules) lines.push(`| ${r.screen} | ${r.code} | ${r.kind} ${r.fields.join(' + ')}${r.max ? ` > ${r.max}` : ''} | ${r.message} | ${r.foundBy} |`)
  lines.push('')
  if (spec.money) {
    const m = spec.money
    lines.push('## Money', '')
    lines.push(`${m.columns.subtotal} is the price of the ${m.priceField}. ${m.columns.tax} is ${m.rate}% of it. ${m.columns.total} is the sum.`, '')
    lines.push(`${spec.source} rounds tax **${ROUNDING[m.rounding]}**:`, '')
    m.evidence.forEach(e => lines.push(`- ${e}`))
    lines.push('')
    if (m.decision === 'pending') lines.push(`Rounding down collects less tax than is due, so it looks like a bug. The new app rounds to the nearest cent until the owner decides. Past ${noun(m.screen)}s keep the totals they were charged.`, '')
    if (m.decision === 'keep') lines.push('The owner chose to keep rounding down, like the old app.', '')
    if (m.decision === 'fix') lines.push('The owner chose to round to the nearest cent. This is the one intended difference from the old app.', '')
  }
  lines.push('## Correctness Properties', '')
  lines.push(`1. **Same answer.** For any entry on any screen, the new app gives the same error code as ${spec.source}, or both save the same row.`)
  lines.push(`2. **First problem only.** For any entry that breaks several checks, the reported code is the lowest one that fails.`)
  if (spec.money) lines.push(`3. **Sums add up.** For any ${noun(spec.money.screen)}, ${spec.money.columns.total} = ${spec.money.columns.subtotal} + ${spec.money.columns.tax}.`)
  lines.push(`${spec.money ? 4 : 3}. **Nothing lost moving in.** Every row read from ${spec.source} appears unchanged in the new app.`, '')
  lines.push('## Testing Strategy', '')
  lines.push(`Property-based parity testing: generate random entries (names of any length, numbers of any shape, dates in any format, any slot), make each one in both apps, and compare the answers. Every rule above is also tested from both sides on purpose.`, '')
  return lines.join('\n')
}

function tasks(spec) {
  const reqs = numbering(spec)
  const lines = ['# Implementation Plan', '']
  let t = 1
  lines.push(`- [ ] ${t++}. Set up the data model`)
  for (const s of spec.screens) lines.push(`  - ${s.name}: ${s.columns.join(', ')}`)
  lines.push(`  - _Requirements: ${reqs.map((_, i) => i + 1).join(', ')}_`, '')
  reqs.forEach(({ screen, criteria }, i) => {
    const n = t++
    lines.push(`- [ ] ${n}. Build the ${screen.name} screen`)
    lines.push(`  - [ ] ${n}.1 List and "${screen.action}" form with ${list(screen.fields.map(f => f.label))}`)
    lines.push(`    - _Requirements: ${i + 1}.${criteria.findIndex(c => c.success) + 1}_`)
    const rules = spec.rules.filter(r => r.screen === screen.name)
    if (rules.length) {
      lines.push(`  - [ ] ${n}.2 Checks in order: ${rules.map(r => `${r.code} ${r.kind} ${r.fields.join(' + ')}`).join('; ')}`)
      lines.push(`    - _Requirements: ${rules.map(r => `${i + 1}.${criteria.findIndex(c => c.rule === r) + 1}`).join(', ')}_`)
    }
    if (spec.money?.screen === screen.name) {
      lines.push(`  - [ ] ${n}.3 Work out ${spec.money.columns.subtotal}, ${spec.money.columns.tax} (${spec.money.rate}%) and ${spec.money.columns.total}`)
      lines.push(`    - _Requirements: ${i + 1}.${criteria.findIndex(c => c.money) + 1}_`)
    }
    lines.push(`  - [ ]* ${n}.${spec.money?.screen === screen.name ? 4 : 3} Write property test: any ${noun(screen.name)} entry gets the same answer as ${spec.source}`)
    lines.push(`    - _Requirements: ${i + 1}.1-${i + 1}.${criteria.length}_`, '')
  })
  lines.push(`- [ ] ${t++}. Move the records in`)
  lines.push(`  - Copy every row of every screen, keeping past totals as charged`)
  lines.push(`  - Show both apps side by side, row for row`)
  lines.push(`  - _Requirements: ${reqs.length + 1}.1, ${reqs.length + 1}.2_`, '')
  lines.push(`- [ ] ${t++}. Prove parity against ${spec.source}`)
  lines.push(`  - Run every rule from both sides, then random entries, in both apps`)
  lines.push(`  - Add any rule the old app enforces that this spec missed`)
  lines.push(`  - _Requirements: ${reqs.length + 2}.1, ${reqs.length + 2}.2_`, '')
  if (spec.money?.decision === 'pending') {
    lines.push(`- [ ] ${t++}. Ask the owner about tax rounding`)
    lines.push(`  - ${spec.source} rounds down; keep it or round to the nearest cent`)
    lines.push(`  - _Requirements: ${reqs.length + 2}.3_`, '')
  }
  return lines.join('\n')
}
