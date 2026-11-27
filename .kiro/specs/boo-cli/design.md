# Design Document

## Overview

`bin/boo.mjs` is a thin command layer over `src/boo/engine.mjs` (raise, certify, gate, coverage), which reuses the browser modules in `web/` unchanged. Hook commands speak Kiro's hook protocol: on block they print `{"decision": "block", "reason": "..."}`, write the reason to stderr and exit 2.

## Commands

| Command | Does | Used by |
| --- | --- | --- |
| `boo raise <file> [--out dir]` | clean files + certificate | people, the MCP server's sibling `boo_raise_csv` |
| `boo verify <cert> [source]` | seal check, replay | auditors |
| `boo certify [--write]` | certify samples, compare or reissue | maintainers |
| `boo gate` | certify, fail if haunted or changed | `.githooks/pre-commit`, CI |
| `boo hook gate` / `boo hook stop` | the gate for Kiro PreToolUse and Stop hooks | `.kiro/hooks/*.json`, `.kiro/agents/boo-migrator.json` |
| `boo coverage [--list]` | criteria traced to tests | the trace hook, CI |

## Testing Strategy

- Raise twice: same certificate result. Photo without a key: refused.
- `hook gate` with `ls` passes in well under a second; with `git commit` it runs the gate.
- Coverage finds no stale tags.
