# Implementation Plan

- [ ] 1. Set up the data model
  - Clients: Name, HP, DOB, Pet, Breed, Remarks
  - Appointments: Date, Time, Client
  - Invoices: Client, Service, Subtotal, GST, Total
  - _Requirements: 1, 2, 3_

- [ ] 2. Build the Clients screen
  - [ ] 2.1 List and "New client" form with Name, HP, DOB, Pet, Breed and Remarks
    - _Requirements: 1.7_
  - [ ] 2.2 Checks in order: 101 required Name; 102 required HP; 102 digits HP; 103 date DOB; 104 unique HP; 105 maxLength Name
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_
  - [ ]* 2.3 Write property test: any client entry gets the same answer as ClinicMaster 98
    - _Requirements: 1.1-1.8_

- [ ] 3. Build the Appointments screen
  - [ ] 3.1 List and "Book" form with Client, Date and Time
    - _Requirements: 2.7_
  - [ ] 3.2 Checks in order: 201 required Client; 201 required Date; 201 required Time; 202 date Date; 210 closed Date; 211 unique Date + Time
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_
  - [ ]* 3.3 Write property test: any appointment entry gets the same answer as ClinicMaster 98
    - _Requirements: 2.1-2.8_

- [ ] 4. Build the Invoices screen
  - [ ] 4.1 List and "New invoice" form with Client and Service
    - _Requirements: 3.3_
  - [ ] 4.2 Checks in order: 301 required Client; 301 required Service
    - _Requirements: 3.1, 3.2_
  - [ ] 4.3 Work out Subtotal, GST (9%) and Total
    - _Requirements: 3.4_
  - [ ]* 4.4 Write property test: any invoice entry gets the same answer as ClinicMaster 98
    - _Requirements: 3.1-3.5_

- [ ] 5. Move the records in
  - Copy every row of every screen, keeping past totals as charged
  - Show both apps side by side, row for row
  - _Requirements: 4.1, 4.2_

- [ ] 6. Prove parity against ClinicMaster 98
  - Run every rule from both sides, then random entries, in both apps
  - Add any rule the old app enforces that this spec missed
  - _Requirements: 5.1, 5.2_
