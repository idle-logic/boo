# Requirements Document

## Introduction

`boo` on the command line. The same engine as the web app, for people who'd rather run a command, for git hooks, for Kiro hooks and for CI. CSV works offline with rules only, so results are exactly repeatable.

## Requirements

### Requirement 1

**User Story:** As someone moving data, I want to raise an export from a terminal, so that I can script it and keep the files.

#### Acceptance Criteria

1. WHEN `boo raise <file.csv>` runs THEN it SHALL write the clean CSV files and `certificate.json`, after reading the clean files back and certifying them against the raised records.
2. WHEN `boo raise` is given a photo without a Gemini key THEN it SHALL stop and say a key is needed.
3. WHEN `boo raise` runs twice on the same file THEN the two results SHALL be identical.

### Requirement 2

**User Story:** As an auditor, I want to check a certificate from a terminal.

#### Acceptance Criteria

1. WHEN `boo verify <certificate.json>` runs THEN it SHALL say whether the seal is intact; WHEN given the source too THEN it SHALL replay it and say whether the result is the same.

### Requirement 3

**User Story:** As a maintainer, I want one command for every gate, so that hooks and CI run the same checks.

#### Acceptance Criteria

1. WHEN `boo gate` runs THEN it SHALL certify the samples and fail if any is STILL HAUNTED, its committed certificate's seal is broken, or the result changed.
2. WHEN `boo coverage` runs THEN it SHALL count the acceptance criteria in `.kiro/specs` that a test or an end-to-end step names, list the rest with `--list`, and fail on a tag naming a criterion that does not exist.
3. WHEN `boo hook gate` runs with a hook event on stdin THEN it SHALL pass any command but git commit, push and merge at once, and block those with a reason when the gate fails.
