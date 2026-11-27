# Design Document

## Overview

Gemini proposes, the browser decides. The chat sends the owner's words with the whole dataset to `/api/chat`; Gemini answers with a reply, an optional decision change and a list of edits. `web/edits.js` checks each edit against the data before it touches anything.

## Architecture

```
tap Boo ──► openChat (placed beside Boo, Boo holds still)
                │
                ▼
chatBoo({ message, stage, decisions, records: recordsNow() })
                │                                  │
                │                     { counts, oldApp, cleaned, newApp }
                ▼
{ reply, change, edits } ──► act(out)
                               ├─ changeDecision (option or custom months)
                               ├─ no reading yet ──► pendingEdits
                               ├─ applyEdits(read, cleanEdits(edits))
                               │      └─ done ──► storeFrom(idleRecords(read, d), store)
                               └─ honest(reply, notes)
```

## Components and Interfaces

- `cleanEdits(raw)` keeps only edits with a known target and shape.
- `applyEdits(read, edits)` returns `{ done: [...], failed: [...] }` in plain words.
- `FIELDS` holds one check per field: text length, number range, yes/no, date, time, category.
- `storeFrom(records, store)` rebuilds the new app's records from the reading, keeping what the app added itself.
- `honest(reply, notes)` blocks claims of changes that did not happen.

## Data Models

Edit: `{ action: 'set' | 'add' | 'remove', target: 'client' | 'service' | 'staff' | 'product' | 'booking' | 'policy', name, date, time, field, value, record }`.

## Error Handling

- Ambiguous bookings ("which date?") are refused with a question.
- Changes asked during the move are applied to the reading and pushed to the new app when the move finishes.

## Testing Strategy

- Valid edits apply; a bad price, an unknown client and a booking for an unknown service are refused.
- A rename carries through to bookings.
- End to end: questions before reading, during the reveals and after the move; changes at every stage land in the new app.
