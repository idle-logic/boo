// End-to-end checks in a real browser (Edge, through playwright-core), against the running demo.
//   node tools/serve-site.mjs 4317          (with GEMINI_API_KEY, for the AI steps)
//   node tests/e2e/run.mjs [demo|paper|menu|gym|wide] [--shots dir]
// Every step names the acceptance criteria it proves, like [raise-anything 1.2], and throws if the check fails.
// Results go to tests/e2e/last-run.json.

import { chromium } from 'playwright-core'
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const URL_ = process.env.BOO_URL ?? 'http://localhost:4317/?intro=0'
const only = process.argv.slice(2).filter(a => !a.startsWith('--'))
const shotsAt = process.argv.includes('--shots') ? process.argv[process.argv.indexOf('--shots') + 1] : null
const results = []

function check(ok, message) {
  if (!ok) throw new Error(message)
}

async function scenario(name, fn) {
  if (only.length && !only.includes(name)) return
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const page = await browser.newPage({ viewport: { width: 1600, height: 860 }, acceptDownloads: true })
  const errors = []
  page.on('pageerror', e => errors.push(e.message))
  let n = 0
  const step = async (tags, label, body) => {
    const t0 = Date.now()
    try {
      await body()
      check(!errors.length, `page error: ${errors.join(' | ')}`)
      results.push({ scenario: name, step: label, tags, ok: true, ms: Date.now() - t0 })
      console.log(`  ✔ ${label} ${tags}`)
    } catch (err) {
      results.push({ scenario: name, step: label, tags, ok: false, error: err.message })
      console.log(`  ✖ ${label} ${tags}\n    ${err.message}`)
      if (shotsAt) await page.screenshot({ path: join(shotsAt, `${name}-FAILED.png`) })
      throw err
    }
    if (shotsAt) await page.screenshot({ path: join(shotsAt, `${name}-${String(++n).padStart(2, '0')}.png`) })
  }
  console.log(`\n${name}`)
  try {
    await page.goto(URL_)
    await page.waitForTimeout(1200)
    await fn(page, step)
  } catch {
    // Reported above.
  } finally {
    await browser.close()
  }
}

// ------------------------------------------------------------- helpers

const text = (page, sel) => page.$eval(sel, el => el.innerText.replace(/\s+/g, ' ').trim())
const waitText = (page, sel, re, timeout = 90000) => page.waitForFunction(([s, src, flags]) => new RegExp(src, flags).test(document.querySelector(s)?.innerText ?? ''), [sel, re.source, re.flags.includes('i') ? re.flags : re.flags + 'i'], { timeout })
const press = async (page, sel, timeout = 120000) => {
  await page.waitForSelector(sel, { state: 'visible', timeout })
  await page.waitForTimeout(250)
  await page.click(sel)
}
const inWindow = (page, sel) => page.$eval(sel, el => { const r = el.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth })
async function tapBoo(page) {
  if (!(await page.$eval('#chat-pop', el => el.hidden))) return
  // Boo celebrates for a moment after big steps; tap it once it is roaming again.
  const b = await (await page.waitForSelector('button.boo', { timeout: 15000 })).boundingBox()
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2)
  await page.waitForSelector('#chat-pop:not([hidden])', { timeout: 3000 })
}
async function ask(page, message) {
  await tapBoo(page)
  await page.fill('#chat-q', message)
  await page.press('#chat-q', 'Enter')
  await page.waitForFunction(() => !/thinking/.test(document.querySelector('#chat-reply')?.textContent ?? ''), null, { timeout: 45000 })
  return text(page, '#chat-reply')
}
const tourStop = (page, re) => waitText(page, '#tour .h-eyebrow', re, 120000)

// ------------------------------------------------------------- the demo: Slotly to Idle, then the séance and the afterlife

