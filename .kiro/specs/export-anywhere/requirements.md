# Requirements Document

## Introduction

Into any software. Idle is one destination; most people are moving somewhere else. Every app imports a CSV with its own column headings, so Boo writes the clean records in exactly the destination's columns, from a preset, from that app's own import template, or from any export of that app, and proves the file holds every row, every name and every dollar.

## Requirements

### Requirement 1

**User Story:** As a business owner, I want the clean data in my new app's import format, so that I can import it without retyping or reformatting.

#### Acceptance Criteria

1. WHEN the owner picks a preset (Google Contacts, Shopify customers, Mailchimp, Shopify products, an online menu, or a clean CSV) THEN the system SHALL write the records in that preset's columns.
2. WHEN the owner drops any app's import template or an export from it THEN the system SHALL read its column headings and write the records in exactly those columns, in that order.
3. WHEN a destination splits names THEN the system SHALL fill first and last name; WHEN it needs a handle THEN the system SHALL make one from the name.

### Requirement 2

**User Story:** As a business owner, I want each of their columns filled with the right thing, so that the import is correct the first time.

#### Acceptance Criteria

1. WHEN headings are known THEN the system SHALL match each to one of Boo's fields by its words, and Gemini SHALL refine the match; a field Gemini names that is not real SHALL be left blank.
2. WHEN a column should always say yes (Published, Active) THEN the system SHALL write TRUE.
3. WHEN the destination has no column for something Boo holds (credit, an alert, a package) THEN the system SHALL put it in the destination's notes column so nothing is lost.

### Requirement 3

**User Story:** As a business owner, I want proof before I import, so that I know nothing fell off on the way.

#### Acceptance Criteria

1. WHEN the file is written THEN the system SHALL read it back and check the row count, every name, and the money columns it has, and show each check as passed or failed.
2. IF the destination has no column, and no notes column, for data Boo holds THEN the check SHALL fail and say which data would be lost.
3. WHEN the checks are shown THEN the owner SHALL be able to download the file named after the destination.
