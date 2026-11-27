# Implementation Plan

- [x] 1. Read the old app through its screens
  - Build `survey()` over `hands.js`: open each tab, page through customers, read services, staff, appointments, reports and settings
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 2. Keep the phase short
  - Read the first three customers slowly, the rest at full speed; `glance()` each other part
  - _Requirements: 2.2_

- [x] 3. Show what is being read
  - Caption with spinner per part; tally lines in the "Read from Slotly" popup
  - _Requirements: 2.1, 2.3_

- [x] 4. Ask what matters before starting
  - Chat bubble at Boo with three quick answers and a text box
  - Boo replies through `/api/chat`; questions answered from the data; changes held until the reading exists
  - Start button waits for the owner
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 5. Wait for the owner
  - `nextButton('collected', 'Next: analyse it')`; Boo perches beside the popup
  - _Requirements: 4.1, 4.2_

- [x] 6. Skip missing screens with a caption
  - _Requirements: 1.4_
