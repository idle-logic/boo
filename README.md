# Haunt

**Your software can't do everything, so your team does it by hand. Haunt finds those workarounds, runs them for you inside the software you already have, and when you are ready to leave, switches you to new software with nothing lost.**

Every business on old software has the same scars: packages written in customer notes, allergies typed into names, products sold as fake services, "CLEAN UP" appointments booked by hand after every colour, cancellation rules that live in a paragraph of text. Each workaround is a feature the software is missing, done manually every day. And when the business finally switches, the workarounds are exactly what gets lost.

## Try it in your browser

Open the live demo from the link in this repo's About box. Boo rises from a grave, then:

**Act one: haunt it.**
1. Boo looks around "Slotly" (a made-up booking app from 2011) screen by screen, the way a person would. No export, no API.
2. Gemini reads every name, note and description and works out what the team really meant. Every answer is checked against the original text before it is used.
3. Boo shows the workarounds it found, with the real text, and offers to run five of them as features inside Slotly: Allergy guard, Package tracker, Auto clean-up, Deposit nudge and VIP welcome.
4. A busy morning at the front desk: Boo stops a colour booking for a client with a PPD allergy, counts a session off a package in the notes, books the clean-up after a balayage, and tells the desk what deposit to take.

**Act two: switch.**
5. When the salon is ready for Idle, Boo shows how each workaround becomes Idle's standard way, side by side ("credit $80" becomes store credit $80), and asks: is this right? Some things change shape (packages need an expiry date), some stay behind (SMS credits), and the owner decides.
6. Three ghosts move everything into Idle through Idle's own screens. Then every Slotly record is accounted for and the money read out of notes is matched to the dollar: 101 checks.
7. Ask Boo questions about the salon, answered by Gemini from the moved records.

For the makers of old software, the same list is a roadmap: the features their customers have been faking.

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
- Counting off a package session keeps the note in the style the team wrote it.
- The owner's choices (merge, expiry, keep as a note) are followed exactly.
- The real-software agent can never type into a password field or act on a look-alike address.

## How it is organised

```
web/            the browser demo, built into site/
                slotly.js (the old app), idle.js (the new app), survey.js (looking around),
                interpret.js (reading the workarounds), features.js (running them), switch.js (move and prove),
                ghost.js and intro.js (Boo), main.js (the page)
src/agent/      the agent loop and the AI calls (Gemini), shared by the demo and the real-software agent
src/main/       the real-software agent: Windows UI Automation hands, allowed addresses, desktop overlay
netlify/        /api/read and /api/ask (Gemini) for the live demo
tests/          property-based tests
.kiro/          steering and MCP settings
```

## Licence

MIT
