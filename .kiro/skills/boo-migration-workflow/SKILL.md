---
name: boo-migration-workflow
description: End-to-end workflow for moving a business's data out of old software with Boo, ending in a sealed certificate
---

# Boo migration workflow

## 1. Collect

- Demo: `boo_sample_old_app` returns Slotly's raw records.
- A real export: read the CSV text. A photo or screenshot: use the web app's "raise your own" (Gemini reads it) or `node bin/boo.mjs raise photo.jpg` with `GEMINI_API_KEY` set.

## 2. Analyse

Call `boo_raise_csv` (any export) or `boo_find_workarounds` (the demo app's shape). Report each finding with its count and one real example, old beside new. List the notes only AI can read separately; never guess them yourself.

## 3. Clean

Ask the owner about the real choices only: package expiry, whether two similar names are one person, whether to use what Gemini read. Before applying any correction they give, call `boo_check_changes` and report what fits and what was refused.

## 4. Migrate

Write the clean files (`clients.csv`, `packages.csv`) or, in the web app, let the crews enter everything through the new app's own forms.

## 5. Verify

The certificate is the only proof. `boo_raise_csv` returns one; `boo_certify_sample` certifies the demo against its hidden truth; `boo_verify_certificate` checks a seal.

- **AT REST**: every record and dollar matched. Say so with the check count and the first 12 characters of the seal.
- **STILL HAUNTED**: say exactly what is missing or extra (the certificate lists it) and keep going.

**Rule:** report a count, a dollar amount or a verdict only when it came from a Boo tool in this session.

## After the switch

In the web app the old app's ghost keeps watch for 30 days and fixes old habits as they're typed. Tell the owner this exists; it is the reason the clean data stays clean.
