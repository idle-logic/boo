# Implementation Plan

- [x] 1. The old app's ghost
  - `old` palette; `ghostOf(name)` labelled with what died
  - _Requirements: 1.2, 3.4_

- [x] 2. Nothing is buried until the owner chooses
  - Receipt with "Hold a séance" and "Lay Slotly to rest"
  - _Requirements: 1.1_

- [x] 3. The séance
  - `/api/seance` persona; opening line from the findings; chips and free text; last five lines only; crackly-line fallback
  - _Requirements: 1.2, 1.3, 1.4, 1.5_

- [x] 4. Laid to rest
  - Goodbye line, the ghost sinks, `layToRest(name, years)` with the name on the headstone
  - _Requirements: 2.1_

- [x] 5. Old habits caught on save
  - `store.guard` and `store.caught` in the new app's submit; `fixClient`, `fixService` in `web/habits.js`
  - Tests for both, and for a plain client passing untouched
  - _Requirements: 3.1, 3.2, 3.3, 3.5_

- [x] 6. The ghost rises to fix it
  - Out of the grave, to the fixed row (Products for a product), the line, the list of fixes, back to rest
  - _Requirements: 3.4_

- [x] 7. Try it
  - Afterlife card types a client habit, then a product habit, into the real forms
  - _Requirements: 3.6_
