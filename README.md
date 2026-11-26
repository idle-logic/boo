# Haunt

**Haunt is an AI agent that switches a business from the software it has outgrown into new software, and proves nothing was lost.**

Salons, spas and clinics stay on booking software they dislike because leaving it hurts. The export, if there is one, has names and phone numbers. It does not have package balances, store credit, client notes, staff skills, deposits, clean-up times or cancellation rules. There is rarely an API. So someone retypes it all for days, and something always gets lost.

Haunt does the switch the way a careful person would, only faster: it reads every screen of the old app, enters everything into the new app through the new app's own screens, then proves the two give the same answers.

## Try it in your browser

Open the live demo from the link in this repo's About box. A salon, Maple & Mint, is on "Slotly" (a made-up booking app) and is switching to Idle. Press **Start the switch**:

1. **Read.** Haunt opens all 42 client profiles, the services, the team, the cancellation rules and the upcoming bookings in Slotly. Slotly is only read, never changed.
2. **Plan.** AI maps Slotly's categories onto Idle's ("Colour Services" to Colour), turns health notes into alerts ("Allergic to PPD", "Pregnant") and spots a stylist entered twice under two names with one phone number. It asks you about that one, while the work carries on.
3. **Move.** Three agents work in Idle at once: one sets up rules, services and the team, one adds clients, one adds packages and bookings. Each has its own cursor. Click **Watch** to follow any of them.
4. **Prove.** The same test booking for every service, made in both apps side by side, comparing price, end time, deposit and cancellation fee. Five services end ten or fifteen minutes earlier in Idle: Slotly adds clean-up time that only shows inside each service, not in its services list. Haunt finds it, sets the same buffer in Idle and checks again. Then it reads every client, package, booking, team member and rule back from Idle's screens.

It finishes in about a minute with a receipt: 42 clients, 9 prepaid packages worth $2,070, $265 of store credit, 15 health alerts, 12 services, 4 team members, 18 bookings and 4 rules, with 89 of 89 checks matching.

Both apps in the demo run on one page, so anyone can try it. Add `?speed=0.3` to the address to watch it faster.

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

- Whatever the AI answers, only answers that fit the question get through: real categories, real notes, real staff.
- Merging a duplicate keeps everything they did and moves their bookings.
- Every record has a place in the new app, and none is dropped.
- A missing clean-up time always shows up as a different end time, which is how the proof finds it.
- The real-software agent can never type into a password field or act on a look-alike address.

## How it is organised

```
web/            the browser demo, built into site/
                slotly.js (the old app), idle.js (the new app), hands.js (an agent's cursor and hands),
                plan.js (the plan and its checks), switch.js (read, plan, move, prove), main.js (the page)
src/agent/      the agent loop and the AI calls (Gemini), shared by the demo and the real-software agent
src/main/       the real-software agent: Windows UI Automation hands, allowed addresses, desktop overlay
netlify/        /api/plan and /api/think for the live demo
tests/          property-based tests
.kiro/          steering and MCP settings
```

## Licence

MIT
