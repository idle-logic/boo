---
inclusion: always
---

# Public repository

This repository is public and judged. What goes in must be safe to share.

- No secrets: no `.env` files, keys or tokens. `.env.local` is ignored; the Gemini key is set in Netlify.
- No home folder paths, no private names, no customer data. Samples are made up.
- No em or en dashes in text people read.
- The public repo check (`tools/public-repo-check.mjs`) blocks these on commit, through the Kiro hook and the git pre-commit hook.
- Generated files (`site/`, `build/`, `tests/e2e/last-run.json`) are not committed.
