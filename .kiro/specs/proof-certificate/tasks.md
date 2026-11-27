# Implementation Plan

- [x] 1. Compare sets and money
  - `KEYS`, multiset difference, counts, prepaid and credit totals
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 2. Seal
  - Canonical JSON, SHA-256, issue time left out; `checkSeal`, `sameResult`
  - _Requirements: 1.4, 2.1, 2.3_

- [x] 3. In the app
  - `issueCertificate()` at the end of every switch, demo or raised; verdict, count, seal, download
  - _Requirements: 3.1_

- [x] 4. Replay from the source
  - `boo raise` records the source's hash; `boo verify cert.json source` replays it
  - _Requirements: 2.2_

- [x] 5. Engine against the truth, and the gate
  - `certifySample()`; `certificates/`; `boo gate` and `boo certify --write`
  - _Requirements: 4.1, 4.2_
