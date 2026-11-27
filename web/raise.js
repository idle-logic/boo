// Raise anything: any old data, from any software or even paper, read into clean records.
// Files are read in the browser. Only photos and column samples go to Gemini.

import { readName, readPhone, readNotes } from './habits.js'

export const ROW_LIMIT = 500
export const SIZE_LIMIT = 4 * 1024 * 1024

/** CSV or TSV text into rows. Handles quotes, commas and line breaks inside quotes. */
export function parseCsv(text) {
  const src = String(text ?? '').replace(/^﻿/, '')
  const first = src.split(/\r?\n/, 1)[0] ?? ''
  const sep = (first.match(/\t/g) ?? []).length > (first.match(/,/g) ?? []).length ? '\t' : first.includes(';') && !first.includes(',') ? ';' : ','
  const rows = []
  let row = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') (cell += '"'), i++
      else if (ch === '"') quoted = false
      else cell += ch
    } else if (ch === '"' && cell === '') quoted = true
    else if (ch === sep) row.push(cell), (cell = '')
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else cell += ch
  }
  if (cell !== '' || row.length) row.push(cell), rows.push(row)
  return rows.filter(r => r.some(c => c.trim() !== ''))
}

/** Back to CSV, quoting where needed. */
export function toCsv(rows) {
  const q = v => (/[",\n\r]/.test(String(v ?? '')) ? `"${String(v).replace(/"/g, '""')}"` : String(v ?? ''))
  return rows.map(r => r.map(q).join(',')).join('\n') + '\n'
}

/** A first guess at each column from its heading and values, used until Gemini answers (or if it can't). */
export function guessKinds(headers, rows) {
  return headers.map((h, i) => {
    const head = String(h).toLowerCase()
    const vals = rows.slice(0, 20).map(r => String(r[i] ?? '')).filter(Boolean)
    if (/name|client|customer|member|patient|who/.test(head)) return 'name'
    if (/phone|mobile|tel|contact|hp/.test(head)) return 'phone'
    if (/mail/.test(head)) return 'email'
    if (/note|comment|remark|memo|info|detail/.test(head)) return 'note'
    if (/date|visit|last|joined|since|dob/.test(head)) return 'date'
    if (/price|amount|paid|credit|balance|\$|fee|total/.test(head)) return 'money'
    if (vals.length && vals.every(v => /@/.test(v))) return 'email'
    if (vals.length && vals.every(v => /^[+\d][\d\s()/-]{6,}/.test(v))) return 'phone'
    if (vals.length && vals.every(v => /^\d+$/.test(v))) return 'number'
    return i === 0 ? 'name' : 'unknown'
  })
}

/**
 * Rows plus what each column holds, into clean records and a list of what was hidden.
 * Every value comes from a cell; nothing is made up here.
 */
export function raise({ headers, rows: input, kinds }) {
  const col = kind => kinds.map((k, i) => (k === kind ? i : -1)).filter(i => i >= 0)
  const [nameAt] = col('name')
  const [phoneAt] = col('phone')
  const [emailAt] = col('email')
  const noteCols = col('note')
  const otherCols = kinds.map((k, i) => (['unknown', 'category', 'date', 'number', 'money'].includes(k) ? i : -1)).filter(i => i >= 0)
  const found = { vip: [], alert: [], flags: [], phones: [], packages: [], credit: [], unclear: [], crossed: [] }
  // Crossed out on paper means no longer true: leave it out, but say so.
  const rows = input.map(r =>
    r.map(c => {
      const text = String(c ?? '')
      if (!/~~.+?~~/.test(text)) return text
      const kept = text.replace(/\s*~~.+?~~\s*/g, ' ').replace(/\s{2,}/g, ' ').trim()
      found.crossed.push({ from: text.replace(/~~(.+?)~~/g, '$1 (crossed out)'), to: kept })
      return kept
    }),
  )
  const records = rows
    .filter(r => nameAt !== undefined && String(r[nameAt] ?? '').trim())
    .slice(0, ROW_LIMIT)
    .map((r, i) => {
      const rawName = String(r[nameAt] ?? '')
      const n = readName(rawName)
      const p = readPhone(phoneAt !== undefined ? r[phoneAt] : '')
      const notesText = noteCols.map(c => r[c]).filter(Boolean).join(' | ')
      const notes = readNotes([notesText, ...p.others.map(o => `Other number: ${o}`)].filter(Boolean).join(' | '))
      const alert = n.alert || notes.alert
      if (n.vip) found.vip.push({ from: rawName, to: `${n.name} · VIP` })
      if (alert) found.alert.push({ from: n.alert ? rawName : notesText, to: `${n.name} · alert: ${alert}` })
      if (n.flags.length) found.flags.push({ from: rawName, to: `${n.name} · note: ${n.flags.join(', ')}` })
      if (p.others.length) found.phones.push({ from: String(r[phoneAt]), to: `Phone ${p.phone} · the other number goes in the notes` })
      for (const k of notes.packages) found.packages.push({ from: k.from, to: `${n.name} · ${k.name} · ${k.left} of ${k.of} left · paid $${k.paid}`, paid: k.paid })
      if (notes.credit) found.credit.push({ from: notes.creditFrom, to: `${n.name} · store credit $${notes.credit}`, amount: notes.credit })
      for (const u of notes.unclear) found.unclear.push({ row: i, text: u, name: n.name })
      const extra = otherCols.map(c => (r[c] ? `${headers[c]}: ${r[c]}` : '')).filter(Boolean)
      return {
        row: i,
        name: n.name,
        phone: p.phone,
        email: emailAt !== undefined ? String(r[emailAt] ?? '').trim() : '',
        vip: n.vip,
        alert,
        credit: notes.credit,
        packages: notes.packages,
        notes: [notes.notes, ...n.flags, ...extra].filter(Boolean).join(' | '),
      }
    })
  return { records, found }
}

/** What was hidden, as findings like the demo's, in the order people care about. */
export function findingsFromRaise(found) {
  const money = list => list.reduce((a, x) => a + (x.paid ?? x.amount ?? 0), 0)
  const f = []
  if (found.alert.length) f.push({ key: 'alert', title: 'Health alerts hidden in names or notes', count: found.alert.length, ex: found.alert[0] })
  if (found.packages.length) f.push({ key: 'packages', title: 'Prepaid packages hidden in notes', count: found.packages.length, sub: `$${money(found.packages).toLocaleString('en')} prepaid`, ex: found.packages[0] })
  if (found.credit.length) f.push({ key: 'credit', title: 'Credit hidden in notes', count: found.credit.length, sub: `$${money(found.credit).toLocaleString('en')} in total`, ex: found.credit[0] })
  if (found.vip.length) f.push({ key: 'vip', title: 'VIP marks typed into names', count: found.vip.length, ex: found.vip[0] })
  if (found.flags.length) f.push({ key: 'flags', title: 'Warnings typed into names', count: found.flags.length, ex: found.flags[0] })
  if (found.phones.length) f.push({ key: 'phones', title: 'Two numbers in one field', count: found.phones.length, ex: found.phones[0] })
  if (found.crossed.length) f.push({ key: 'crossed', title: 'Crossed out on paper', count: found.crossed.length, ex: found.crossed[0] })
  if (found.unclear.length) f.push({ key: 'unclear', title: 'Notes only AI can read', count: found.unclear.length, ex: { from: found.unclear[0].text, to: 'Gemini reads these next' } })
  return f
}

/** Clean records as one CSV per record type, ready for any new software. */
export function cleanFiles(records) {
  const clients = [['Name', 'Phone', 'Email', 'VIP', 'Alert', 'Store credit', 'Notes'], ...records.map(r => [r.name, r.phone, r.email, r.vip ? 'Yes' : 'No', r.alert, r.credit || '', r.notes])]
  const packages = [['Client', 'Package', 'Sessions left', 'Sessions total', 'Paid'], ...records.flatMap(r => r.packages.map(p => [r.name, p.name, p.left, p.of, p.paid]))]
  return { 'clients.csv': toCsv(clients), 'packages.csv': toCsv(packages) }
}
