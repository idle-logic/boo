// Moving old exports into new forms: parsing and matching without a model.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import fc from 'fast-check'
import { shortTitle } from '../src/main/migrate.js'
import { parseCsv, heuristicValues, fillableFields, saveButton, recordName, cleanValues } from '../src/main/mapping.js'

// The fields Boo's hands found on demo/new-client-form.html in Edge.
const FORM = [
  { index: 6, type: 'Edit', label: 'Address and search bar' },
  { index: 20, type: 'Edit', label: 'First name', id: 'first' },
  { index: 21, type: 'Edit', label: 'Last name', id: 'last' },
  { index: 22, type: 'Edit', label: 'Mobile number', id: 'phone' },
  { index: 23, type: 'Edit', label: 'Email', id: 'email' },
  { index: 24, type: 'Edit', label: 'Date of birth (DD/MM/YYYY)', id: 'dob' },
  { index: 25, type: 'ComboBox', label: 'Preferred staff', id: 'staff' },
  { index: 26, type: 'Edit', label: 'Pet name and breed', id: 'pet' },
  { index: 27, type: 'Edit', label: 'Notes and allergies', id: 'notes' },
  { index: 28, type: 'Button', label: 'Clear' },
  { index: 29, type: 'Button', label: 'Save client' },
]

test('the demo export maps onto the demo form without a model', () => {
  const { headers, rows } = parseCsv(readFileSync('demo/old-system-export.csv', 'utf-8'))
  assert.equal(rows.length, 5)
  const v = heuristicValues(rows[0], headers, FORM)
  assert.equal(v[20], 'Mei')
  assert.equal(v[21], 'Lin')
  assert.equal(v[22], '+65 9123 4567')
  assert.equal(v[23], 'mei.lin@example.com')
  assert.equal(v[24], '14/03/1990')
  assert.equal(v[25], 'Hana')
  assert.equal(v[26], 'Kopi, Toy poodle')
  assert.equal(v[27], 'Sensitive skin. Oatmeal shampoo only. No ear powder.')
  assert.equal(v[6], undefined, 'never types into the browser address bar')
})

test('Boo finds the save button and skips browser controls', () => {
  assert.equal(saveButton(FORM).label, 'Save client')
  assert.ok(!fillableFields(FORM).some(f => f.index === 6))
})

test('a record has a name for the bubble', () => {
  assert.equal(recordName({ 'Full Name': 'Mei Lin' }), 'Mei Lin')
  assert.equal(recordName({ First: 'Ada', Surname: 'Lovelace' }), 'Ada Lovelace')
})

test('CSV parsing keeps every row and cell, whatever the quoting', () => {
  const cell = fc.string({ maxLength: 12 }).map(s => s.replace(/\r/g, ''))
  fc.assert(
    fc.property(fc.array(fc.array(cell, { minLength: 3, maxLength: 3 }), { minLength: 1, maxLength: 20 }), table => {
      const rows = table.filter(r => r.some(c => c.trim() !== ''))
      const quote = c => `"${c.replace(/"/g, '""')}"`
      const text = ['a,b,c', ...rows.map(r => r.map(quote).join(','))].join('\n')
      const parsed = parseCsv(text)
      return (
        parsed.rows.length === rows.length &&
        parsed.rows.every((r, i) => r.a === rows[i][0].trim() && r.b === rows[i][1].trim() && r.c === rows[i][2].trim())
      )
    }),
    { numRuns: 300 },
  )
})

test('model output can only fill real form fields', () => {
  fc.assert(
    fc.property(fc.dictionary(fc.string({ maxLength: 4 }), fc.oneof(fc.string(), fc.integer(), fc.constant(null))), values => {
      const clean = cleanValues(values, FORM)
      const allowed = new Set(fillableFields(FORM).map(f => f.index))
      return Object.keys(clean).every(k => allowed.has(Number(k)) && typeof clean[k] === 'string')
    }),
  )
})

test('Boo names the window it fills in plain words', () => {
  assert.equal(shortTitle('New client · Bloom Booking and 1 more page - Personal - Microsoft Edge'), 'New client · Bloom Booking')
  assert.equal(shortTitle(''), 'this window')
})