await scenario('demo', async (page, step) => {
  await step('[raise-anything 1.5]', 'with nothing dropped, the Slotly demo is the default', async () => {
    check(!(await page.$eval('#start-card', el => el.hidden)), 'no start card')
    check(/Slotly/.test(await text(page, '#pane-slotly')), 'no Slotly')
  })
  await step('[collect-old-app 3.1]', 'Play: Boo asks what matters, at Boo', async () => {
    await page.click('#start')
    await page.waitForSelector('#chat-pop:not([hidden]) .chat-chips button')
    check(/matters most/.test(await text(page, '#chat-ask')), 'no question')
    check(await inWindow(page, '#chat-pop'), 'chat outside the window')
  })
  await step('[collect-old-app 3.3]', 'a question is answered from the data', async () => {
    await page.fill('#chat-q', 'how many clients do i have?')
    await page.press('#chat-q', 'Enter')
    await page.waitForSelector('#chat-start:not([hidden])', { timeout: 45000 })
    check(/42/.test(await text(page, '#chat-reply')), `wrong count: ${await text(page, '#chat-reply')}`)
  })
  await step('[collect-old-app 3.4]', 'a change asked for before reading is held', async () => {
    await page.fill('#chat-q', "Rachel Yeo's email is rachel.yeo@newmail.com")
    await page.press('#chat-q', 'Enter')
    await page.waitForFunction(() => /Noted|Done/.test(document.querySelector('#chat-reply')?.innerText ?? ''), null, { timeout: 45000 })
  })
  await step('[collect-old-app 3.2] [collect-old-app 3.5]', 'a priority gets a reply, then Start', async () => {
    await page.fill('#chat-q', "Don't lose any money")
    await page.press('#chat-q', 'Enter')
    await page.waitForFunction(() => /Boo/.test(document.querySelector('#chat-reply')?.innerText ?? '') && !/thinking/.test(document.querySelector('#chat-reply')?.innerText ?? ''), null, { timeout: 45000 })
    await page.click('#chat-start')
    await page.waitForSelector('#chat-pop', { state: 'hidden' })
  })
  await step('[collect-old-app 2.1]', 'the caption names each part as it is read, with a spinner', async () => {
    await waitText(page, '#cap-title', /Reading|Customers|Services/, 30000)
    check(await page.$eval('#caption', el => el.classList.contains('working')), 'no spinner')
  })
  await step('[collect-old-app 1.1] [collect-old-app 1.2] [collect-old-app 2.3] [collect-old-app 4.1]', 'every part of Slotly is read, every page, then it waits', async () => {
    await page.waitForSelector('#collected .h-next', { timeout: 120000 })
    const t = await text(page, '#collected')
    for (const part of ['42 customers', 'services', 'staff', 'appointments']) check(t.includes(part), `missing ${part}: ${t}`)
  })
  await step('[collect-old-app 4.2] [boo-guide 2.1]', 'Boo perches beside the waiting popup', async () => {
    await page.waitForTimeout(2200)
    const gap = await page.evaluate(() => { const p = document.querySelector('#pop').getBoundingClientRect(); const g = document.querySelector('button.boo').getBoundingClientRect(); return !(g.right > p.left && g.left < p.right && g.bottom > p.top && g.top < p.bottom) })
    check(gap, 'Boo overlaps the popup')
    await page.click('#collected .h-next')
  })
  await step('[find-workarounds 3.1] [find-workarounds 3.2]', 'reveals ring the field in the old app', async () => {
    await tourStop(page, /1 of 3/)
    await page.waitForSelector('.wk-mark', { timeout: 5000 })
    check(await page.$eval('.wk-mark', el => el.getBoundingClientRect().width > 20), 'the ring has no size')
    check(/idle|new app/i.test(await text(page, '#tour')), 'no new-app side')
  })
  await step('[find-workarounds 4.2]', "Gemini's reading is merged with a count of answers checked and used", async () => {
    await waitText(page, '#gem-chip', /checked and used|read it all alone/, 60000)
  })
  await step('[clean-and-confirm 2.2] [clean-and-confirm 2.1] [boo-guide 2.2]', 'tap Boo: the chat opens beside it, inside the window, and answers', async () => {
    await tapBoo(page)
    check(await inWindow(page, '#chat-pop'), 'chat outside the window')
    const near = await page.evaluate(() => { const c = document.querySelector('#chat-pop').getBoundingClientRect(); const b = document.querySelector('button.boo').getBoundingClientRect(); return Math.hypot((c.left + c.right) / 2 - (b.left + b.right) / 2, Math.min(Math.abs(c.bottom - b.top), Math.abs(c.top - b.bottom))) < 520 })
    check(near, 'chat is not beside Boo')
    const r = await ask(page, 'who has the most visits?')
    check(/Marcus Lee|Arjun Ng|30/.test(r), r)
  })
  await step('[clean-and-confirm 2.3]', 'the chat closes on Next', async () => {
    await page.click('#tour-next')
    await page.waitForTimeout(600)
    check(await page.$eval('#chat-pop', el => el.hidden), 'chat still open')
  })
  await step('[find-workarounds 2.2] [find-workarounds 2.4]', 'the notes only AI can read', async () => {
    for (const n of [2, 3]) await tourStop(page, new RegExp(`${n} of 3`)), await press(page, '#tour-next')
    await tourStop(page, /only ai/i)
    check((await page.$$('#tour .h-ai li')).length >= 3, 'too few notes')
    await press(page, '#tour-next')
  })
  await step('[find-workarounds 3.3]', "Boo's plan follows what you said", async () => {
    await tourStop(page, /plan/i)
    check(/lose any money/i.test(await text(page, '#tour h2')), 'plan ignores the priority')
    await press(page, '#tour-next')
  })
  await step('[clean-and-confirm 1.1] [clean-and-confirm 1.2]', 'old and new on one screen, choices work', async () => {
    await page.waitForSelector('#go', { timeout: 60000 })
    check(await page.$eval('#pop', el => el.scrollHeight <= el.clientHeight + 2), 'confirm needs a scroll')
    const second = await page.$('#confirm [data-c="1"]')
    await second.click()
    check((await second.getAttribute('aria-pressed')) === 'true', 'choice did not select')
  })
  await step('[clean-and-confirm 3.4]', 'any package expiry, from the chat', async () => {
    const r = await ask(page, 'packages expire in 3 months')
    check(/3 months/.test(r), r)
    check(/3 months/.test(await text(page, '#confirm')), 'no 3 month option')
  })
  await step('[clean-and-confirm 3.1] [clean-and-confirm 3.5]', 'changes made, and only real ones claimed', async () => {
    const r = await ask(page, 'raise the Balayage price to 260 and make Siti Fernandez a VIP')
    check(/Done: Balayage/.test(r) && /Done: Siti Fernandez/.test(r), r)
    await page.click('#chat-close')
  })
  await step('[clean-and-confirm 1.3] [clean-and-confirm 1.4]', 'clean, then wait', async () => {
    await page.click('#go')
    await page.waitForSelector('#live .h-next', { timeout: 120000 })
  })
  await step('[swarm-migration 1.1] [swarm-migration 1.2] [swarm-migration 1.3] [swarm-migration 1.4]', 'the swarm moves everything through the forms', async () => {
    await page.click('#live .h-next')
    await waitText(page, '#cap-title', /Added/, 120000)
    await page.waitForSelector('#receipt:not([hidden])', { timeout: 300000 })
  })
  await step('[swarm-migration 2.1] [swarm-migration 2.2] [swarm-migration 2.3] [proof-certificate 1.1] [proof-certificate 3.1]', 'proof and a sealed certificate', async () => {
    check(/100\/100 checks match/.test(await text(page, '#receipt')), await text(page, '#receipt'))
    await waitText(page, '#seal', /AT REST/, 15000)
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#cert-save')])
    const cert = JSON.parse(readFileSync(await dl.path(), 'utf-8'))
    check(cert.verdict === 'AT REST' && cert.seal.length === 64, 'bad certificate')
  })
  await step('[collect-old-app 3.4]', 'the change asked for before reading reached Idle', async () => {
    check(/rachel\.yeo@newmail\.com/.test(await text(page, '#pane-idle .idle-view.on')), 'held change missing')
  })
  await step('[clean-and-confirm 3.6]', 'a change after the move lands in Idle', async () => {
    const r = await ask(page, "Kenji Rahman's allergy is actually latex, not PPD")
    check(/Done/.test(r), r)
    check(/Latex/i.test(await text(page, '#pane-idle .idle-view.on')), 'not in Idle')
    await page.click('#chat-close')
  })
  await step('[export-anywhere 1.1] [export-anywhere 2.1] [export-anywhere 3.1]', 'send to Google Contacts, proved', async () => {
    await page.click('#export-open')
    await press(page, '#export [data-preset="google-contacts"]')
    await page.waitForSelector('#export-save', { timeout: 20000 })
    const lines = await text(page, '#export-result .h-proof-lines')
    check(/42 of 42 rows/.test(lines) && !/✖/.test(lines), lines)
    await page.click('#export-back')
  })
  await step('[seance-and-afterlife 1.1] [seance-and-afterlife 1.2]', 'nothing buried until you choose; the séance opens', async () => {
    check(!(await page.$('.tombstone')), 'buried without asking')
    await page.click('#seance-open')
    await page.waitForSelector('#seance:not([hidden])')
    check(/health alerts in my names/.test(await text(page, '#seance-log')), 'no opening')
  })
  await step('[seance-and-afterlife 1.3] [seance-and-afterlife 1.4]', 'the dead app answers from its records', async () => {
    await page.fill('#seance-q', 'how many customers did you have?')
    await page.press('#seance-q', 'Enter')
    await page.waitForFunction(() => !document.querySelector('#seance-log i'), null, { timeout: 30000 })
    check(/42/.test(await text(page, '#seance-log')), await text(page, '#seance-log'))
    check(await inWindow(page, '#pop'), 'séance does not fit')
  })
  await step('[seance-and-afterlife 2.1] [swarm-migration 3.1] [swarm-migration 3.2] [swarm-migration 3.3]', 'laid to rest', async () => {
    await page.click('#seance-rest')
    await page.waitForSelector('.tombstone', { timeout: 20000 })
    check(await page.$eval('#pane-slotly', el => el.hidden), 'old app still there')
    check(await page.$eval('#chapters', el => el.hidden), 'phase bar still showing')
  })
  await step('[seance-and-afterlife 3.1] [seance-and-afterlife 3.2] [seance-and-afterlife 3.4] [seance-and-afterlife 3.6]', 'the afterlife catches a client habit', async () => {
    await press(page, '#try-habit')
    await page.waitForTimeout(3500)
    await page.click('#pane-idle .idle-view.on form [type="submit"]')
    await page.waitForSelector('#try-habit', { timeout: 20000 })
    check(/VIP/.test(await text(page, '#receipt')) && /store credit/.test(await text(page, '#receipt')), await text(page, '#receipt'))
  })
  await step('[seance-and-afterlife 3.3]', 'and a product sold as a service', async () => {
    await page.click('#try-habit')
    await page.waitForTimeout(3000)
    await page.click('#pane-idle .idle-view.on form [type="submit"]')
    await page.waitForSelector('#try-habit', { timeout: 20000 })
    check(/is a product/.test(await text(page, '#receipt')), await text(page, '#receipt'))
  })
})

