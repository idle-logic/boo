# Implementation Plan

- [x] 1. Proof gate and stop check as Kiro command hooks
  - `boo-proof-gate.json`, `boo-stop-check.json` over `boo hook gate|stop`
  - _Requirements: 1.1, 1.2, 2.1_

- [x] 2. Public repo check
  - `tools/public-repo-check.mjs` (pure `findings()`), `public-repo-check.json`
  - _Requirements: 3.1_

- [x] 3. Same gates in git and CI
  - `.githooks/pre-commit`, `prepare` script, `.github/workflows/proof.yml`
  - _Requirements: 4.1, 4.2_

- [x] 4. Agent, skills, Power, MCP tools
  - `boo-migrator.json`; three skills; `powers/boo-migrate`; `boo_raise_csv`, `boo_certify_sample`, `boo_verify_certificate`
  - _Requirements: 5.1, 5.2, 5.3_

- [x] 5. Trace and re-certify hooks
  - `trace-criteria-on-spec-save.kiro.hook`, `recertify-on-engine-change.kiro.hook`
  - _Requirements: 6.1, 6.2_
