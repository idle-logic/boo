# Requirements Document

## Introduction

Phase 1, Collect. Boo reads the old app the way a person would, through its screens, because dying software often has no export and no API. The reading must be quick, visible and complete, and the owner must see what was collected before anything else happens.

## Requirements

### Requirement 1

**User Story:** As a business owner, I want Boo to read my old app without an export, so that I can leave software that never let me take my data out.

#### Acceptance Criteria

1. WHEN the owner presses Start THEN the system SHALL open each part of the old app (customers, services, staff, appointments, reports, settings) through its own navigation.
2. WHEN a part has more than one page THEN the system SHALL page through until every record has been seen.
3. WHEN Boo reads a record THEN the system SHALL store exactly what the screen showed, with no cleaning yet.
4. IF a screen cannot be found THEN the system SHALL say which part was skipped instead of stopping.

### Requirement 2

**User Story:** As a business owner, I want to see what Boo is reading, so that I trust it is my real data.

#### Acceptance Criteria

1. WHEN Boo reads a part THEN the system SHALL show a caption naming the part, with a spinner while it works.
2. WHEN Boo reads customers THEN the system SHALL read the first few slowly and the rest quickly, so the whole phase stays short.
3. WHEN a part is finished THEN the system SHALL add a line with its count to the "Read from Slotly" popup.

### Requirement 3

**User Story:** As a business owner, I want to say what matters most before Boo starts, so that the plan is shaped around me.

#### Acceptance Criteria

1. WHEN the owner presses Play THEN Boo SHALL ask "what matters most?" in a chat bubble beside Boo, with three quick answers and a text box.
2. WHEN the owner answers THEN Boo SHALL reply in its own words before anything starts.
3. WHEN the owner asks a question instead THEN Boo SHALL answer it from the old app's data and SHALL NOT treat it as a priority.
4. WHEN the owner asks for a change before the data is read THEN the system SHALL hold it and make it as soon as the reading exists.
5. WHEN the owner presses "Start: collect the data" THEN the system SHALL begin Phase 1.

### Requirement 4

**User Story:** As a business owner, I want to move on only when I am ready, so that nothing rushes past me.

#### Acceptance Criteria

1. WHEN collecting is finished THEN the system SHALL wait for "Next: analyse it" before Phase 2.
2. WHILE the system waits THEN Boo SHALL perch beside the popup and stay tappable.
