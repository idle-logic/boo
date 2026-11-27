# Boo

**Switch software. Lose nothing.** When old software dies, your data dies with it. Boo brings it back to life in new software: any old system to any new one.

Old software can't hold everything, so teams hide data where it doesn't belong: credit and prepaid passes in notes, allergies in names, products sold as fake services, blocked time as fake appointments, rules as a paragraph of text. Dying software often has no export at all, and an export would copy the mess anyway. Boo reads the old app screen by screen, works out what every workaround really is, cleans it into the new app's proper fields, moves it, and proves nothing was lost.

## Try it in your browser

Open the live demo from the link in this repo's About box and press **Play**. The example is a salon leaving "Slotly", a made-up booking app from 2011 that is shutting down with no export, for Idle. The same ghosts haunt CRMs, inventory, accounting and HR systems.

Boo first asks what matters most to you. Then five phases, each waiting for you to press Next:

1. **Collect** · *Rise of the Dead.* Boo reads every screen of the old app. No export, no API.
2. **Analyse** · *Ghosts in the Notes.* Boo shows the hidden data in the old app. Gemini reads the notes no rule can, and writes Boo's plan from what it found and what you said matters.
3. **Clean** · *The Exorcism.* One screen: old → new for every kind of hidden data. Pick the real choices, or tell Boo.
4. **Migrate** · *Back from the Dead.* A swarm of ghosts enters everything at once through the new app's own screens.
5. **Verify** · *Rest in Peace.* Every record and every dollar is checked. The old app is buried; its data lives on.

Then finish the story: **hold a séance** and ask the dying app why it hid allergies in names (Gemini plays it, from its own records), **lay it to rest**, and watch the **afterlife**: the old app's ghost stays in the new app for 30 days, and when anyone types an old habit (a ★ in a name, credit in a note, a product sold as a service) it rises from its grave and fixes it.

**Raise your own.** On the start card, drop a CSV export from any software, a screenshot, or a photo of paper, or try a sample: a nail studio's handwritten client book, a sushi bar's chalkboard menu, a gym's 2008 member export. Boo works out what the rows are and where they belong (people become clients, a menu becomes products, a staff list becomes the team), finds what was hidden (★ and VIP marks, allergies, "SOLD OUT", prices with words, credit and prepaid packages in notes, crossed-out numbers on paper), moves it into the new app and proves it. The afterlife then catches that file's own habits.

**Send it anywhere.** At the end, "Send to another app" writes the clean records in any app's import format: Google Contacts, Shopify, Mailchimp, an online menu, or any other app by dropping its import template or an export from it. Boo matches their columns, puts anything without a column in their notes column, then reads the file back and checks every row, name and dollar before you download it.

**Proof.** Every switch ends with a certificate: what should have arrived against what did, record set by record set and dollar by dollar, sealed with SHA-256. Download it, and anyone can check it with `boo verify`, or replay it from the source file.

Tap Boo at any moment to ask about the data ("who has the most visits?") or change anything ("Balayage costs $260 now", "add a client called…", "packages expire in 3 months"). Every change is checked against the data first, and Boo never claims a change it didn't make. When Boo isn't working it roams the page: throw it, double-tap it, or leave it alone and it naps in the corner.

## How Boo uses Kiro

Kiro keeps the promise "lose nothing" while Boo is built. The full write-up, with every file and how to see it working, is in [docs/KIRO.md](docs/KIRO.md).

- **11 specs** in [`.kiro/specs/`](.kiro/specs): 132 WHEN/THEN acceptance criteria, 126 of them named by a test or a browser step (`node bin/boo.mjs coverage --list` shows the six left).
- **10 steering files** in [`.kiro/steering/`](.kiro/steering): the product, proof, grounded AI, calm UI, Boo's voice, security, a public repo, testing and old habits.
- **8 hooks** in [`.kiro/hooks/`](.kiro/hooks). Three block: a proof gate that refuses git commit or push when a certificate is STILL HAUNTED or changed, a stop check that sends the agent back to work, and a public repo check. Five act on save: run the tests, re-certify, trace new criteria to tests, keep specs in sync, check Boo's voice. The same gates run in `.githooks/pre-commit` and in CI.
- **A custom agent**, [`boo-migrator`](.kiro/agents/boo-migrator.json), with **three skills** in [`.kiro/skills/`](.kiro/skills): workaround hunting, grounded AI, the migration workflow.
- **An MCP server** ([`mcp/server.js`](mcp/server.js), 9 tools) and a **Power**, [`powers/boo-migrate`](powers/boo-migrate), so any Kiro user can raise their own exports and get a sealed certificate.

