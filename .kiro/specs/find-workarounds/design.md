# Design Document

## Overview

Rules first, AI second, checks always. `readWithRules(seen)` returns a full reading instantly. Gemini runs in the background on two jobs: a full reading (`/api/read`) and the unclear notes plus Boo's plan (`/api/think-about`). Both are validated in the browser before anything is used.

## Architecture

```
seen ──► readWithRules ──► read ──► findingsFor ──► tour (3 reveals)
   │                         ▲
   ├─► askGeminiToRead ──► mergeReading (grounded only)
   │
   └─► unclear notes ──► thinkAboutNotes ──► "Only AI could read these"
                                   └──────► "Boo's plan"
```

## Components and Interfaces

- `readWithRules(old)` returns `{ clients, services, products, staff, sameStaff, bookings, cleanups, breaks, policies }`.
- `mergeReading(old, rules, ai)` keeps an AI answer only when `grounded(n, text)` holds.
- `findingsFor(old, read)` returns findings `{ key, title, count, from, to, choices, value }`.
- Server: `cleanThinkAboutRequest`, `thinkAbout` in `src/agent/ai.js`. Browser: `thinkAboutNotes({ unclear, needs, found })` in `web/ai.js`.

## Data Models

Unclear note result: `{ src, text, meaning, kind: 'prepaid' | 'credit' | 'flag' | 'note', sessions, service, amount, flag }`.

## Error Handling

- Gemini calls retry once, then fall back to rules. The chip says "The spirits are busy · Boo read it all alone".
- Unknown kinds are dropped; ungrounded numbers demote the note to `note`.

## Testing Strategy

- Rules reading matches the hidden truth for every customer.
- An ungrounded AI merge is rejected; a grounded one is used.
- `thinkAboutNotes` drops unknown kinds and turns invented numbers back into notes.
