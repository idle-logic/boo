// Spike: read a window the way Boo's brain will see it.  node tools/observe-test.mjs "<window title part>"
import { Hands } from '../src/main/hands.js'
const hands = new Hands()
const t0 = Date.now()
let res = await hands.ask({ cmd: 'observe', title: process.argv[2] ?? '', max: 260 }, 30000)
if (res.ok && res.elements.length < 5) res = await hands.ask({ cmd: 'observe', title: '@same', max: 260 }, 30000)
console.log(`ok=${res.ok} ${res.error ?? ''} in ${Date.now() - t0}ms; window="${res.window}" url="${res.url}" elements=${res.elements?.length}`)
for (const e of (res.elements ?? []).slice(0, 40)) console.log(`  ${e.index} ${e.role} "${String(e.name).slice(0, 60)}"${e.value ? ` value="${e.value}"` : ''}${e.selected ? ' (selected)' : ''}`)
hands.stop()
