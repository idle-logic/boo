---
inclusion: always
---

# Grounded AI

Gemini reads what rules can't (photos, notes in no fixed shape, plain-word questions and changes, the dying app's voice). It never decides alone.

- Rules first; Gemini is merged when it answers. Every phase works without it.
- A number Gemini gives must appear in the source text. A kind, a target, a field or a column type must be on a fixed list. Otherwise it is dropped.
- Every change from the chat goes through `web/edits.js` before it touches data; refusals are shown with the reason.
- Boo never claims a change that did not happen (`honest()` in `web/main.js`).
- The key lives only on the server (`netlify/functions/ai.mjs`, `tools/serve-site.mjs`). Free-tier flash-lite models, one retry, then rules.

See the `grounded-ai` skill for the full checklist.
