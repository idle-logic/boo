# Requirements Document

## Introduction

Phase 3, Clean. Every workaround becomes a proper field in the new app. The owner sees the old value beside the new one, makes the few real choices, and can correct or change anything in plain words, at any moment, by tapping Boo.

## Requirements

### Requirement 1

**User Story:** As a business owner, I want to see old and new side by side on one screen, so that I can approve the clean-up at a glance.

#### Acceptance Criteria

1. WHEN Phase 3 starts THEN the system SHALL show every finding as old → new in a two-column popup that fits without scrolling.
2. WHEN a finding has a real choice (package expiry, same person, notes only AI could read) THEN the system SHALL show its options as buttons, and pressing one SHALL select it.
3. WHEN the owner presses "Looks right, clean it" THEN the system SHALL clean every record with the chosen options.
4. WHEN cleaning is finished THEN the system SHALL wait for "Next: migrate it".

### Requirement 2

**User Story:** As a business owner, I want to ask Boo anything about my data at any time, so that I never have to dig through the old app myself.

#### Acceptance Criteria

1. WHEN the owner taps Boo THEN the chat SHALL open beside Boo, fully inside the window, and Boo SHALL hold still while it is open.
2. WHEN the owner asks a question at any stage THEN Boo SHALL answer from the old app's data, the cleaned reading and the new app, with exact counts.
3. WHEN the owner moves to the next step THEN the chat SHALL close.

### Requirement 3

**User Story:** As a business owner, I want to change anything by saying it, so that I can fix what Boo got wrong.

#### Acceptance Criteria

1. WHEN the owner asks for changes THEN the system SHALL apply every one it can, several in one message, to clients, services, team, products, bookings or rules, including adding and removing records.
2. WHEN a change does not fit the data (unknown record, wrong type, out of range) THEN the system SHALL refuse it and say why.
3. WHEN a record is renamed THEN the system SHALL carry the new name through to its bookings.
4. WHEN the owner asks for a package expiry of any number of months THEN the system SHALL add and select that option.
5. IF Boo's reply claims a change that was not made THEN the system SHALL say that nothing changed.
6. WHEN a change is asked for after the move THEN the system SHALL make it in the new app.
