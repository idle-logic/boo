// Run the universal connector without the ghost: the same hands and brain the
// desktop app uses, from the command line. Handy for testing on a machine
// where the desktop app cannot start.
//
//   GEMINI_ENV_FILE=path/to/.env node tools/connector-run.mjs "<window title part>" "<what to do>"
//
// Set HAUNT_AUTOPILOT=1 to say yes to every approval.
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { Hands } from '../src/main/hands.js'
import { Operator } from '../src/main/operator.js'
import { loadEnv } from '../src/main/model.js'

loadEnv(join(dirname(fileURLToPath(import.meta.url)), '..'))
const [windowTitle, goal] = process.argv.slice(2)
if (!windowTitle || !goal) {
  console.log('Usage: node tools/connector-run.mjs "<window title part>" "<what to do>"')
  process.exit(1)
}

const hands = new Hands()
const operator = new Operator({
  hands,
  toOverlay: r => r,
  haunt: e => {
    if (e.type === 'guide') console.log(`  > ${e.text || 'acting'}`)
    else if (e.text) console.log(`[${e.type}] ${e.text}`)
  },
  ask: async text => {
    console.log(`  ? ${text} ${process.env.HAUNT_AUTOPILOT === '1' ? 'yes (autopilot)' : 'no (set HAUNT_AUTOPILOT=1 to allow)'}`)
    return process.env.HAUNT_AUTOPILOT === '1'
  },
})
const t0 = Date.now()
const result = await operator.run(goal, { startTitle: windowTitle })
console.log(`\n${result?.ok ? 'DONE' : 'STOPPED'} in ${Math.round((Date.now() - t0) / 1000)}s: ${result?.summary}`)
hands.stop()
