# Requirements Document

## Introduction

Raise anything. The demo raises one made-up app; this feature lets anyone bring their own dead data: a CSV export from any software, a screenshot of any old system, or a photo of a paper client book. Boo reads it, finds what was hidden, maps it into clean records, moves it into the new app and proves the counts. Paper is software that died too.

## Requirements

### Requirement 1

**User Story:** As a business owner, I want to drop in whatever my old system left me, so that Boo works on my data and not just a demo.

#### Acceptance Criteria

1. WHEN the person drops or picks a CSV or TSV file THEN the system SHALL read its rows and columns in the browser.
2. WHEN the person drops an image (screenshot or photo) THEN the system SHALL shrink it in the browser and send it to Gemini to copy the table it shows.
3. IF a table file is over 4 MB or has more than 500 rows THEN the system SHALL say so and read the first 500 rows only.
4. WHEN the person picks a sample (a paper client book, a gym's 2008 export) THEN the system SHALL raise it the same way.
5. WHEN nothing is dropped THEN the Slotly demo SHALL stay the default.

### Requirement 2

**User Story:** As a business owner, I want Boo to work out what each column holds, so that I don't have to map fields by hand.

#### Acceptance Criteria

1. WHEN rows are read THEN the system SHALL guess each column from its heading and values, and Gemini SHALL refine the guess and name what each row is (client, member, patient).
2. WHEN the mapping is shown THEN each column SHALL show real example values beside its meaning.
3. IF Gemini names a kind that is not known THEN the system SHALL keep its own guess.
4. WHEN an export has many columns THEN the popup SHALL show the ones that matter first and keep its button in reach, without the owner scrolling.

### Requirement 3

**User Story:** As a business owner, I want the same workaround hunt on my own data, so that hidden money and alerts are not lost.

#### Acceptance Criteria

1. WHEN the mapping is confirmed THEN the system SHALL find marks in names (★, VIP, words in brackets), second numbers, prepaid packages, credit and health alerts.
2. WHEN a note has no fixed shape THEN the system SHALL send it to `/api/think-about`, with the same grounding checks as the demo.
3. WHEN Gemini reads a photo THEN crossed-out text SHALL be marked, left out, and listed as "Crossed out on paper".
4. WHEN the system reads money owed by the client THEN it SHALL NOT count it as credit.

### Requirement 4

**User Story:** As a business owner, I want proof and clean files at the end, so that I can load my data into any new software.

#### Acceptance Criteria

1. WHEN the records move THEN they SHALL appear in the new app's client list.
2. WHEN the raise is done THEN the system SHALL check rows in against records out, packages and money, credit and alerts.
3. WHEN the raise is done THEN the system SHALL offer the clean data as `clients.csv` and `packages.csv`.
4. WHEN the raise is done THEN the server SHALL have kept nothing.

### Requirement 5

**User Story:** As a business owner, I want my data to land as what it really is, so that a menu becomes menu items and a staff list becomes the team, not clients.

#### Acceptance Criteria

1. WHEN rows are read THEN the system SHALL decide where they belong in the new app (clients, products, services or team) from the headings and values, and Gemini SHALL confirm it for photos and exports, with a short title for the document.
2. WHEN the destination is chosen THEN the records SHALL be cleaned with that kind's rules (marks in item names, prices with words, sold out, allergens for products and services) and land in that page of the new app.
3. WHEN the owner taps another destination THEN the system SHALL use it instead.
