# Design Document

## Overview

Collecting is a scripted walk through the old app using `web/hands.js`, the same label-based hands the migration crews use. The old app (`web/slotly.js`) is a real, clickable app; Boo never reads its internal state.

## Architecture

```
Play ──► Boo asks what matters (chat at Boo) ──► Start
             │
             ▼
survey({ r: reader, ui, speed })        web/survey.js
   ├─ customers  (paged, first 3 slow)
   ├─ services · staff · appointments
   └─ reports · settings (terms text)
             │
             ▼
seen = { customers, services, staff, appointments, terms, sales }
             │
             ▼
"Read from Slotly" popup ──► Next: analyse it
```

## Components and Interfaces

- `survey({ r, ui, speed, business })` returns `seen`, the raw records exactly as shown.
- `glance(r, selector, n, ms)` gives a short visible pass over a part without dwelling.
- `ui.collected({ title })` adds one tally line per part.
- `openChat({ question, chips })` places the chat beside Boo; `wantNeeds` receives each message during the asking step.
- `isQuestion(message)` separates questions from priorities; `act(out)` makes or holds any change.

## Data Models

`seen.customers[i] = { name, mobile, email, visits, lastVisit, notes }`, unchanged from the screen, including tags like `**VIP**` and notes like `5x blowdry pkg, 1 used`.

## Error Handling

- Missing screens are skipped with a caption, never a crash.
- If Gemini is unavailable during the asking step, Boo answers with a plain acknowledgement.

## Testing Strategy

- Unit: the rules reading of `seen` matches the hidden truth for every customer (`tests/haunt.test.js`).
- End to end: a headless Edge run plays the asking step and Phase 1 and checks the popup counts.