## Use it for your own switch

Boo is MIT licensed and built to be reused. Every workaround it knows is a small, plain rule in `web/interpret.js`: what the hidden data looks like in the old app ("credit $80" in a note, "★" in a name) and where it belongs in the new one. To teach Boo your software:

1. Try it as it is: `node bin/boo.mjs raise your-export.csv` writes clean files and a certificate. In Kiro, install the `boo-migrate` Power and ask the agent to raise it.
2. Found a hiding place Boo doesn't know? Add it to `web/habits.js` with a test that names its criterion (see `tests/proof.test.js`).
3. Run `npm test` and `node bin/boo.mjs gate`. Gemini handles the messy cases; your rules and the certificates keep it honest.

### The command line

```bash
node bin/boo.mjs raise export.csv [--out dir]     # clean CSVs + a sealed certificate (photos need GEMINI_API_KEY)
node bin/boo.mjs verify certificate.json [source] # is the seal intact? replay it from the source
node bin/boo.mjs gate                             # every committed certificate AT REST and unchanged
node bin/boo.mjs coverage --list                  # acceptance criteria and the checks that name them
```

## Boo on real software

The same approach runs on a real computer through Windows UI Automation, the layer screen readers use, so it works on any app with no plugin or API. `tools/connector-run.mjs` drives real apps in Edge with the same agent loop. In testing it answered questions and made bookings in a demo booking app open in Edge, and read Idle's staging site. It has never been pointed at live Idle.

```bash
GEMINI_ENV_FILE=path/to/.env node tools/connector-run.mjs "<window title>" "<what to do>"
```

## Safety

- The old app is only read.
- Password fields are never read or typed into.
- The real-software agent only works on addresses you allow (`HAUNT_ALLOW`), and live Idle is never on that list.
- Every AI answer is checked before use, and plain rules stand in when the AI is unavailable.

## Run the demo locally

```bash
npm install
node tools/build-site.mjs
GEMINI_ENV_FILE=path/to/.env node tools/serve-site.mjs 4317
```

The AI planning step uses a free Gemini key from [Google AI Studio](https://aistudio.google.com), in `GEMINI_API_KEY`. Without one, Boo plans with built-in rules and says so.

## Checks

```bash
npm test             # 74 unit and property tests (node:test + fast-check)
npm run gate         # the demo engine against its hidden truth, and the gym sample, both AT REST
npm run coverage     # 126 of 132 acceptance criteria named by a check
npm run serve        # then: npm run e2e  (46 browser steps in Edge: the demo, a paper book, a menu photo, a gym export, a 20-column export)
```

Among them:

- Every workaround in the notes and names reads back to the real record, and the demo engine matches its hidden truth to the dollar.
- Whatever Gemini answers, nothing ungrounded in the original text gets through.
- A certificate with one changed byte fails its seal; a raise replays to the same certificate.
- An export with no column for credit fails its proof instead of losing it.
- The real-software agent can never type into a password field or act on a look-alike address.

## How it is organised

```
web/            the browser demo, built into site/
                slotly.js (the old app), idle.js (the new app), survey.js (collect),
                interpret.js (analyse), edits.js (checked changes from the chat),
                habits.js (old habits in any data), raise.js (raise your own data),
                destinations.js (into any app), certificate.js (sealed proof),
                switch.js (migrate and verify), ghost.js, pet.js and intro.js (Boo), main.js (the page)
bin/boo.mjs     the command line; src/boo/engine.mjs is its engine
certificates/   sealed results the proof gate replays on every commit
src/agent/      the agent loop and the AI calls (Gemini), shared by the demo and the real-software agent
src/main/       the real-software agent: Windows UI Automation hands, allowed addresses, desktop overlay
netlify/        /api/read, /api/think-about, /api/chat, /api/ask, /api/seance, /api/read-image,
                /api/map-columns and /api/map-template (Gemini) for the live demo
mcp/            Boo's MCP server for Kiro's agent
tests/          unit and property tests; tests/e2e/ the browser steps
.kiro/          specs, steering, hooks, the boo-migrator agent, skills and MCP settings
powers/         the boo-migrate Power
docs/KIRO.md    how Boo uses Kiro
```

## Licence

MIT
