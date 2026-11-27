// Old habits: the ways people store data where software has no field for it.
// Shared by "raise anything" (reading any old data) and the afterlife (catching
// old habits typed into the new app). Pure functions, no DOM.

export const HEALTH = /allerg|pregnan|asthma|latex|eczema|sensitive|patch test|medical|epilep|diabet|heart|nut\b|nuts\b|gluten|blood thinner|surgery|injur|knee|back pain|seizure|inhaler/i
// Something owed, prepaid or promised in no fixed shape. Rules can't read these; Gemini can.
export const UNCLEAR = /\b(owes?|owed|paid ahead|voucher|promo|comped|honou?r|no.?show|refund|iou|on account|tab)\b/i

const PACKAGES = [
  // "PKG blowdry: 3 left of 5, paid $250"
  [/^PKG (.+?): (\d+) left of (\d+),? paid \$(\d+(?:\.\d+)?)/i, m => ({ what: m[1], left: +m[2], of: +m[3], paid: +m[4] })],
  // "PT pack: 4 left of 12, paid $960"
  [/^(.+?) (?:pkg|pack|package|pass): (\d+) left of (\d+),? paid \$(\d+(?:\.\d+)?)/i, m => ({ what: m[1], left: +m[2], of: +m[3], paid: +m[4] })],
  // "prepaid 10 massages ($600) - 4 remaining"
  [/^prepaid (\d+) (.+?) \(\$(\d+(?:\.\d+)?)\) - (\d+) remaining/i, m => ({ what: m[2], of: +m[1], paid: +m[3], left: +m[4] })],
  // "5x blowdry pkg, 1 used. pd $250"
  [/^(\d+)\s*x\s*(.+?) (?:pkg|package|pass|pack)[,.]? (\d+) used[.,]? (?:pd|paid) \$(\d+(?:\.\d+)?)/i, m => ({ what: m[2], of: +m[1], left: +m[1] - +m[3], paid: +m[4] })],
  // "10 class pass, 3 used, paid $250"
  [/^(\d+) (.+?) (?:pkg|package|pass|pack)[,.]? (\d+) used[.,]? (?:pd|paid) \$(\d+(?:\.\d+)?)/i, m => ({ what: m[2], of: +m[1], left: +m[1] - +m[3], paid: +m[4] })],
]
const CREDIT = /\b(credit|balance|gift card|account)\b[^$]*\$(\d+(?:\.\d+)?)|\$(\d+(?:\.\d+)?)[^.]*\b(credit|balance)\b/i

/** A name with marks typed into it: ★, **VIP**, *VIP*, (PPD ALLERGY), (DO NOT CALL). */
export function readName(raw) {
  let name = String(raw ?? '')
  let vip = false
  let alert = ''
  const flags = []
  if (/★|☆|\*\*?\s*VIP\s*\*?\*|\bVIP\b/i.test(name)) vip = true
  name = name.replace(/\s*[★☆]+/g, '').replace(/\s*\*{1,2}\s*VIP\s*\*{1,2}/gi, '').replace(/\s*[-\u2013]?\s*\bVIP\b/gi, '')
  for (const m of name.matchAll(/\(([^)]+)\)|\[([^\]]+)\]/g)) {
    const tag = (m[1] ?? m[2]).trim()
    if (HEALTH.test(tag)) alert = alert || sentence(tag)
    else flags.push(sentence(tag))
  }
  name = name.replace(/\s*\([^)]*\)|\s*\[[^\]]*\]/g, '').replace(/\s{2,}/g, ' ').trim()
  return { name, vip, alert, flags }
}

/** Several numbers in one phone field. The first is the phone; the rest go to the notes. */
export function readPhone(raw) {
  const [phone = '', ...others] = String(raw ?? '').split(/\s*(?:\/|;|,|\bor\b)\s*/).map(s => s.trim()).filter(Boolean)
  return { phone, others }
}

