// Into any software. Every app imports a CSV with its own column headings. Give Boo those
// headings (a preset, the app's import template, or any export from that app) and Boo writes
// the clean records in exactly that shape, then reads the file back to prove every row and
// every dollar is in it.

import { parseCsv, toCsv } from './raise.js'

/** What Boo can put in a column, per kind of record. */
export const FIELDS = {
  clients: ['name', 'first name', 'last name', 'phone', 'email', 'vip', 'alert', 'credit', 'tags', 'notes'],
  products: ['name', 'handle', 'price', 'sku', 'stock', 'category', 'tags', 'allergens', 'featured', 'notes'],
  services: ['name', 'price', 'minutes', 'category', 'tags', 'notes'],
  team: ['name', 'first name', 'last name', 'role', 'phone', 'notes'],
}
export const SPECIAL = ['yes', 'blank']

/**
 * Common import formats. Headings follow each app's published CSV import format; apps change
 * them now and then, so for anything else (or to be sure) drop the app's own template.
 */
export const PRESETS = [
  { id: 'clean', label: 'Any app (clean CSV)', target: null },
  { id: 'google-contacts', label: 'Google Contacts', target: 'clients', headers: ['First Name', 'Last Name', 'E-mail 1 - Value', 'Phone 1 - Value', 'Labels', 'Notes'] },
  { id: 'shopify-customers', label: 'Shopify customers', target: 'clients', headers: ['First Name', 'Last Name', 'Email', 'Phone', 'Tags', 'Note'] },
  { id: 'mailchimp', label: 'Mailchimp audience', target: 'clients', headers: ['Email Address', 'First Name', 'Last Name', 'Phone Number', 'Tags'] },
  { id: 'shopify-products', label: 'Shopify products', target: 'products', headers: ['Handle', 'Title', 'Body (HTML)', 'Type', 'Tags', 'Published', 'Variant SKU', 'Variant Price', 'Variant Inventory Qty'] },
  { id: 'menu', label: 'Online menu (name, price, section)', target: 'products', headers: ['Item Name', 'Price', 'Section', 'Description', 'Dietary'] },
]

/** A heading to a field, by its words. Returns '' when unsure (the column is left blank). */
export function fieldFor(header, target) {
  const h = String(header).toLowerCase()
  const can = f => FIELDS[target].includes(f)
  const pick = (re, f) => re.test(h) && can(f) && f
  return (
    pick(/^handle$|slug/, 'handle') ||
    pick(/first|given/, 'first name') ||
    pick(/last|surname|family/, 'last name') ||
    pick(/e-?mail/, 'email') ||
    pick(/phone|mobile|\btel\b|cell/, 'phone') ||
    pick(/\bsku\b|barcode|\bcode\b/, 'sku') ||
    pick(/qty|inventory|stock|quantity|on hand/, 'stock') ||
    pick(/price|amount|cost|rate/, 'price') ||
    pick(/duration|minutes|length|mins/, 'minutes') ||
    pick(/role|position|job/, 'role') ||
    pick(/credit|balance/, 'credit') ||
    pick(/\bvip\b/, 'vip') ||
    pick(/dietary|allerg/, 'allergens') ||
    pick(/alert|medical|health/, 'alert') ||
    pick(/featured|popular/, 'featured') ||
    pick(/tag|label/, 'tags') ||
    pick(/note|memo|description|body|comment|detail/, 'notes') ||
    pick(/categor|type|section|group|department|course/, 'category') ||
    (/published|active|enabled|visible|available/.test(h) && 'yes') ||
    pick(/name|title|item|product|service|contact|customer|client|member/, 'name') ||
    ''
  )
}

export const autoMap = (headers, target) => headers.map(h => fieldFor(h, target))

