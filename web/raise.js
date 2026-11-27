// Raise anything: any old data, from any software or even paper, read into clean records.
// Files are read in the browser. Only photos and column samples go to Gemini.

import { readName, readPhone, readNotes, readItemName, readPrice, readMinutes } from './habits.js'

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
/** Where raised records go in the new app. */
export const TARGETS = {
  clients: { label: 'Clients', one: 'client', page: 'clients', form: 'client', list: 'clients' },
  services: { label: 'Services', one: 'service', page: 'services', form: 'service', list: 'services' },
  products: { label: 'Products', one: 'item', page: 'products', form: 'product', list: 'products' },
  team: { label: 'Team', one: 'team member', page: 'team', form: 'staff', list: 'staff' },
}

/** A first guess at what the rows are, from the headings and values, until Gemini says (or if it can't). */
export function guessTarget(headers, rows = []) {
  const h = headers.join(' ').toLowerCase()
  const has = re => re.test(h)
  if (has(/\b(role|position|job title|shift|staff|employee|stylist|therapist)\b/) && !has(/client|customer|member|patient/)) return 'team'
  if (has(/\b(duration|mins?|minutes|treatment|service)\b/) && has(/price|\$|cost|fee/)) return 'services'
  if (has(/\b(menu|dish|item|product|sku|stock|qty|quantity|price)\b/) && !has(/phone|mobile|email|mail/)) return 'products'
  const vals = rows.slice(0, 10).flat().join(' ')
  if (!has(/phone|mobile|email|mail|client|customer|member|patient/) && /\$\s?\d/.test(vals)) return 'products'
  return 'clients'
}

export function guessKinds(headers, rows) {
  let named = false
  return headers
    .map((h, i) => {
      const head = String(h).toLowerCase().trim()
      const vals = rows.slice(0, 20).map(r => String(r[i] ?? '')).filter(Boolean)
      // Specific before general: "Customer Email" is an email, "Customer ID" is an id, not a name.
      if (/mail/.test(head)) return 'email'
      if (/phone|mobile|\btel\b|contact no|\bhp\b/.test(head)) return 'phone'
      if (/\bsku\b|barcode|\bcode\b/.test(head)) return 'sku'
      if (/\bid\b|_id\b|\bref\b|number$|no\.?$/.test(head)) return 'unknown'
      if (!named && (/\bname\b|\bitem\b|\bdish\b|\bproduct\b|\bservice\b|\btreatment\b/.test(head) || /^(client|customer|member|patient|who|guest|student|owner|staff|employee)$/.test(head))) return (named = true), 'name'
      if (/role|position|job|title$/.test(head)) return 'role'
      if (/duration|\bmins?\b|minutes|length|how long/.test(head)) return 'duration'
      if (/stock|qty|quantity|on hand|inventory/.test(head)) return 'stock'
      if (/note|comment|remark|memo|detail|description|desc\b/.test(head)) return 'note'
      if (/date|visit|last|joined|since|dob|created|updated/.test(head)) return 'date'
      if (/price|amount|paid|credit|balance|\$|fee|total|net|cost/.test(head)) return 'money'
      if (/categor|type|section|group|course/.test(head)) return 'category'
      if (vals.length && vals.every(v => /@/.test(v))) return 'email'
      if (vals.length && vals.every(v => /^[+\d][\d\s()/-]{6,}$/.test(v))) return 'phone'
      if (vals.length && vals.every(v => /^\s*[A-Z]{0,3}\$\s?\d/.test(v))) return 'money'
      if (vals.length && vals.every(v => /^-?[\d.,]+$/.test(v))) return 'number'
      return 'unknown'
    })
    .map((k, i, all) => (i === 0 && !all.includes('name') && k === 'unknown' ? 'name' : k))
}

/**
 * Rows plus what each column holds, into clean records of the target kind and a list of what was hidden.
 * Every value comes from a cell; nothing is made up here.
 */
