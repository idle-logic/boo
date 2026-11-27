# Haunt

**Switch software. Lose nothing.** When old software dies, your data dies with it. Haunt brings it back to life in new software: any old system to any new one.

Old software can't hold everything, so teams hide data where it doesn't belong: credit and prepaid passes in notes, allergies in names, products sold as fake services, blocked time as fake appointments, rules as a paragraph of text. Dying software often has no export at all, and an export would copy the mess anyway. Haunt reads the old app screen by screen, works out what every workaround really is, cleans it into the new app's proper fields, moves it, and proves nothing was lost.

## Try it in your browser

Open the live demo from the link in this repo's About box and press **Play**. The example is a salon leaving "Slotly", a made-up booking app from 2011 that is shutting down with no export, for Idle. The same ghosts haunt CRMs, inventory, accounting and HR systems.

Boo first asks what matters most to you. Then five phases, each waiting for you to press Next:

1. **Collect** · *Rise of the Dead.* Boo reads every screen of the old app. No export, no API.
2. **Analyse** · *Ghosts in the Notes.* Boo shows the hidden data in the old app. Gemini reads the notes no rule can, and writes Boo's plan from what it found and what you said matters.
3. **Clean** · *The Exorcism.* One screen: old → new for every kind of hidden data. Pick the real choices, or tell Boo.
4. **Migrate** · *Back from the Dead.* A swarm of ghosts enters everything at once through the new app's own screens.
5. **Verify** · *Rest in Peace.* Every record and every dollar is checked. The old app is buried; its data lives on.

Then finish the story: **hold a séance** and ask the dying app why it hid allergies in names (Gemini plays it, from its own records), **lay it to rest**, and watch the **afterlife**: the old app's ghost stays in the new app for 30 days, and when anyone types an old habit (a ★ in a name, credit in a note, a product sold as a service) it rises from its grave and fixes it.

**Raise your own.** On the start card, drop a CSV export from any software, a screenshot, or a photo of a paper client book, or try the two samples (a nail studio's handwritten book, a gym's 2008 member export). Boo reads it (Gemini reads photos, crossed-out bits and all), works out the columns, finds what was hidden, moves it into the new app, proves the counts and gives you clean CSV files.

Tap Boo at any moment to ask about the data ("who has the most visits?") or change anything ("Balayage costs $260 now", "add a client called…", "packages expire in 3 months"). Every change is checked against the data first, and Boo never claims a change it didn't make. When Boo isn't working it roams the page: throw it, double-tap it, or leave it alone and it naps in the corner.

## How Haunt uses Kiro

Everything Kiro uses lives in [`.kiro/`](.kiro):

- **Specs** in [`.kiro/specs/`](.kiro/specs), one per feature, each with requirements (user stories and WHEN/THEN acceptance criteria), a design and a task list: `collect-old-app`, `find-workarounds`, `clean-and-confirm`, `swarm-migration`, `boo-guide`, `seance-and-afterlife` and `raise-anything` (with its two open tasks).
- **Steering** in [`.kiro/steering/`](.kiro/steering): what Haunt is and its five phases, the tech rules (every AI answer checked before use), calm-first UI rules and Boo's voice.
- **Hooks** in [`.kiro/hooks/`](.kiro/hooks): run the tests when the engine changes, check every new line of text against Boo's voice, and keep the specs' task lists in sync with the code.
- **MCP** in [`.kiro/settings/mcp.json`](.kiro/settings/mcp.json): Haunt's own MCP server ([`mcp/server.js`](mcp/server.js)) gives Kiro's agent the migration engine as tools: `haunt_find_workarounds` on any old app's records, `haunt_check_changes` before applying edits, and `haunt_sample_old_app` to try them.

## Use it for your own switch

Haunt is MIT licensed and built to be reused. Every workaround it knows is a small, plain rule in `web/interpret.js`: what the hidden data looks like in the old app ("credit $80" in a note, "★" in a name) and where it belongs in the new one. To teach Haunt your software:

1. Describe your old app's records and their workarounds, like `slotlyRecords()` in `web/data.js`.
2. Add a rule for each workaround to `web/interpret.js`, and a test that it reads back to the real record (see `tests/haunt.test.js`).
3. Run `npm test`. Gemini handles the messy cases; your rules keep it honest.

## Haunt on real software

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

The AI planning step uses a free Gemini key from [Google AI Studio](https://aistudio.google.com), in `GEMINI_API_KEY`. Without one, Haunt plans with built-in rules and says so.

## Checks

```bash
npm test
```

Property-based tests with fast-check. Among them:

- Every workaround in the notes and names reads back to the real record.
- Whatever Gemini answers, nothing ungrounded in the original text gets through.
- The owner's choices (merge, expiry, keep as a note) are followed exactly.
- The real-software agent can never type into a password field or act on a look-alike address.

## How it is organised

```
web/            the browser demo, built into site/
                slotly.js (the old app), idle.js (the new app), survey.js (collect),
                interpret.js (analyse), edits.js (checked changes from the chat),
                habits.js (old habits in any data), raise.js (raise your own data),
                switch.js (migrate and verify), ghost.js, pet.js and intro.js (Boo), main.js (the page)
src/agent/      the agent loop and the AI calls (Gemini), shared by the demo and the real-software agent
src/main/       the real-software agent: Windows UI Automation hands, allowed addresses, desktop overlay
netlify/        /api/read, /api/think-about, /api/chat, /api/ask, /api/seance, /api/read-image
                and /api/map-columns (Gemini) for the live demo
mcp/            Haunt's MCP server for Kiro's agent
tests/          property-based tests
.kiro/          specs, steering, hooks and MCP settings
```

## Licence

MIT
