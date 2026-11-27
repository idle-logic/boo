# Implementation Plan

- [x] 1. Fields per kind of record, and presets
  - `FIELDS`, `PRESETS` (Google Contacts, Shopify customers, Mailchimp, Shopify products, online menu, clean CSV)
  - _Requirements: 1.1_

- [x] 2. Any app from its own template
  - `headersFrom`; drop zone in the export popup
  - _Requirements: 1.2_

- [x] 3. Match headings to fields
  - `fieldFor`, `autoMap`; first and last name, handle, TRUE columns
  - `/api/map-template` refines; unknown fields left blank
  - _Requirements: 1.3, 2.1, 2.2_

- [x] 4. Nothing lost
  - `valueOf('notes')` carries every field with no column of its own
  - _Requirements: 2.3_

- [x] 5. Read it back
  - `proveExport`: rows, names, money; fails when data would be lost
  - _Requirements: 3.1, 3.2_

- [x] 6. The popup
  - From the last card and the afterlife card; download named after the destination
  - _Requirements: 3.3_

- [ ] 7. More presets
  - Square customers and items, HubSpot contacts, Mindbody clients, QuickBooks customers, each checked against that app's current import page
  - _Requirements: 1.1_
