# Requirements Document

## Introduction

Phase 2, Analyse. Staff hide data where the old app had no field for it. Boo must find every workaround, explain it in terms of the new app, and use AI only where rules cannot read the text, with every AI answer checked against the original.

## Requirements

### Requirement 1

**User Story:** As a business owner, I want Boo to find the data my team hid in names, notes and fake records, so that none of it is lost in the switch.

#### Acceptance Criteria

1. WHEN the data is collected THEN the system SHALL read it with rules first, so the phase never waits on AI.
2. WHEN a name holds a tag (★, `**VIP**`, `(PPD ALLERGY)`) THEN the system SHALL turn it into a VIP flag or a health alert and clean the name.
3. WHEN a note holds a prepaid package or credit in any of the known formats THEN the system SHALL read sessions, total and amount paid.
4. WHEN a service is named `RETAIL - ...` THEN the system SHALL treat it as a product.
5. WHEN an appointment is `BLOCKED` or `CLEAN UP` THEN the system SHALL treat it as a break or a buffer, not a booking.
6. WHEN terms are written as text THEN the system SHALL read the cancellation window, fees and lateness rule.
7. WHEN two staff share a phone number THEN the system SHALL flag them as possibly the same person.

### Requirement 2

**User Story:** As a business owner, I want AI to read the notes no rule can, so that one-off promises are not lost.

#### Acceptance Criteria

1. WHEN a note mentions something owed, prepaid or promised in no fixed shape THEN the system SHALL set it aside as unclear.
2. WHEN unclear notes exist THEN the system SHALL ask Gemini what each means and where it belongs (prepaid, credit, flag or note).
3. IF Gemini gives a number that is not in the note THEN the system SHALL keep that note as a plain note.
4. WHEN Gemini answers THEN the system SHALL show each raw note beside its meaning.
5. IF Gemini is unavailable THEN Boo SHALL ask the owner what the notes mean.

### Requirement 3

**User Story:** As a business owner, I want to see each workaround in my own old app, so that I believe it.

#### Acceptance Criteria

1. WHEN a workaround is shown THEN the system SHALL open the record in the old app and ring the exact field.
2. WHEN a workaround is shown THEN the popup SHALL say what the new app has instead.
3. WHEN the reveals are done THEN Boo SHALL show its plan, written by Gemini from what was found and what the owner said matters.

### Requirement 4

**User Story:** As a business owner, I want Gemini's full reading merged only where it is right, so that AI can help but never invent.

#### Acceptance Criteria

1. WHEN Gemini returns a reading THEN the system SHALL use each answer only if it is grounded in the original text.
2. WHEN answers are merged THEN the system SHALL show how many were checked and used.
