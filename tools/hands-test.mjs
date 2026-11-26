// Spike: scan the demo form and fill one record through Boo's hands.
import { spawn } from 'node:child_process'
import { createInterface } from 'node:readline'

const ps = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', 'src/main/hands.ps1'], { windowsHide: true })
const lines = createInterface({ input: ps.stdout })
ps.stderr.on('data', d => process.stderr.write(d))
const waiting = []
lines.on('line', l => waiting.shift()?.(JSON.parse(l)))
const ask = msg => new Promise(res => { waiting.push(res); ps.stdin.write(JSON.stringify(msg) + '\n') })

const scan = await ask({ cmd: 'scan', title: 'New client' })
const fields = scan.fields.filter(f => f.type !== 'Button' || /save|clear/i.test(f.label))
console.log('found:', fields.map(f => `${f.index}:${f.label}`).join(' | '))

const record = {
  'First name': 'Mei',
  'Last name': 'Lin',
  'Mobile number': '+65 9123 4567',
  Email: 'mei.lin@example.com',
  'Date of birth (DD/MM/YYYY)': '14/03/1990',
  'Preferred staff': 'Hana',
  'Pet name and breed': 'Kopi, toy poodle',
  'Notes and allergies': 'Sensitive skin. Oatmeal shampoo only. No ear powder.',
}
for (const [label, value] of Object.entries(record)) {
  const f = scan.fields.find(x => x.label === label)
  if (!f) { console.log('missing', label); continue }
  const r = await ask({ cmd: 'fill', index: f.index, value })
  console.log(`${label} -> ${JSON.stringify(r.value ?? r.error)}`)
}
ps.stdin.end()
