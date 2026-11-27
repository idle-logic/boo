# Design Document

## Overview

One ghost, three moments: it confesses (séance), it is buried (rest), and it keeps watch (afterlife). The ghost is `createGhost({ colour: 'old' })`, a faded blue palette in `src/renderer/sprites.js`. The afterlife hooks into the new app's own save through `store.guard` and `store.caught`, so it works for any record typed by anyone, not only the demo's.

## Architecture

```
done() ──► receipt: [Hold a séance] [Lay Slotly to rest]
              │
              ├─ openSeance ──► ghost rises ──► seanceOpening(findings)
              │      └─ askTheDead(q) ──► /api/seance ──► reply in the log and the ghost's bubble
              │
              └─ rest() ──► ghost sinks ──► layToRest(name) ──► afterlife = true ──► afterlifeCard()

new app save ──► store.guard(form, values)          web/idle.js submit
                    ├─ client:  fixClient(values)   web/habits.js
                    └─ service: fixService(values)
                 ──► store.caught(caught) ──► hauntTheNewApp: rise, fly to the row, fix, rest
```

## Components and Interfaces

- Server: `cleanSeanceRequest`, `holdSeance` in `src/agent/ai.js`. The persona knows its own records, counts and missing fields, nothing else.
- `seanceOpening()` builds the first line from the findings, so it needs no AI.
- `fixClient(values)` returns `{ values, packages, fixes }` or null; `fixService(values)` returns `{ product, fixes }` or null.
- `tryOldHabit(habit)` types a habit into the real form, letter by letter; the owner presses save.

## Error Handling

- No Gemini: the ghost says the line is crackly; the rest of the ending still works.
- The guard returns null when there is nothing to fix, so normal saves are untouched.

## Testing Strategy

- `fixClient` and `fixService`: the demo habit becomes VIP, alert, credit, phone and a package; a plain client returns null.
- End to end: three séance questions answered with real names and exact counts; the client habit and the product habit are both caught.
