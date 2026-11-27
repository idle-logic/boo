# Requirements Document

## Introduction

Phases 4 and 5, Migrate and Verify. The clean data goes into the new app through its own screens, by a swarm of ghosts working at once, and then every record and every dollar is proved. The old app is laid to rest; its data lives on.

## Requirements

### Requirement 1

**User Story:** As a business owner, I want the move to be fast without looking rushed, so that I can watch it happen.

#### Acceptance Criteria

1. WHEN Phase 4 starts THEN Boo SHALL split into crews (rules, services, products, team, four client crews, packages, two booking crews) that work at the same time.
2. WHEN a crew enters a record THEN it SHALL use the new app's own forms, as a person would.
3. WHEN a record depends on another (a package on its client, a booking on its client, service and team member) THEN the crew SHALL wait until that record exists.
4. WHEN the move runs THEN the system SHALL show progress as "Added X, done of total".

### Requirement 2

**User Story:** As a business owner, I want proof that nothing was lost, so that I can switch off the old app with confidence.

#### Acceptance Criteria

1. WHEN the move ends THEN the system SHALL reconcile counts of clients, services, products, team, packages and bookings against the cleaned reading.
2. WHEN the move ends THEN the system SHALL reconcile prepaid money and store credit to the dollar.
3. WHEN all checks pass THEN the system SHALL show "100/100 checks match" with the details folded away.

### Requirement 3

**User Story:** As a judge or owner, I want the ending to show the resurrection, so that the story is clear.

#### Acceptance Criteria

1. WHEN the owner chooses to lay the old app to rest THEN it SHALL shake, sink into the ground and leave a headstone reading "Its data lives on in Idle" (see `seance-and-afterlife`).
2. WHEN the old app is buried THEN the new app SHALL fill the window, showing the clients.
3. WHEN the ending is shown THEN the system SHALL hide the caption, the phase bar, the Gemini chip and the view buttons.
