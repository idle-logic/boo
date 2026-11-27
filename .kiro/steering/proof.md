---
inclusion: always
---

# Proof

Boo's promise is "lose nothing", so every change is judged by the certificates, not by how the code looks.

- **Done means AT REST.** `node bin/boo.mjs gate` must pass: every committed certificate in `certificates/` replays AT REST with its seal intact and the same result.
- **Fix the engine, never the certificate.** If a certificate goes STILL HAUNTED, the change lost a record or a dollar. Reissue (`node bin/boo.mjs certify --write`) only when the result changed on purpose, and say why in the commit.
- **Every acceptance criterion has a check.** Name it in the test title like `[raise-anything 3.4]`. Never tag a test with a criterion it does not really check. `node bin/boo.mjs coverage --list` shows what is left.
- **Report only measured results.** A count, a dollar total or a verdict comes from a command or a tool run in this session, never from memory or from a document.
- **Money owed is not credit.** Owed amounts stay notes and go to Gemini; credit and prepaid packages are counted to the dollar.
