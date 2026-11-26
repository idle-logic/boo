// "Don't switch. Haunt it." Each workaround the team does by hand becomes a
// feature Boo runs inside the old software, through its own screens:
//   Allergy guard   - a chemical service for someone with an allergy: stop and ask
//   Package tracker - a booking that uses a package: count the session off in the notes
//   Auto clean-up   - colour or keratin booked: block the clean-up time after it
//   Deposit nudge   - a service that needs a deposit: say how much to take
//   VIP welcome     - a VIP is coming: flag it for the stylist

import { cleanName, categoryOf } from './interpret.js'

const CHEMICAL = new Set(['Colour', 'Treatments', 'Brows'])
const PKG_FOR = { 'Blow-dry': /blow/i, "Men's cut": /men/i, 'Scalp detox': /scalp/i }
const toMins = t => Number(t.slice(0, 2)) * 60 + Number(t.slice(3))
const hhmm = m => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`

export const FEATURES = [
  { key: 'allergy', name: 'Allergy guard', from: 'alerts', what: 'Stops a colour booking for anyone with an allergy written in their name or notes.' },
  { key: 'package', name: 'Package tracker', from: 'packages', what: 'Counts off a session in the notes every time a package is used.' },
  { key: 'cleanup', name: 'Auto clean-up', from: 'cleanup', what: 'Books the clean-up block after colour and keratin, so nobody has to.' },
  { key: 'deposit', name: 'Deposit nudge', from: 'deposits', what: 'Tells the front desk the deposit to take, from the service description.' },
  { key: 'vip', name: 'VIP welcome', from: 'vip', what: 'Flags VIPs to their stylist when they book.' },
]

/** One session used: the same note, in the same style the team wrote it, with one less left. */
export function useSession(text) {
  let m = /^(PKG .+?: )(\d+)( left of \d+, paid \$\d+)/i.exec(text)
  if (m) return text.replace(m[0], `${m[1]}${Number(m[2]) - 1}${m[3]}`)
  m = /^(prepaid \d+ .+? \(\$\d+\) - )(\d+)( remaining)/i.exec(text)
  if (m) return text.replace(m[0], `${m[1]}${Number(m[2]) - 1}${m[3]}`)
  m = /^(\d+x .+? pkg, )(\d+)( used\.)/i.exec(text)
  if (m) return text.replace(m[0], `${m[1]}${Number(m[2]) + 1}${m[3]}`)
  return text
}

/**
 * Watch the front desk. on: { r (Boo's hands on Slotly), boo, read, data, ui, enabled: Set of feature keys }.
 * Returns a handler for each new appointment saved in Slotly.
 */
export function createFeatures({ r, boo, read, data, ui, enabled }) {
  const stats = { steps: 0, caught: 0 }
  let busy = Promise.resolve()

  async function onBooked(a) {
    if (a.service === 'CLEAN UP' || a.customer === 'BLOCKED') return
    const name = cleanName(a.customer)
    const client = read.clients.find(c => c.name === name)
    const service = read.services.find(s => s.name === a.service)
    const cat = service?.category ?? categoryOf(a.service)
    r.pace.move = 320

    if (enabled.has('allergy') && client?.alert && CHEMICAL.has(cat)) {
      ui.feature('allergy', `${name}: ${client.alert}`)
      const ok = await ui.ask({ title: `${name} has an alert: ${client.alert}`, detail: `${a.service} uses chemicals. The team's rule is a patch test 48 hours before.`, choices: [['note', 'Add a patch test reminder to her notes'], ['skip', 'Patch test already done']] })
      stats.caught++
      if (ok === 'note') {
        await editNotes(client.src, n => `PATCH TEST before ${a.service} on ${a.date} | ${n}`)
        stats.steps++
      }
    }
    if (enabled.has('package') && client) {
      const re = PKG_FOR[a.service]
      const idx = re ? client.packages.findIndex(p => re.test(p.name)) : -1
      if (idx >= 0) {
        const p = client.packages[idx]
        ui.feature('package', `${name}: ${p.name}, ${p.left} → ${p.left - 1} left`)
        boo.say(`${name} has a package. Counting one off.`, 2600)
        await editNotes(client.src, notes => notes.split(' | ').map(part => (part === p.from ? useSession(part) : part)).join(' | '))
        p.from = useSession(p.from)
        p.left--
        stats.steps++
      }
    }
    if (enabled.has('cleanup') && service?.buffer) {
      const at = hhmm(toMins(a.time) + service.minutes)
      ui.feature('cleanup', `${a.service} ends ${at}: clean-up booked`)
      boo.say(`Booking the clean-up after ${a.service}.`, 2600)
      await r.press('[data-new]')
      await r.fill({ Service: 'CLEAN UP', Staff: a.staff, Date: a.date, Time: at })
      await r.submit()
      const last = data.appointments.find(x => x.service === 'CLEAN UP' && x.date === a.date && x.time === at && x.staff === a.staff)
      if (last) last.mins = service.buffer
      ui.refreshOld?.()
      stats.steps++
    }
    if (enabled.has('deposit') && service?.deposit) {
      const amount = ((service.price * service.deposit) / 100).toFixed(2)
      ui.feature('deposit', `${a.service}: take $${amount} now`)
      boo.say(`Take a ${service.deposit}% deposit: $${amount}.`, 3000)
      stats.steps++
    }
    if (enabled.has('vip') && client?.vip) {
      ui.feature('vip', `${name} is a VIP, ${a.staff} told`)
      boo.react('happy', `${name.split(' ')[0]} is a VIP!`, 2400)
      stats.steps++
    }
    r.hide()
  }

  async function editNotes(src, change) {
    await r.press('[data-nav]', 'Customers')
    // Page through the list, the way a person would, until the customer is on screen.
    const row = () => r.all('tbody tr[data-customer]').find(tr => Number(tr.dataset.customer) === src)
    for (let tries = 0; !row() && tries < 10; tries++) {
      const first = Number(r.all('tbody tr[data-customer]')[0]?.dataset.customer ?? 0)
      await r.press(`[data-page="${src < first ? -1 : 1}"]`)
    }
    await r.click(row())
    const box = r.look('aside textarea')
    await r.fill({ Notes: change(box.value) }, { typing: false })
    await r.submit()
    await r.press('[data-nav]', 'Appointments')
  }

  return {
    stats,
    // One booking at a time, in order, however fast the front desk is.
    booked: a => (busy = busy.then(() => onBooked(a)).catch(err => ui.log(`Stopped: ${err.message}`, 'warn'))),
    get idle() {
      return busy
    },
  }
}
