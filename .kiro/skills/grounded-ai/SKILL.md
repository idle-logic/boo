---
name: grounded-ai
description: How Boo uses Gemini without ever letting it invent a record, a number or a change
---

# Grounded AI

Gemini does the work rules can't: reading a photo of a paper book, the notes in no fixed shape, a question in plain words, a change asked for in a chat, the dying app's voice in the séance. It is never trusted as is.

## The rules

1. **Rules first.** Every phase works on rules alone. Gemini runs in the background and is merged only when it answers, so the demo never waits on it and never breaks without it.
2. **Every number must be in the source.** An amount or a session count Gemini gives is used only if it appears in the original note (`thinkAboutNotes` in `web/ai.js`, `mergeReading` in `web/interpret.js`). Otherwise the note stays a note.
3. **Every kind must be known.** Column kinds, note kinds and edit targets are checked against fixed lists. Anything else falls back to the rules' guess or is refused.
4. **Every change is checked before it applies.** Chat edits go through `web/edits.js`: the record must exist, the field must be known, the value must fit. Refusals are shown with the reason.
5. **Never claim what didn't happen.** If Boo's reply says "updated" but nothing changed, the chat says "Nothing was changed" (`honest()` in `web/main.js`).
6. **Key stays on the server.** Gemini is called only from `netlify/functions/ai.mjs` and `tools/serve-site.mjs`. The browser never sees `GEMINI_API_KEY`.
7. **Free tier.** Flash-lite models with a fallback list; one retry; then rules.

## Checking your work

- `npm test` includes tests that feed Gemini invented numbers and unknown kinds and expect them refused.
- In the app, the Gemini chip shows how many AI answers were checked and used.
