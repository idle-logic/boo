# How Boo uses Kiro

Boo's promise is "lose nothing". Kiro is how that promise is kept while Boo is built: specs say what "nothing lost" means, steering keeps every change inside the rules, hooks refuse a commit that would lose a record or a dollar, and the same engine ships to other Kiro users as an MCP server, a custom agent, three skills and a Power.

Everything is in [`.kiro/`](../.kiro) and [`powers/`](../powers).

| | Count | Where |
| --- | --- | --- |
| Specs (requirements, design, tasks) | 11 specs, 132 acceptance criteria, 70 tasks done, 3 open | `.kiro/specs/` |
| Acceptance criteria traced to a check | 126 of 132 (95%) | `node bin/boo.mjs coverage --list` |
| Steering | 10 files (7 always, 3 by file) | `.kiro/steering/` |
| Hooks | 8 (3 blocking command hooks, 5 agent hooks) | `.kiro/hooks/` |
| Custom agent | `boo-migrator` | `.kiro/agents/boo-migrator.json` |
| Skills | 3 | `.kiro/skills/` |
| MCP server | 9 tools, 6 of them the migration engine | `mcp/server.js`, `.kiro/settings/mcp.json` |
| Power | `boo-migrate` | `powers/boo-migrate/` |
| Checks | 74 unit and property tests, 46 browser steps in 5 scenarios, 2 sealed certificates | `tests/`, `tests/e2e/`, `certificates/` |

## Specs

One spec per feature, each with user stories, WHEN/THEN acceptance criteria, a design and a task list:

| Spec | What it covers |
| --- | --- |
| `collect-old-app` | Phase 1: read the dying app screen by screen; ask what matters first |
| `find-workarounds` | Phase 2: rules first, Gemini for what rules can't read, every answer grounded |
| `clean-and-confirm` | Phase 3: old beside new, real choices, any change from the chat, checked |
| `swarm-migration` | Phases 4 and 5: crews through the new app's forms, then the proof |
| `boo-guide` | Boo the ghost: roaming, perching beside popups, the Netlify badge |
| `seance-and-afterlife` | Talk to the dead app; bury it; its ghost catches old habits in the new app |
| `raise-anything` | Any CSV, screenshot or photo of paper, landing as what it really is |
| `export-anywhere` | Into any other app's import format, proved by reading the file back |
| `proof-certificate` | SHA-256 sealed certificates, replayable from their source |
| `boo-cli` | `boo raise`, `verify`, `certify`, `gate`, `coverage`, `hook` |
| `kiro-gates` | The hooks, git and CI gates, agent, skills, Power and MCP tools |

**Traceability.** Every test and browser step names the criteria it proves in its title, like `[raise-anything 3.4]`. `node bin/boo.mjs coverage` counts them, lists the rest, and fails on a name that no longer exists. The six untested criteria are listed honestly (for example, that the customer list reads its first rows slowly), not tagged onto tests that don't check them.

## Steering

| File | Inclusion | What it keeps true |
| --- | --- | --- |
| `product.md` | always | What Boo is, the five phases, the séance, the afterlife, raise anything |
| `tech.md` | always | Where things live; Gemini only on the server; every AI answer checked |
| `proof.md` | always | Done means AT REST; fix the engine, never the certificate; report only measured results |
| `grounded-ai.md` | always | Numbers must be in the source; kinds on fixed lists; Boo never claims what didn't happen |
| `calm.md` | always | One popup, no scrolling, the popup stays lit, details on demand |
| `public-repo.md` | always | No secrets, no home paths, no dashes, no customer data |
| `security.md` | always | Input caps, rate limits, nothing stored, password fields never touched |
| `voice.md` | `web/**`, `src/renderer/**`, `src/agent/**` | Boo's voice: short, friendly, plain English |
| `testing.md` | `tests/**` | Name criteria in tests; stub Gemini; a check that cannot fail is not a check |
| `old-habits.md` | `web/habits.js`, `raise.js`, `interpret.js`, `destinations.js` | Every hiding place has a home; read by kind of record; nothing to the bin |

## Hooks

Three command hooks that **block**. They speak Kiro's hook protocol (`{"decision": "block", "reason": "..."}`, exit 2):

| Hook | Trigger | Does |
| --- | --- | --- |
| `boo-proof-gate.json` | PreToolUse, shell | On git commit, push or merge: replays every certificate; blocks if one is STILL HAUNTED, its seal is broken or the engine's result changed. Any other command passes at once. |
| `boo-stop-check.json` | Stop | Sends the agent back to work while a certificate is haunted or a test names a criterion that doesn't exist. |
| `public-repo-check.json` | PreToolUse, shell | On git commit: blocks dashes, env files, API keys and home paths in what is staged. |

Five agent hooks that **act** when files change:

| Hook | When | Asks the agent to |
| --- | --- | --- |
| `run-tests-on-save` | `web/**`, `src/**`, `tests/**` saved | Run the tests and fix what broke |
| `recertify-on-engine-change` | the reading, raising or proving code saved | Replay the certificates; fix the engine, never the certificate |
| `trace-criteria-on-spec-save` | any `requirements.md` saved | Write tests for the criteria no test names yet |
| `keep-specs-in-sync` | engine files saved | Tick finished tasks; add criteria for new behaviour |
| `check-voice-on-copy` | page or prompt text saved | Check new lines against the voice and calm steering |

The same gates run outside Kiro: `.githooks/pre-commit` (public repo check, tests, proof gate, criteria trace; enabled by `npm install`) and `.github/workflows/proof.yml` (tests, gate, trace, and a raise that is verified by replay).

## Custom agent, skills and Power

- **`boo-migrator`** (`.kiro/agents/boo-migrator.json`): loads the steering and the three skills, uses the `@boo` MCP tools, runs the proof gate and the public repo check before shell commands and the stop check when it stops. Its rule: never report a record, a dollar or a verdict a Boo tool didn't return in this session.
- **Skills**: `workaround-hunting` (every hiding place in old data and where it belongs), `grounded-ai` (how Gemini is used without being trusted), `boo-migration-workflow` (collect, analyse, clean, migrate, verify).
- **Power** `boo-migrate` (`powers/boo-migrate/`): `POWER.md`, `mcp.json` and a migration steering file, so any Kiro user can raise their own exports and get a sealed certificate.

## MCP server

`mcp/server.js`, set up in `.kiro/settings/mcp.json`:

| Tool | Does |
| --- | --- |
| `boo_raise_csv` | Any export: columns worked out, hidden data found, clean files, sealed certificate |
| `boo_check_changes` | Corrections tested against the data before they apply |
| `boo_find_workarounds` | The demo app's shape: every workaround with an example |
| `boo_certify_sample` | The demo switch, end to end, against its hidden truth |
| `boo_verify_certificate` | Is this certificate's seal intact? |
| `boo_sample_old_app` | Slotly's raw records to try the others on |
| `boo_say`, `boo_status`, `boo_needs_you` | Talk through Boo the desktop ghost while Kiro works |

## See it working

```bash
npm install                      # also turns on the git pre-commit gate
npm test                         # 74 tests
node bin/boo.mjs gate            # both certificates AT REST
node bin/boo.mjs coverage --list # 126 of 132 criteria, and the six left
echo '{"tool_input":{"command":"git commit -m x"}}' | node bin/boo.mjs hook gate   # what Kiro's hook runs
node bin/boo.mjs raise web/samples/fittrack-members.csv --out build/gym
node bin/boo.mjs verify build/gym/certificate.json web/samples/fittrack-members.csv
npm run serve                    # then, in another terminal: npm run e2e
```