export function raise({ headers, rows: input, kinds, target = 'clients' }) {
  const col = kind => kinds.map((k, i) => (k === kind ? i : -1)).filter(i => i >= 0)
  const [nameAt] = col('name')
  const found = { crossed: [], unclear: [] }
  const add = (key, item) => (found[key] ??= []).push(item)
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
  const named = rows.filter(r => nameAt !== undefined && String(r[nameAt] ?? '').trim()).slice(0, ROW_LIMIT)
  const noteText = r => col('note').map(c => r[c]).filter(Boolean).join(' | ')
  const leftover = r => kinds.map((k, c) => (['unknown', 'date', 'number'].includes(k) && r[c] ? `${headers[c]}: ${r[c]}` : '')).filter(Boolean)
  const records = named.map((r, i) => {
    if (target === 'products' || target === 'services') {
      const rawName = String(r[nameAt])
      const it = readItemName(rawName)
      const [priceAt] = col('money')
      const price = readPrice(priceAt !== undefined ? r[priceAt] : '')
      const [minAt] = col('duration')
      const [catAt] = col('category')
      const [stockAt] = col('stock')
      const [skuAt] = col('sku')
      if (it.featured) add('featured', { from: rawName, to: `${it.name} · Featured` })
      if (it.allergens.length) add('allergens', { from: rawName, to: `${it.name} · allergens: ${it.allergens.join(', ')}` })
      if (it.tags.length) add('tags', { from: rawName, to: `${it.name} · tags: ${it.tags.join(', ')}` })
      if (it.soldOut) add('soldOut', { from: rawName, to: `${it.name} · stock 0` })
      if (price.extra) add('prices', { from: String(r[priceAt]), to: `${it.name} · $${price.price} · the rest in notes` })
      for (const u of readNotes(noteText(r)).unclear) found.unclear.push({ row: i, text: u, name: it.name })
      return {
        row: i,
        name: it.name,
        price: price.price,
        minutes: minAt !== undefined ? readMinutes(r[minAt]) : '',
        category: catAt !== undefined ? String(r[catAt] ?? '').trim() : '',
        stock: it.soldOut ? 0 : stockAt !== undefined ? String(r[stockAt] ?? '').trim() : '',
        sku: skuAt !== undefined ? String(r[skuAt] ?? '').trim() : '',
        featured: it.featured,
        tags: it.tags,
        allergens: it.allergens,
        notes: [noteText(r), price.extra && `Price as written: ${price.extra}`, ...leftover(r)].filter(Boolean).join(' | '),
      }
    }
    if (target === 'team') {
      const rawName = String(r[nameAt])
      const n = readName(rawName)
      const [phoneAt] = col('phone')
      const [roleAt] = col('role')
      const p = readPhone(phoneAt !== undefined ? r[phoneAt] : '')
      if (n.flags.length) add('flags', { from: rawName, to: `${n.name} · role: ${n.flags.join(', ')}` })
      if (p.others.length) add('phones', { from: String(r[phoneAt]), to: `Phone ${p.phone}` })
      return { row: i, name: n.name, phone: p.phone, role: [roleAt !== undefined ? String(r[roleAt] ?? '').trim() : '', ...n.flags].filter(Boolean).join(', '), notes: [noteText(r), ...p.others.map(o => `Other number: ${o}`), ...leftover(r)].filter(Boolean).join(' | ') }
    }
    // Clients: people.
    const [phoneAt] = col('phone')
    const [emailAt] = col('email')
    const rawName = String(r[nameAt] ?? '')
    const n = readName(rawName)
    const p = readPhone(phoneAt !== undefined ? r[phoneAt] : '')
    const notesText = noteText(r)
    const notes = readNotes([notesText, ...p.others.map(o => `Other number: ${o}`)].filter(Boolean).join(' | '))
    const alert = n.alert || notes.alert
    if (n.vip) add('vip', { from: rawName, to: `${n.name} · VIP` })
    if (alert) add('alert', { from: n.alert ? rawName : notesText, to: `${n.name} · alert: ${alert}` })
    if (n.flags.length) add('flags', { from: rawName, to: `${n.name} · note: ${n.flags.join(', ')}` })
    if (p.others.length) add('phones', { from: String(r[phoneAt]), to: `Phone ${p.phone} · the other number goes in the notes` })
    for (const k of notes.packages) add('packages', { from: k.from, to: `${n.name} · ${k.name} · ${k.left} of ${k.of} left · paid $${k.paid}`, paid: k.paid })
    if (notes.credit) add('credit', { from: notes.creditFrom, to: `${n.name} · store credit $${notes.credit}`, amount: notes.credit })
    for (const u of notes.unclear) found.unclear.push({ row: i, text: u, name: n.name })
    const extra = kinds.map((k, c) => (['unknown', 'category', 'date', 'number', 'money'].includes(k) && r[c] ? `${headers[c]}: ${r[c]}` : '')).filter(Boolean)
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
  for (const k of ['vip', 'alert', 'flags', 'phones', 'packages', 'credit', 'featured', 'allergens', 'tags', 'soldOut', 'prices']) found[k] ??= []
  return { records, found }
}

/** What was hidden, as findings like the demo's, in the order people care about. */
export function findingsFromRaise(found) {
  const money = list => list.reduce((a, x) => a + (x.paid ?? x.amount ?? 0), 0)
  const f = []
  const push = (key, title, sub = '') => found[key]?.length && f.push({ key, title, count: found[key].length, sub, ex: found[key][0] })
  push('alert', 'Health alerts hidden in names or notes')
  push('allergens', 'Allergens typed into names')
  push('packages', 'Prepaid packages hidden in notes', found.packages?.length ? `$${money(found.packages).toLocaleString('en')} prepaid` : '')
  push('credit', 'Credit hidden in notes', found.credit?.length ? `$${money(found.credit).toLocaleString('en')} in total` : '')
  push('vip', 'VIP marks typed into names')
  push('featured', "★ and \"chef's pick\" typed into names")
  push('soldOut', '"Sold out" typed into names')
  push('tags', 'Labels like (V) or (SPICY) typed into names')
  push('prices', 'Prices with words in them')
  push('flags', 'Warnings typed into names')
  push('phones', 'Two numbers in one field')
  push('crossed', 'Crossed out on paper')
  if (found.unclear?.length) f.push({ key: 'unclear', title: 'Notes only AI can read', count: found.unclear.length, ex: { from: found.unclear[0].text, to: 'Gemini reads these next' } })
  return f
}

/** Clean records as CSV files for the target kind, ready for any new software. */
export function cleanFiles(records, target = 'clients') {
  if (target === 'products' || target === 'services') {
    const head = ['Name', 'Price', ...(target === 'services' ? ['Minutes'] : ['Stock', 'SKU']), 'Category', 'Featured', 'Tags', 'Allergens', 'Notes']
    const rows = records.map(r => [r.name, r.price, ...(target === 'services' ? [r.minutes] : [r.stock, r.sku]), r.category, r.featured ? 'Yes' : 'No', r.tags.join(', '), r.allergens.join(', '), r.notes])
    return { [`${target}.csv`]: toCsv([head, ...rows]) }
  }
  if (target === 'team') return { 'team.csv': toCsv([['Name', 'Role', 'Phone', 'Notes'], ...records.map(r => [r.name, r.role, r.phone, r.notes])]) }
  const clients = [['Name', 'Phone', 'Email', 'VIP', 'Alert', 'Store credit', 'Notes'], ...records.map(r => [r.name, r.phone, r.email, r.vip ? 'Yes' : 'No', r.alert, r.credit || '', r.notes])]
  const packages = [['Client', 'Package', 'Sessions left', 'Sessions total', 'Paid'], ...records.flatMap(r => r.packages.map(p => [r.name, p.name, p.left, p.of, p.paid]))]
  return { 'clients.csv': toCsv(clients), 'packages.csv': toCsv(packages) }
}

/** The new app's records for raised data, by target, in the shape the app stores. */
export function newAppRecords(records, target = 'clients') {
  if (target === 'products') return { products: records.map(r => ({ name: r.name, sku: r.sku, price: String(r.price), stock: String(r.stock ?? ''), notes: [r.featured && 'Featured', r.tags.length && `Tags: ${r.tags.join(', ')}`, r.allergens.length && `Allergens: ${r.allergens.join(', ')}`, r.category && `Category: ${r.category}`, r.notes].filter(Boolean).join(' | ') })) }
  if (target === 'services') return { services: records.map(r => ({ name: r.name, category: r.category || 'Cuts', minutes: String(r.minutes || ''), buffer: '0', price: String(r.price), deposit: '0', notes: r.notes })) }
  if (target === 'team') return { staff: records.map(r => ({ name: r.name, role: r.role, phone: r.phone, does: [], notes: r.notes })) }
  return {
    clients: records.map(c => ({ name: c.name, phone: c.phone, email: c.email, vip: c.vip ? 'Yes' : 'No', visits: '', lastVisit: '', credit: c.credit ? String(c.credit) : '', alert: c.alert, notes: c.notes })),
    packages: records.flatMap(c => c.packages.map(p => ({ client: c.name, name: p.name, left: String(p.left), of: String(p.of), paid: String(p.paid), expires: '' }))),
  }
}