// ------------------------------------------------------------- raise anything

async function raiseSample(page, step, { sample, target, minChecks }) {
  await step('[raise-anything 1.4] [raise-anything 1.1] [raise-anything 1.2]', `pick the ${sample} sample`, async () => {
    await page.click(`[data-sample*="${sample}"]`)
    await page.waitForSelector('#raise .h-next', { timeout: 90000 })
    check(/rows/.test(await text(page, '#raise')), 'nothing read')
    await page.click('#raise .h-next')
  })
  await step('[raise-anything 2.1] [raise-anything 2.2] [raise-anything 5.1]', `it knows what the rows are: ${target}`, async () => {
    await page.waitForSelector('#raise [data-target]', { timeout: 30000 })
    const chosen = await page.$eval('#raise [data-target][aria-pressed="true"]', el => el.dataset.target)
    check(chosen === target, `went to ${chosen}, not ${target}`)
    check(await inWindow(page, '#raise .h-next'), 'button out of reach')
    await page.click('#raise .h-next')
  })
  await step('[raise-anything 3.1]', 'what was hidden', async () => {
    await page.waitForSelector('#raise .h-next', { timeout: 30000 })
    check((await page.$$('#raise .h-map li')).length >= 2, 'too little found')
    await page.click('#raise .h-next')
  })
  for (let i = 0; i < 2; i++) {
    await page.waitForSelector('#raise .h-next', { timeout: 60000 })
    if (/migrate/i.test(await text(page, '#raise .h-next'))) break
    await page.click('#raise .h-next')
  }
  await step('[raise-anything 4.1] [raise-anything 5.2] [raise-anything 4.2]', `into Idle ${target}, proved`, async () => {
    await page.click('#raise .h-next')
    await page.waitForSelector('#receipt:not([hidden]) #rest', { timeout: 90000 })
    const t = await text(page, '#receipt')
    const m = /(\d+)\/(\d+) checks match/.exec(t)
    check(m && m[1] === m[2] && Number(m[2]) >= minChecks, t)
    await waitText(page, '#seal', /AT REST/, 15000)
  })
}