/** Notes with data hidden in them. Returns what each part really is. */
export function readNotes(raw) {
  const out = { packages: [], credit: 0, creditFrom: '', alert: '', unclear: [], notes: [] }
  for (const part of String(raw ?? '').split(/\s*(?:\||;|\n)\s*/).map(s => s.trim()).filter(Boolean)) {
    const pkg = PACKAGES.map(([re, f]) => (re.exec(part) ? f(re.exec(part)) : null)).find(Boolean)
    if (pkg && pkg.left >= 0 && pkg.left <= pkg.of) {
      out.packages.push({ name: `${pkg.of} ${pkg.what}`, left: pkg.left, of: pkg.of, paid: pkg.paid, from: part })
      continue
    }
    if (UNCLEAR.test(part)) {
      out.unclear.push(part)
      out.notes.push(part)
      continue
    }
    const credit = CREDIT.exec(part)
    if (credit) {
      out.credit += Number(credit[2] ?? credit[3])
      out.creditFrom = out.creditFrom ? `${out.creditFrom} | ${part}` : part
      continue
    }
    if (!out.alert && HEALTH.test(part)) out.alert = sentence(part.split(/[.,]/)[0].slice(0, 60))
    out.notes.push(part)
  }
  out.notes = out.notes.join(' | ')
  return out
}

const sentence = s => {
  if (/^[A-Za-z]{1,3}$/.test(String(s).trim())) return String(s).trim().toUpperCase()
  const t = String(s).trim().toLowerCase()
  return t.charAt(0).toUpperCase() + t.slice(1)
}

/**
 * A new client typed the old way. Returns the clean values, any packages to add,
 * and a short line per habit caught. Returns null when there was nothing to fix.
 */
export function fixClient(values) {
  const n = readName(values.name)
  const p = readPhone(values.phone)
  const notes = readNotes([values.notes, ...p.others.map(o => `Other number: ${o}`)].filter(Boolean).join(' | '))
  const fixes = []
  if (n.vip) fixes.push('★ in the name → VIP')
  if (n.alert) fixes.push(`${n.alert} in the name → alert`)
  if (n.flags.length) fixes.push(`${n.flags.join(', ')} in the name → notes`)
  if (p.others.length) fixes.push('second number → notes')
  if (notes.credit) fixes.push(`$${notes.credit} in the notes → store credit`)
  if (notes.packages.length) fixes.push(`${notes.packages.map(x => x.name).join(', ')} in the notes → Packages`)
  if (!values.alert && !n.alert && notes.alert) fixes.push(`${notes.alert} in the notes → alert`)
  if (!fixes.length) return null
  const clean = {
    ...values,
    name: n.name,
    phone: p.phone,
    vip: n.vip ? 'Yes' : values.vip || 'No',
    alert: values.alert || n.alert || notes.alert,
    credit: String((Number(values.credit) || 0) + notes.credit || ''),
    notes: [notes.notes, ...n.flags].filter(Boolean).join(' | '),
  }
  return { values: clean, packages: notes.packages.map(x => ({ client: n.name, name: x.name, left: String(x.left), of: String(x.of), paid: String(x.paid) })), fixes }
}

// ------------------------------------------------------------- things sold: menu items, products, services

const ALLERGEN = /\b(gf|gluten|nuts?|peanuts?|dairy|lactose|shellfish|egg|soy|sesame|halal|kosher)\b|contains/i
const TAG = /^(v|vg|vegan|vegetarian|spicy|hot|new|seasonal|limited|signature|house special|chef'?s (pick|special)|popular|best ?seller|kids)$/i

/**
 * An item name with marks typed into it: "Dragon Roll ★ (GF) (SPICY) SOLD OUT", "86 Miso soup".
 * Returns the clean name and what each mark really is.
 */
export function readItemName(raw) {
  let name = String(raw ?? '')
  const tags = []
  const allergens = []
  let featured = /★|☆|chef'?s (pick|special)|best ?seller|popular/i.test(name)
  const soldOut = /sold ?out|\bunavailable\b|^\s*86\b|\(86\)/i.test(name)
  name = name.replace(/\s*[★☆]+/g, '').replace(/\s*[-\u2013]?\s*\b(chef'?s (pick|special)|best ?seller)\b/gi, '').replace(/\s*[-\u2013]?\s*sold ?out\b/gi, '').replace(/\s*\bunavailable\b/gi, '').replace(/^\s*86\s+/, '').replace(/\(86\)/, '')
  for (const m of name.matchAll(/\(([^)]+)\)|\[([^\]]+)\]/g)) {
    for (const part of (m[1] ?? m[2]).split(/\s*[,/]\s*/)) {
      const t = part.trim()
      if (!t) continue
      if (ALLERGEN.test(t) || HEALTH.test(t)) allergens.push(sentence(t))
      else if (/chef'?s (pick|special)|popular|best ?seller/i.test(t)) featured = true
      else tags.push(TAG.test(t) ? sentence(t) : sentence(t))
    }
  }
  name = name.replace(/\s*\([^)]*\)|\s*\[[^\]]*\]/g, '').replace(/\s{2,}/g, ' ').replace(/[\s,-]+$/, '').trim()
  return { name, featured, soldOut, tags, allergens }
}

