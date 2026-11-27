# Implementation Plan

- [x] 1. Rules reading
  - `cleanName`, tag to VIP or alert, three package formats, credit, RETAIL products, BLOCKED and CLEAN UP, terms text, shared phone numbers
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7_

- [x] 2. Findings in the new app's terms
  - `findingsFor()` with titles, examples, what the new app has instead, and choices
  - _Requirements: 3.2_

- [x] 3. Reveal each workaround in the old app
  - Open the record, ring the field, link it to the popup; the popup stays lit
  - _Requirements: 3.1_

- [x] 4. Gemini's full reading, grounded
  - `/api/read`, `mergeReading`, gem chip with the checked-and-used count
  - _Requirements: 4.1, 4.2_

- [x] 5. Notes no rule can read
  - Set aside unclear notes; `/api/think-about`; validate kinds and numbers
  - "Only AI could read these" popup; the fallback asks the owner
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 6. Boo's plan
  - Gemini writes 3 to 5 steps from the findings and the owner's priority; a fallback plan when busy
  - _Requirements: 3.3_

- [x] 7. Tests
  - Rules vs truth, grounded merge, AI note validation
  - _Requirements: 2.3, 4.1_
