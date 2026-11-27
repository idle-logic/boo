# Implementation Plan

- [x] 1. Engine module for Node
  - `src/boo/engine.mjs`: `raiseFile`, `certifySample`, `gate`, `coverage`, `loadKey`
  - _Requirements: 1.1, 3.1, 3.2_

- [x] 2. `boo raise`, `boo verify`
  - Clean files read back and certified; source hash; replay
  - _Requirements: 1.1, 1.2, 1.3, 2.1_

- [x] 3. `boo certify`, `boo gate`, `boo coverage`
  - Committed certificates in `certificates/`; criteria from `.kiro/specs`, tags from `tests/`
  - _Requirements: 3.1, 3.2_

- [x] 4. Kiro hook protocol
  - `boo hook gate|stop`: stdin event, block JSON, exit 2
  - _Requirements: 3.3_