await scenario('paper', async (page, step) => {
  await raiseSample(page, step, { sample: 'paper', target: 'clients', minChecks: 4 })
  await step('[raise-anything 3.3]', 'crossed out on paper is left out', async () => {
    check(!/2210/.test(await text(page, '#pane-idle .idle-view.on')), 'crossed-out number came through')
  })
})

await scenario('menu', async (page, step) => {
  await raiseSample(page, step, { sample: 'sushi', target: 'products', minChecks: 3 })
  await step('[raise-anything 5.2]', 'menu items land in Products, prices clean', async () => {
    const t = await text(page, '#pane-idle .idle-view.on')
    check(/Products/.test(t) && /Dragon Roll/.test(t) && !/★/.test(t), t.slice(0, 300))
  })
  await step('[export-anywhere 1.1] [export-anywhere 3.1] [export-anywhere 3.3]', 'send to Shopify, proved, and downloaded by name', async () => {
    await page.click('#export-open')
    await press(page, '#export [data-preset="shopify-products"]')
    await page.waitForSelector('#export-save', { timeout: 20000 })
    const lines = await text(page, '#export-result .h-proof-lines')
    check(/prices \$/.test(lines) && !/✖/.test(lines), lines)
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#export-save')])
    check(dl.suggestedFilename() === 'shopify-products-import.csv', dl.suggestedFilename())
    await page.click('#export-back')
  })
  await step('[seance-and-afterlife 3.7]', 'the afterlife uses this menu\'s own habits', async () => {
    await page.click('#rest')
    await page.waitForSelector('#try-habit', { state: 'visible', timeout: 30000 })
    check(/item|dish|menu/i.test(await text(page, '#try-habit')), await text(page, '#try-habit'))
    await page.click('#try-habit')
    await page.waitForTimeout(3500)
    await page.click('#pane-idle .idle-view.on form [type="submit"]')
    await page.waitForSelector('#try-habit', { timeout: 20000 })
    check(/Featured|allergens|tags/.test(await text(page, '#receipt')), await text(page, '#receipt'))
  })
})