/** A price typed with extra words: "$18 / $24 large", "from $40", "S$12.50", "12.5". */
export function readPrice(raw) {
  const text = String(raw ?? '').trim()
  const nums = [...text.matchAll(/(\d+(?:[.,]\d{1,2})?)/g)].map(m => Number(m[1].replace(',', '.')))
  if (!nums.length) return { price: '', extra: text }
  const plain = /^\s*[A-Z]{0,3}\$?\s*\d+(?:[.,]\d{1,2})?\s*$/i.test(text)
  return { price: nums[0], extra: plain ? '' : text }
}

/** A minutes field typed with words: "1h30", "90 min", "1.5 hours". */
export function readMinutes(raw) {
  const t = String(raw ?? '').toLowerCase()
  const h = /(\d+(?:\.\d+)?)\s*h/.exec(t)
  const m = /(\d+)\s*m/.exec(t) ?? (/h\s*(\d+)/.exec(t) || null)
  if (h) return Math.round(Number(h[1]) * 60 + (m ? Number(m[1]) : 0))
  const n = /(\d+)/.exec(t)
  return n ? Number(n[1]) : ''
}

/** What one item's marks become, in plain words, for the list of fixes. */
function itemFixes(raw, it, price) {
  const fixes = []
  if (it.featured) fixes.push('★ in the name → Featured')
  if (it.soldOut) fixes.push('"Sold out" in the name → stock 0')
  if (it.allergens.length) fixes.push(`${it.allergens.join(', ')} in the name → allergens`)
  if (it.tags.length) fixes.push(`${it.tags.join(', ')} in the name → tags`)
  if (price?.extra) fixes.push(`"${price.extra}" → price ${price.price}, the rest in notes`)
  return fixes
}

/** A product or menu item typed the old way. Returns null when there is nothing to fix. */
export function fixProduct(values) {
  const it = readItemName(values.name)
  const price = readPrice(values.price)
  const fixes = itemFixes(values.name, it, price)
  if (!fixes.length) return null
  return {
    values: {
      ...values,
      name: it.name,
      price: String(price.price),
      stock: it.soldOut ? '0' : values.stock ?? '',
      notes: [values.notes, it.featured && 'Featured', it.tags.length && `Tags: ${it.tags.join(', ')}`, it.allergens.length && `Allergens: ${it.allergens.join(', ')}`, price.extra && `Price as written: ${price.extra}`].filter(Boolean).join(' | '),
    },
    fixes,
  }
}

/** A "service" that is really a product ("RETAIL - Argan oil"), or a service with marks in its name or price. */
export function fixService(values) {
  const m = /^\s*(?:RETAIL|PRODUCT|STOCK)\s*[-:]\s*(.+)$/i.exec(values.name ?? '')
  if (m) return { product: { name: m[1].trim(), sku: '', price: values.price ?? '', stock: '' }, fixes: [`"${values.name}" is a product, not a service → Products`] }
  const it = readItemName(values.name)
  const price = readPrice(values.price)
  const minutes = readMinutes(values.minutes)
  const fixes = itemFixes(values.name, it, price)
  if (values.minutes && String(minutes) !== String(values.minutes).trim()) fixes.push(`"${values.minutes}" → ${minutes} min`)
  if (!fixes.length) return null
  return { values: { ...values, name: it.name, price: String(price.price), minutes: String(minutes) }, fixes }
}

/** A team member typed the old way: "Jas K. (PART TIME)" with two numbers. */
export function fixStaff(values) {
  const n = readName(values.name)
  const p = readPhone(values.phone)
  const fixes = []
  if (n.flags.length) fixes.push(`${n.flags.join(', ')} in the name → role`)
  if (p.others.length) fixes.push('second number → dropped from the phone field')
  if (!fixes.length) return null
  return { values: { ...values, name: n.name, phone: p.phone, role: [values.role, ...n.flags].filter(Boolean).join(', ') }, fixes }
}
