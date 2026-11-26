# Requirements Document

## Introduction

ClinicMaster Reborn replaces ClinicMaster 98, a desktop clinic system from 1998 with no source code and no documentation. Haunt learned these rules by using ClinicMaster 98 the way staff do: 61 entries, good and bad, on every screen, reading what the app said back. Nothing here comes from the old code. Each criterion lists the evidence that proved it.

Error codes stay the same, so staff who know them are not surprised.

## Requirements

### Requirement 1: Clients

**User Story:** As front desk staff, I want to keep a record of every client and their pet, so that my day works the same in the new app.

#### Acceptance Criteria

1. WHEN staff save a client without Name THEN the system SHALL refuse it with error 101 "Name is required."
   - _Evidence:_ Left Name empty: "Error 101: Name is required."
2. WHEN staff save a client without HP THEN the system SHALL refuse it with error 102 "HP must be 8 digits starting with 8 or 9."
   - _Evidence:_ Left HP empty: "Error 102: HP must be 8 digits starting with 8 or 9."
3. WHEN HP is not exactly 8 digits, starting with 8 or 9 THEN the system SHALL refuse it with error 102 "HP must be 8 digits starting with 8 or 9."
   - _Evidence:_ 8678954 (one digit short): error 102
   - _Evidence:_ 867895510 (one digit long): error 102
   - _Evidence:_ 867895ab (letters): error 102
   - _Evidence:_ 06789565 (starts with 0): error 102
4. WHEN DOB is given and is not a real calendar date written DD/MM/YYYY THEN the system SHALL refuse it with error 103 "DOB must be DD/MM/YYYY."
   - _Evidence:_ 2026-12-15 (year first): error 103
   - _Evidence:_ 15/12/26 (short year): error 103
   - _Evidence:_ 31/02/2027 (a day that does not exist): error 103
5. WHEN another client already has the same HP THEN the system SHALL refuse it with error 104 "HP already on file."
   - _Evidence:_ Used HP 86789012, already on file: "Error 104: HP already on file."
   - _Evidence:_ The same again, everything else changed: refused again
6. WHEN Name is longer than 30 characters THEN the system SHALL refuse it with error 105 "Name is too long (30 letters at most)."
   - _Found by random testing._
   - _Evidence:_ Entry 32: old app "Error 105: Name is too long (30 letters at most).", new app saved it
   - _Evidence:_ Name with 30 letters: accepted
   - _Evidence:_ Name with 31 letters: error 105
7. WHEN every check passes THEN the system SHALL save the client, add it to the Clients list and confirm it (the old app said "Record saved.")
8. WHEN more than one check fails THEN the system SHALL report only the first, in the order of the error codes, like the old app

### Requirement 2: Appointments

**User Story:** As front desk staff, I want to book clients into time slots, so that my day works the same in the new app.

#### Acceptance Criteria

1. WHEN staff save an appointment without Client THEN the system SHALL refuse it with error 201 "Choose a client, date and time."
   - _Evidence:_ Left Client empty: "Error 201: Choose a client, date and time."
2. WHEN staff save an appointment without Date THEN the system SHALL refuse it with error 201 "Choose a client, date and time."
   - _Evidence:_ Left Date empty: "Error 201: Choose a client, date and time."
3. WHEN staff save an appointment without Time THEN the system SHALL refuse it with error 201 "Choose a client, date and time."
   - _Evidence:_ Left Time empty: "Error 201: Choose a client, date and time."
4. WHEN Date is given and is not a real calendar date written DD/MM/YYYY THEN the system SHALL refuse it with error 202 "Date must be DD/MM/YYYY."
   - _Evidence:_ 2026-12-15 (year first): error 202
   - _Evidence:_ 15/12/26 (short year): error 202
   - _Evidence:_ 31/02/2027 (a day that does not exist): error 202
5. WHEN Date falls on a Sunday THEN the system SHALL refuse it with error 210 "Closed on Sundays."
   - _Evidence:_ Sunday 10/01/2027: "Error 210: Closed on Sundays."
   - _Evidence:_ Monday, Tuesday, Wednesday, Thursday, Friday, Saturday of the same week: accepted
6. WHEN another appointment already has the same Date and Time THEN the system SHALL refuse it with error 211 "Slot already taken."
   - _Evidence:_ Date 08/12/2026 with Time 10:00, already on file: "Error 211: Slot already taken."
   - _Evidence:_ The same pair again, everything else changed: refused again
   - _Evidence:_ Each one alone with new values: accepted
7. WHEN every check passes THEN the system SHALL save the appointment, add it to the Appointments list and confirm it (the old app said "Appointment booked.")
8. WHEN more than one check fails THEN the system SHALL report only the first, in the order of the error codes, like the old app

### Requirement 3: Invoices

**User Story:** As front desk staff, I want to charge for services with the right tax, so that my day works the same in the new app.

#### Acceptance Criteria

1. WHEN staff save an invoice without Client THEN the system SHALL refuse it with error 301 "Choose a client and a service."
   - _Evidence:_ Left Client empty: "Error 301: Choose a client and a service."
2. WHEN staff save an invoice without Service THEN the system SHALL refuse it with error 301 "Choose a client and a service."
   - _Evidence:_ Left Service empty: "Error 301: Choose a client and a service."
3. WHEN every check passes THEN the system SHALL save the invoice, add it to the Invoices list and confirm it (the old app said "Invoice saved.")
4. WHEN an invoice is saved THEN the system SHALL set Subtotal to the price of the Service, GST to 9% of it rounded to the nearest cent (the old app rounded down; the owner chose the nearest cent), and Total to Subtotal plus GST
   - _Evidence:_ Bath: 45.00 × 9% = 4.0500, app shows 4.05
   - _Evidence:_ Full groom: 85.50 × 9% = 7.6950, app shows 7.69
   - _Evidence:_ Deshed: 69.95 × 9% = 6.2955, app shows 6.29
   - _Evidence:_ Nail trim: 15.25 × 9% = 1.3725, app shows 1.37
5. WHEN more than one check fails THEN the system SHALL report only the first, in the order of the error codes, like the old app

### Requirement 4: Moving in

**User Story:** As the owner, I want every record from ClinicMaster 98 in the new app, so that I can switch off the old one.

#### Acceptance Criteria

1. WHEN the records are moved THEN the system SHALL copy every row of every screen exactly, including past invoice totals as they were charged
2. WHEN the move finishes THEN the system SHALL show each screen side by side with the old one, row for row

### Requirement 5: Proof

**User Story:** As the owner, I want proof the new app behaves like the old one, so that I can trust the switch.

#### Acceptance Criteria

1. WHEN the same entry is made in both apps THEN they SHALL give the same error code, or both save the same row
2. WHEN the apps disagree THEN the system SHALL show the entry, both answers, and either learn the missing rule or ask the owner
