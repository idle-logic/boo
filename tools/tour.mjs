// A short show of everything Boo does. Haunt must be running.
//   node tools/tour.mjs
const port = Number(process.env.HAUNT_PORT ?? 47474)
const steps = [
  [0, 'say', 'Hi! I am Boo. Watch this.'],
  [4000, 'start', 'Importing 48 clients from your old system'],
  [9000, 'tool', 'Reading clients.csv'],
  [13000, 'tool', 'Filling client 12 of 48'],
  [18000, 'done', '48 clients moved over'],
  [26000, 'fail', 'One phone number looked wrong'],
  [32000, 'needs-you', 'Check Mei Lin before I save her'],
]

const send = (type, text) =>
  fetch(`http://127.0.0.1:${port}/event`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ type, text }),
  }).catch(() => console.log('Haunt is not running. Start it with npm start.'))

for (const [at, type, text] of steps) {
  setTimeout(() => {
    console.log(`${(at / 1000).toFixed(0)}s  ${type}: ${text}`)
    send(type, text)
  }, at)
}
