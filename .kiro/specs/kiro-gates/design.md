# Design Document

## Overview

Every gate is one command, run the same way by Kiro, git and CI, so there is one definition of "done".

| Gate | Command | Kiro | git | CI |
| --- | --- | --- | --- | --- |
| Proof | `node bin/boo.mjs gate` | `boo-proof-gate.json` (PreToolUse), `boo-stop-check.json` (Stop), the agent's hooks | pre-commit | `proof.yml` |
| Public repo | `node tools/public-repo-check.mjs` | `public-repo-check.json` (PreToolUse), the agent's hooks | pre-commit | |
| Tests | `npm test` | `run-tests-on-save.kiro.hook` | pre-commit | `proof.yml` |
| Criteria trace | `node bin/boo.mjs coverage` | `trace-criteria-on-spec-save.kiro.hook`, stop check (stale tags) | | `proof.yml` |
| Voice | steering `voice.md`, `calm.md` | `check-voice-on-copy.kiro.hook` | public repo check (dashes) | |
| Specs in sync | | `keep-specs-in-sync.kiro.hook` | | |
| Re-certify | `node bin/boo.mjs gate` | `recertify-on-engine-change.kiro.hook` | | |

## Components

- `.kiro/hooks/*.json`: command hooks (PreToolUse, Stop) that block with `{"decision": "block", "reason"}` and exit 2.
- `.kiro/hooks/*.kiro.hook`: IDE hooks that ask the agent to act when files change.
- `.kiro/agents/boo-migrator.json`: prompt, resources (steering, skills), `@boo` tools, preToolUse and stop hooks.
- `.kiro/skills/`: `workaround-hunting`, `grounded-ai`, `boo-migration-workflow`.
- `powers/boo-migrate/`: `POWER.md`, `mcp.json`, `steering/migration-workflow.md`.
- `mcp/server.js`: nine tools, six of them the migration engine.
- `.githooks/pre-commit`, enabled by `npm install` (`prepare` sets `core.hooksPath`).
- `.github/workflows/proof.yml`.

## Testing Strategy

- `hook gate` passes a non-git command and runs the gate for git commit.
- The public repo check's findings are tested on a staged diff with a dash and a key.
- The MCP tools are called through a real MCP client in `tests/proof.test.js`.