await scenario('gym', async (page, step) => {
  await raiseSample(page, step, { sample: 'fittrack', target: 'clients', minChecks: 4 })
})

await scenario('wide', async (page, step) => {
  await step('[raise-anything 1.3] [raise-anything 2.4]', 'a 20-column export keeps its button in reach', async () => {
    const headers = ['Type', 'ID', 'Created', 'Description', 'Amount', 'Currency', 'Converted Amount', 'Fees', 'Net', 'Converted Currency', 'Details', 'Customer ID', 'Customer Email', 'Customer Name', 'pending_store_id (metadata)', 'platform', 'Card', 'Status', 'Source', 'Transfer']
    const rows = [headers.join(','), ...[1, 2, 3].map(i => headers.map((h, j) => (h === 'Customer Name' ? `Person ${i}` : h === 'Customer Email' ? `p${i}@x.com` : `v${i}${j}`)).join(','))].join('\n')
    await page.setInputFiles('#raise-file', { name: 'transfers.csv', mimeType: 'text/csv', buffer: Buffer.from(rows) })
    await page.waitForSelector('#raise .h-next', { timeout: 30000 })
    check(await inWindow(page, '#raise .h-next'), 'button out of reach on collect')
    await page.click('#raise .h-next')
    await page.waitForSelector('#raise [data-target]', { timeout: 30000 })
    check(await inWindow(page, '#raise .h-next'), 'button out of reach on columns')
    check(/Customer Name/.test(await text(page, '#raise')), 'name column not shown')
  })
  await step('[raise-anything 5.3]', 'tap another destination and it is used', async () => {
    await page.click('#raise [data-target="team"]')
    check((await page.$eval('#raise [data-target="team"]', el => el.getAttribute('aria-pressed'))) === 'true', 'not chosen')
    check(await inWindow(page, '#raise .h-next'), 'button lost after switching')
  })
})

mkdirSync(HERE, { recursive: true })
writeFileSync(join(HERE, 'last-run.json'), JSON.stringify({ at: new Date().toISOString(), results }, null, 2) + '\n')
const failed = results.filter(r => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} steps passed`)
process.exit(failed.length ? 1 : 0)
