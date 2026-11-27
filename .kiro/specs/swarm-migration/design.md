# Design Document

## Overview

`idleRecords(read, decisions)` turns the cleaned reading into the new app's form values. `crewsFor(records)` shares the work into crews; `move()` runs them all at once, each in its own view of the new app, using `hands.js`. `prove()` reconciles the result.

## Architecture

```
read + decisions ──► idleRecords ──► crewsFor ──► split Boo into crews
                                                     │
                                         move() all crews at once
                                         (ready() waits on dependencies)
                                                     │
                                                 prove() ──► receipt
                                                     │
                                               layToRest() ──► headstone
```

## Components and Interfaces

- `idleRecords(read, d)` returns `{ clients, services, products, staff, packages, bookings, policies, merged }` keyed by form labels.
- `crewsFor(records)` returns crews `{ id, name, key, page, open, list, ready }`.
- `move({ crews, lane, store, ui, speed })` enters each record through the form; `ui.moved` reports progress.
- `prove({ seen, read, records, d, p, ui })` returns `{ matched, checks, lines }`.
- `layToRest()` buries the old pane and adds the headstone.

## Error Handling

- Packages and bookings wait on `ready()` until their client, service and team member exist.
- Re-finding elements before each press avoids clicking stale buttons after a redraw.

## Testing Strategy

- Owner decisions change the records (expiry, merge, alerts, credit).
- End to end: 100 of 100 checks match; the headstone shows and the old app is hidden.
