---
inclusion: fileMatch
fileMatchPattern: "tests/**/*"
---

# Testing

- `npm test` runs every unit and property test (node:test + fast-check). Keep it under a few seconds.
- Name the acceptance criteria a test proves in its title: `[spec-name 2.3]`. `node bin/boo.mjs coverage` counts them and fails on a name that does not exist.
- Property tests for anything that parses or transforms data (CSV round trips, physics, sprites).
- Gemini is never called from unit tests. Stub `fetch` and feed it invented numbers and unknown kinds to prove they are refused.
- `tests/e2e/run.mjs` drives the real page in Edge against `node tools/serve-site.mjs 4317`. Each step names its criteria and throws when its check fails. A check that cannot fail is not a check.
