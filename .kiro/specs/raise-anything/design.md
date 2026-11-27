# Design Document

## Overview

A drop zone and two samples on the start card. Files are read in the browser; only photos and a few sample rows go to Gemini. The rules for old habits live in `web/habits.js`, shared with the afterlife. The same five phases run, with the dropped file shown where the old app was.

## Architecture

```
drop / sample ──► sourceFrom(file)
                    ├─ image: shrink to 1600px ──► /api/read-image ──► { headers, rows, kinds, recordKind }
                    └─ CSV:   parseCsv ──► guessKinds ──► /api/map-columns (refine)
                                         ▼
                          raise({ headers, rows, kinds })     web/raise.js
                            uses readName / readPhone / readNotes   web/habits.js
                                         ▼
          findingsFromRaise ──► unclear notes ──► thinkAboutNotes ──► clean
                                         ▼
                syncRaised() into the new app ──► checks ──► clients.csv, packages.csv
```

## Components and Interfaces

- `parseCsv(text)` and `toCsv(rows)`: quotes, commas, tabs, semicolons, line breaks inside quotes.
- `guessKinds(headers, rows)`: heading and value rules; Gemini refines through `mapColumnsAi`.
- `raise({ headers, rows, kinds })` returns `{ records, found }`; `findingsFromRaise(found)` returns findings in the demo's shape.
- `cleanFiles(records)` returns `{ 'clients.csv', 'packages.csv' }`.
- Server: `cleanReadImageRequest` / `readImage`, `cleanMapRequest` / `mapColumns` in `src/agent/ai.js`.

## Data Models

Column kinds: `name, phone, email, date, money, number, note, category, unknown`. Raised record: `{ row, name, phone, email, vip, alert, credit, packages, notes }`.

## Error Handling

- A photo Gemini cannot read ends with "The spirits couldn't read this one" and a Start again button.
- Unknown kinds from Gemini fall back to the guess; if no column is a name, the first column is.
- The chat works on raised data: questions use it, and changes go through `applyEdits` like the demo.

## Testing Strategy

- Property test: any table round-trips through `toCsv` and `parseCsv`.
- The gym sample: every row comes out, names come out clean, every prepaid dollar is found.
- Crossed-out text is left out.
- End to end: the paper book and the gym export both reach 4 of 4 checks.
