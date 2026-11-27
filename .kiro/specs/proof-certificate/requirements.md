# Requirements Document

## Introduction

Proof anyone can check again. A switch is done when every record and every dollar is accounted for, not when the typing stops. Boo's certificate compares what should have arrived with what did, set by set and dollar by dollar, and seals the result with SHA-256 so it can be checked, and replayed from its source, later.

## Requirements

### Requirement 1

**User Story:** As a business owner, I want a certificate for my switch, so that I can show anyone nothing was lost.

#### Acceptance Criteria

1. WHEN a switch finishes THEN the system SHALL compare every expected record set with what arrived, by count and by content.
2. WHEN money moved THEN the certificate SHALL total prepaid and credit dollars on both sides.
3. WHEN every check passes THEN the verdict SHALL be AT REST; otherwise it SHALL be STILL HAUNTED, listing what is missing or extra.
4. WHEN the certificate is issued THEN it SHALL be sealed with SHA-256 over its canonical content, leaving out only the issue time.

### Requirement 2

**User Story:** As an auditor, I want to check a certificate myself, so that I don't have to trust the tool that made it.

#### Acceptance Criteria

1. WHEN anyone changes a certificate after it is issued THEN its seal SHALL no longer match.
2. WHEN a certificate is replayed from its source file THEN the same records SHALL give the same result.
3. WHEN the same work is certified twice THEN the two certificates SHALL agree, whenever they were issued.

### Requirement 3

**User Story:** As a business owner, I want the certificate in the app, so that I don't need a command line.

#### Acceptance Criteria

1. WHEN the last card shows THEN it SHALL show the verdict, the check count and the start of the seal, and offer the certificate as a download.

### Requirement 4

**User Story:** As a maintainer, I want the demo engine proved against a known truth, so that a change that loses data is caught before it ships.

#### Acceptance Criteria

1. WHEN the demo engine runs without a browser THEN its result SHALL match the hidden truth for clients, packages, bookings and money.
2. WHEN certificates are committed THEN the gate SHALL fail if the engine now gives a different result, until they are reissued on purpose.
