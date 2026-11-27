---
inclusion: always
---

# Tech

## The web demo (what ships)

- Plain ES modules in `web/`, no framework and no bundler. `tools/build-site.mjs` copies them to `site/` with the shared renderer files.
- `web/main.js` runs the five phases and owns the popups, Boo and the chat. Keep phase logic there and pure logic in its own module.
- `web/slotly.js` is the old app and `web/idle.js` the new one. Both are real, clickable apps; Boo uses them through `web/hands.js` like a person, by labels, never by reaching into their state.
- `web/interpret.js` reads the old app with rules and merges Gemini's reading. `web/switch.js` builds the new records, the crews and the proof. `web/edits.js` checks every change asked for in the chat.
- Gemini runs only on the server: `netlify/functions/ai.mjs` (and `tools/serve-site.mjs` locally) route `/api/read`, `/api/chat`, `/api/think-about` and `/api/ask` to `src/agent/ai.js`. The key never reaches the browser.
- Boo the roaming ghost is `web/pet.js` on top of `src/renderer/world.js` (physics) and `src/renderer/brain.js` (behaviour). Both are pure, with no DOM.

## Rules

- Every AI answer is validated in the browser before use: numbers must appear in the source text, names must exist, kinds must be known.
- If Gemini is busy or missing, the demo still works on rules alone and says so.
- No secrets in the repo. `.env.local` is ignored.

## Quality bar

- `npm test` runs every test (node:test + fast-check). Anything that reads, cleans, changes or proves data needs a test.
- Run the site locally with `node tools/serve-site.mjs 4317` and play it to the end before calling a change done.
