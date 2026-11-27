# Requirements Document

## Introduction

How Kiro keeps Boo honest while it is built. Hooks that block a commit when the proof fails, a stop check that sends the agent back to work, a public-repo check, the same gates in git and CI, a custom agent with the skills and tools it needs, and a Power so any Kiro user can migrate their own data with Boo.

## Requirements

### Requirement 1

**User Story:** As a maintainer, I want Kiro to refuse to commit code that loses data.

#### Acceptance Criteria

1. WHEN the agent runs git commit, push or merge THEN the proof gate hook SHALL replay every certificate and block with the reason if one is STILL HAUNTED, broken or changed.
2. WHEN the agent runs any other shell command THEN the proof gate SHALL let it through at once.

### Requirement 2

**User Story:** As a maintainer, I want the agent to keep working until the proof holds.

#### Acceptance Criteria

1. WHEN the agent stops THEN the stop hook SHALL ask it to continue, with the reason, while a certificate is STILL HAUNTED or changed, or a test names an acceptance criterion that does not exist.

### Requirement 3

**User Story:** As a maintainer of a public repository, I want nothing private or off-voice committed.

#### Acceptance Criteria

1. WHEN a commit is staged THEN the public repo check SHALL block added lines with em or en dashes, env or key files, anything shaped like an API key, and home folder paths.

### Requirement 4

**User Story:** As a maintainer, I want the same gates outside Kiro.

#### Acceptance Criteria

1. WHEN someone commits with git THEN `.githooks/pre-commit` SHALL run the public repo check, the tests and the proof gate.
2. WHEN code is pushed THEN CI SHALL run the tests, the proof gate and the criteria trace.

### Requirement 5

**User Story:** As a Kiro user, I want Boo's migration engine in my own agent.

#### Acceptance Criteria

1. WHEN the boo-migrate Power is installed THEN the agent SHALL get the Boo MCP tools and the migration steering.
2. WHEN the boo-migrator agent runs THEN it SHALL load the steering, the three skills and the Boo MCP tools, and run the proof gate and public repo check before shell commands.
3. WHEN the MCP server is asked to raise a CSV THEN it SHALL return the findings, clean files and a sealed certificate; WHEN asked to verify a certificate THEN it SHALL report a changed one as broken.

### Requirement 6

**User Story:** As a maintainer, I want every acceptance criterion traced to a check.

#### Acceptance Criteria

1. WHEN a spec's requirements change THEN a hook SHALL ask the agent to add tests for the untested criteria, named by criterion.
2. WHEN the engine changes THEN a hook SHALL ask the agent to replay the certificates and fix the engine, never the certificate.
