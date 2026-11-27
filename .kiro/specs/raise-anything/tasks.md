# Implementation Plan

- [x] 1. Drop zone and samples on the start card
  - CSV, TSV, PNG, JPG, WEBP; a paper client book photo and a gym's 2008 export as samples; Slotly stays the default
  - _Requirements: 1.4, 1.5_

- [x] 2. Read files in the browser
  - `parseCsv`, `toCsv`; size and row limits with a plain message; photos shrunk before upload
  - Property test: tables survive the round trip
  - _Requirements: 1.1, 1.3_

- [x] 3. Read photos with Gemini
  - `/api/read-image`: copy the table as written, keep every mark, wrap crossed-out text in `~~`
  - _Requirements: 1.2, 3.3_

- [x] 4. Map columns
  - `guessKinds`, then `/api/map-columns`; examples beside each column; unknown kinds fall back
  - _Requirements: 2.1, 2.2, 2.3_

- [x] 5. Old habits in any data
  - `web/habits.js`: names, phones, four package formats, credit, alerts, money owed kept apart
  - Test: the gym sample's prepaid total is exact (this test found the "PT pack: 4 left of 12" format)
  - _Requirements: 3.1, 3.4_

- [x] 6. Notes only AI can read
  - Same `think-about` path and checks as the demo
  - _Requirements: 3.2_

- [x] 7. Into the new app, with proof and clean files
  - `syncRaised()` in batches; four checks; `clients.csv` and `packages.csv`; nothing stored on the server
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [ ] 8. Correct a column from the chat
  - "The Plan column is notes" changes the mapping before the hunt
  - _Requirements: 2.1_

- [ ] 9. XLSX files
  - Read the first sheet in the browser
  - _Requirements: 1.1_
