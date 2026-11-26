// Moving a record from an old export into a form Boo found on screen.
// Pure functions, so they can be tested without a screen.

/** Parse CSV text with quoted fields. Returns { headers, rows } where rows are objects. */
export function parseCsv(text) {
  const records = []
  let field = ''
  let row = []
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++ }
      else if (ch === '"') quoted = false
      else field += ch
    } else if (ch === '"') quoted = true
    else if (ch === ',') { row.push(field); field = '' }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      field = ''
      if (row.some(v => v.trim() !== '')) records.push(row)
      row = []
    } else field += ch
  }
  row.push(field)
  if (row.some(v => v.trim() !== '')) records.push(row)
  const [headers = [], ...body] = records
  const clean = headers.map(h => h.trim())
  return {
    headers: clean,
    rows: body.map(cells => Object.fromEntries(clean.map((h, i) => [h, (cells[i] ?? '').trim()]))),
  }
}

/** The fields worth filling: text boxes and drop-downs, not the browser's own address bar. */
export function fillableFields(fields) {
  return fields.filter(
    f => (f.type === 'Edit' || f.type === 'ComboBox') && !/address and search bar|search tabs|^search$/i.test(f.label ?? ''),
  )
}

/** The button that saves the form, if Boo can see one. */
export function saveButton(fields) {
  const buttons = fields.filter(f => f.type === 'Button')
  return (
    buttons.find(b => /^(save|add|create|submit)\b/i.test(b.label ?? '')) ??
    buttons.find(b => /\b(save|add client|create|submit)\b/i.test(b.label ?? '')) ??
    null
  )
}

// Words that mean the same thing in old exports and new forms.
const SYNONYMS = [
  ['first', 'given', 'firstname', 'forename'],
  ['last', 'surname', 'lastname', 'family'],
  ['phone', 'mobile', 'cell', 'tel', 'telephone', 'contact', 'hp', 'whatsapp'],
  ['email', 'mail', 'e-mail'],
  ['dob', 'birth', 'birthday', 'born'],
  ['notes', 'note', 'remarks', 'comments', 'allergies', 'allergy', 'medical'],
  ['staff', 'stylist', 'therapist', 'groomer', 'practitioner', 'doctor', 'preferred'],
  ['pet', 'dog', 'cat', 'animal', 'breed'],
  ['address', 'street', 'postcode', 'zip'],
]

function words(text) {
  return (text ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter(Boolean)
}

function concepts(text) {
  const ws = words(text)
  const out = new Set(ws)
  for (const group of SYNONYMS) if (ws.some(w => group.includes(w))) out.add(group[0])
  return out
}

function score(a, b) {
  const ca = concepts(a)
  const cb = concepts(b)
  let hit = 0
  for (const c of ca) if (cb.has(c)) hit++
  return hit
}

/**
 * Without a model: match each form field to the best export column by meaning.
 * Splits a full name across first and last name fields.
 * Returns { [fieldIndex]: value }.
 */
export function heuristicValues(row, headers, fields) {
  const out = {}
  const fill = fillableFields(fields)
  const nameCol = headers.find(h => /^(full ?name|name|client|customer|patient)$/i.test(h.trim()))
  const [firstPart, ...restParts] = (nameCol ? row[nameCol] : '').split(/\s+/)
  for (const f of fill) {
    const label = `${f.label} ${f.id}`
    const lc = concepts(label)
    if (nameCol && lc.has('first') && !headers.some(h => concepts(h).has('first'))) {
      out[f.index] = firstPart ?? ''
      continue
    }
    if (nameCol && lc.has('last') && !headers.some(h => concepts(h).has('last'))) {
      out[f.index] = restParts.join(' ')
      continue
    }
    // Several columns can feed one field, like "Pet name and breed" from Pet and Breed.
    // A column whose every word appears in the label is a direct hit.
    const labelWords = new Set(words(label))
    const direct = headers.filter(h => words(h).length > 0 && words(h).every(w => labelWords.has(w)) && row[h])
    if (direct.length > 0) {
      out[f.index] = direct.map(h => row[h]).join(', ')
      continue
    }
    const ranked = headers.map(h => ({ h, s: score(label, h) })).filter(x => x.s > 0).sort((a, b) => b.s - a.s)
    if (ranked.length === 0) continue
    const top = ranked[0].s
    const used = ranked.filter(x => x.s === top).map(x => row[x.h]).filter(Boolean)
    if (used.length) out[f.index] = used.join(', ')
  }
  return out
}

/** Prompt for the model: one record, the form's fields, return values by field index. */
export function mappingPrompt(row, fields) {
  const fill = fillableFields(fields)
  return {
    system: `You move one client record from an old system's export into a form in new software, for a small clinic, spa, salon or groomer.

Reply with one JSON object and nothing else: { "values": { "<field index>": "<text to type>" } }

Rules:
1. Only fill a field when the record has the information. Leave others out.
2. Match by meaning, not exact words. "HP" or "Contact" is a phone number. "Remarks" can hold notes and allergies.
3. Follow any format in the field label, like DD/MM/YYYY for dates.
4. Split or join values to fit, like a full name into first and last name, or a pet's name and breed into one field.
5. For a drop-down, use the option's text as it is likely written, like a staff member's first name.
6. Never invent anything.`,
    user: `Form fields:\n${fill.map(f => `${f.index}: ${f.label}${f.type === 'ComboBox' ? ' (drop-down)' : ''}`).join('\n')}\n\nRecord:\n${Object.entries(row)
      .filter(([, v]) => v)
      .map(([k, v]) => `${k}: ${v}`)
      .join('\n')}`,
  }
}

/** Keep only values for real fillable fields. */
export function cleanValues(values, fields) {
  const allowed = new Set(fillableFields(fields).map(f => String(f.index)))
  const out = {}
  for (const [k, v] of Object.entries(values ?? {})) {
    if (allowed.has(String(k)) && typeof v === 'string' && v.trim()) out[Number(k)] = v.trim().slice(0, 500)
  }
  return out
}

/** Who this record is, for Boo's bubble. */
export function recordName(row) {
  const first = Object.entries(row).find(([k]) => /first|given/i.test(k))?.[1]
  const last = Object.entries(row).find(([k]) => /last|surname|family/i.test(k))?.[1]
  const full = Object.entries(row).find(([k]) => /^(full ?name|name|client|customer|patient)$/i.test(k.trim()))?.[1]
  return full || [first, last].filter(Boolean).join(' ') || 'this client'
}
