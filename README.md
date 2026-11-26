# Haunt

**Switch software. Lose nothing.** Haunt moves a business from any old software to any new software.

Old software can't hold everything, so teams hide data where it doesn't belong: credit and prepaid passes in notes, allergies in names, products sold as fake services, blocked time as fake appointments, rules as a paragraph of text. Exports copy that mess into the new system, so switching means days of retyping and lost data. Haunt reads the old app screen by screen, works out what every workaround really is, cleans it into the new app's proper fields, moves it, and proves nothing was lost.

## Try it in your browser

Open the live demo from the link in this repo's About box and press **Play**. It runs by itself in about a minute and a half. The example is a salon moving from "Slotly" (a made-up app from 2011) to Idle.

1. **Rise of the Dead.** Boo reads every screen of the old app. No export, no API.
2. **Ghosts in the Notes.** Gemini reads every name, note and description. Boo shows three pieces of hidden data in the old app, and how each will look in the new one.
3. **The Exorcism.** One screen: old → new for every kind of hidden data. Change anything, or tell Boo in the chat ("Kenji's allergy is latex"). Then it cleans.
4. **Crossing Over.** A swarm of ghosts moves everything at once through the new app's own screens, then every record and every dollar is checked.

Ask Boo anything in the chat box at any time. When Boo is not working it roams the page: click it, throw it, or leave it alone and it naps in the corner.

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
                slotly.js (the old app), idle.js (the new app), survey.js (looking around),
                interpret.js (reading and cleaning the workarounds), switch.js (move and prove),
                ghost.js, pet.js and intro.js (Boo), main.js (the page)
src/agent/      the agent loop and the AI calls (Gemini), shared by the demo and the real-software agent
src/main/       the real-software agent: Windows UI Automation hands, allowed addresses, desktop overlay
netlify/        /api/read and /api/ask (Gemini) for the live demo
tests/          property-based tests
.kiro/          steering and MCP settings
```

## Licence

MIT