const words = name => String(name ?? '').trim().split(/\s+/)
const slug = name => String(name ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

/** One record's value for one field, as text. */
export function valueOf(r, field, target, map = []) {
  const tags = [r.vip && 'VIP', r.featured && 'Featured', ...(r.tags ?? []), ...(target === 'clients' && r.alert ? [`Alert: ${r.alert}`] : [])].filter(Boolean)
  switch (field) {
    case 'name': return r.name ?? ''
    case 'first name': return words(r.name)[0] ?? ''
    case 'last name': return words(r.name).slice(1).join(' ')
    case 'handle': return slug(r.name)
    case 'phone': return r.phone ?? ''
    case 'email': return r.email ?? ''
    case 'vip': return r.vip ? 'Yes' : 'No'
    case 'alert': return r.alert ?? (r.allergens ?? []).join(', ')
    case 'credit': return r.credit ? String(r.credit) : ''
    case 'price': return r.price === '' || r.price == null ? '' : String(r.price)
    case 'sku': return r.sku ?? ''
    case 'stock': return r.stock === '' || r.stock == null ? '' : String(r.stock)
    case 'minutes': return r.minutes ? String(r.minutes) : ''
    case 'category': return r.category ?? ''
    case 'role': return r.role ?? ''
    case 'allergens': return (r.allergens ?? []).join(', ')
    case 'featured': return r.featured ? 'Yes' : 'No'
    case 'tags': return tags.join(', ')
    case 'notes': {
      // Anything the destination has no column for goes here, so nothing is lost.
      const homeless = FIELDS[target].filter(f => !['name', 'first name', 'last name', 'handle', 'notes', 'tags'].includes(f) && !map.includes(f) && valueOf(r, f, target) && !(f === 'vip' && (!r.vip || map.includes('tags'))) && !(f === 'featured' && (!r.featured || map.includes('tags'))))
      return [r.notes, ...homeless.map(f => `${f.charAt(0).toUpperCase() + f.slice(1)}: ${valueOf(r, f, target)}`), ...(r.packages ?? []).map(p => `Package: ${p.name}, ${p.left} of ${p.of} left, paid $${p.paid}`)].filter(Boolean).join(' | ')
    }
    case 'yes': return 'TRUE'
    default: return ''
  }
}

/** The records in exactly the destination's columns. */
export function exportTo(records, target, headers, map) {
  return toCsv([headers, ...records.map(r => headers.map((_, i) => valueOf(r, map[i], target, map)))])
}

/**
 * Read the written file back and check it: every row, every name, and every dollar of the
 * money columns it has. Returns { passed, checks, lines }.
 */
export function proveExport(records, target, csv, map) {
  const [, ...rows] = parseCsv(csv)
  const col = f => map.indexOf(f)
  const nameOf = r => (col('name') >= 0 ? r[col('name')] : [r[col('first name')], r[col('last name')]].filter(Boolean).join(' '))
  const checks = []
  checks.push([`${rows.length} of ${records.length} rows`, rows.length === records.length])
  const want = records.map(r => String(r.name).trim().toLowerCase()).sort()
  const got = rows.map(r => String(nameOf(r) ?? '').trim().toLowerCase()).sort()
  if (col('name') >= 0 || col('first name') >= 0) checks.push(['every name', want.join('|') === got.join('|')])
  for (const f of ['price', 'credit']) {
    if (col(f) < 0) continue
    const sum = list => Math.round(list.reduce((a, v) => a + (Number(v) || 0), 0) * 100) / 100
    const a = sum(records.map(r => r[f]))
    const b = sum(rows.map(r => r[col(f)]))
    checks.push([`${f === 'price' ? 'prices' : 'credit'} $${a.toLocaleString('en')} = $${b.toLocaleString('en')}`, a === b])
  }
  const lost = FIELDS[target].filter(f => !['name', 'first name', 'last name', 'handle', 'notes', 'tags', 'vip', 'featured'].includes(f) && records.some(r => valueOf(r, f, target)) && !map.includes(f))
  if (lost.length) checks.push([map.includes('notes') ? `${lost.join(', ')} kept in the notes column` : `no column for ${lost.join(', ')}: add a notes column`, map.includes('notes')])
  return { passed: checks.filter(c => c[1]).length, checks: checks.length, lines: checks.map(([text, ok]) => `${ok ? '✔' : '✖'} ${text}`) }
}

/** Headings from a template or a sample export: the first row of the file. */
export function headersFrom(text) {
  return (parseCsv(text)[0] ?? []).map(h => h.trim()).filter(Boolean)
}
