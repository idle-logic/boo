# Haunt

**Moving to new software? Your old data is a mess, because your team spent years working around everything the old software couldn't do. Haunt finds those workarounds, cleans and standardises the data, and moves it into the new software with nothing lost.**

Old booking software has no place for allergies, packages, store credit, products, deposits, clean-up time or cancellation rules. So teams improvise: allergies typed into names, packages written in notes, products sold as fake services, "CLEAN UP" appointments booked by hand after every colour, rules kept as a paragraph of text. An export copies that mess straight into the new system, where the new system's proper features never get used.

## Try it in your browser

Open the live demo from the link in this repo's About box. Boo rises from a grave. The first screen sets the scene: Maple & Mint is moving from "Slotly" (a made-up booking app from 2011) to Idle, and here is what each can hold.

1. **Find the mess.** Boo reads Slotly screen by screen, the way a person would: no export, no API. Gemini reads every name, note and description. Boo then walks you to three real workarounds in Slotly, rings the exact text, and the panel says plainly what Slotly lacks and what the text really means.
2. **Clean and standardise.** For each workaround Boo shows the messy Slotly text beside the clean, standard version for Idle, and asks: is this right? Some things change shape (packages need an expiry date), some stay behind (SMS credits), and the owner decides. Then Boo cleans the data one kind at a time while you watch.
3. **Move to Idle.** Three ghosts move the clean data in through Idle's own screens. Then every Slotly record is accounted for and the money read out of notes is matched to the dollar. Ask Boo questions about the salon, answered by Gemini from the moved records.

A caption along the bottom always says what Boo is doing right now. When Boo is not working it roams the page: click it, grab it and throw it.

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
