# Implementation Plan

- [x] 1. Old and new on one screen
  - Two-column confirm popup; choices only where a real decision exists; fits without scrolling
  - _Requirements: 1.1, 1.2_

- [x] 2. Choice buttons select their option
  - Delegated click on `#confirm [data-c]`
  - _Requirements: 1.2_

- [x] 3. Clean, then wait
  - Clean rows quickly; "Next: migrate it"
  - _Requirements: 1.3, 1.4_

- [x] 4. Chat at Boo
  - `openChat`, `placeChat` (above, below or beside Boo, inside the window), `holdStill`, close on Next
  - _Requirements: 2.1, 2.3_

- [x] 5. Answers from all the data
  - `recordsNow()` sends counts, the old app, the cleaned reading and the new app
  - Server prompt: always has the data, never says it has not read it
  - _Requirements: 2.2_

- [x] 6. Any change, checked
  - `web/edits.js`: `cleanEdits`, `applyEdits`, `FIELDS`, renames through bookings, add and remove
  - Server passes a list of edits through
  - _Requirements: 3.1, 3.2, 3.3_

- [x] 7. Custom package expiry
  - `change.months` adds and selects a new option
  - _Requirements: 3.4_

- [x] 8. Honest replies
  - `honest()` replaces a false claim with "Nothing was changed"
  - _Requirements: 3.5_

- [x] 9. Changes after the move
  - `storeFrom(idleRecords(read, movedWith), store)`; changes during the move applied when it ends
  - _Requirements: 3.6_

- [x] 10. Tests for checked changes
  - _Requirements: 3.1, 3.2, 3.3_
