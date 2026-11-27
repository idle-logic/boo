# Implementation Plan

- [x] 1. Roaming Boo in the browser
  - Port the desktop pet to `web/pet.js` over the shared world and brain
  - _Requirements: 1.1, 1.2_

- [x] 2. Tuck and nap in the left corner
  - `tuckCorner = 'left'`; nap after 25 seconds alone
  - _Requirements: 1.3, 1.4_

- [x] 3. The Netlify badge as an obstacle
  - Bump the sides, hop on top, never behind
  - _Requirements: 3.1_

- [x] 4. Hand over between roaming and working Boo
  - `free()` and `busy()` at the same spot
  - _Requirements: 3.2_

- [x] 5. Perch beside waiting popups
  - `perch(text)` clear of the popup and the bubble; one short "Tap me" line per step
  - _Requirements: 2.1_

- [x] 6. Tap Boo to talk
  - `onClick: openChat`; hold still while the chat is open
  - _Requirements: 2.2_

- [x] 7. Property tests for the physics and brain
  - _Requirements: 1.1, 1.2_
