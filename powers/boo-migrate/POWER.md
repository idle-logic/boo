---
name: boo-migrate
version: 1.0.0
description: Move a business's data out of dead or dying software with nothing lost, and prove it with a sealed certificate
---

# Boo Migrate Power

Gives any Kiro agent Boo's migration engine: find the data staff hid in names, notes and fake records of an old system, turn it into clean records, and prove with a SHA-256 sealed certificate that every record and every dollar arrived.

## What it does

- **Raise any export.** `boo_raise_csv` takes a CSV from any old software (CRM, booking, gym, clinic, inventory), works out each column, finds VIP marks, health alerts, prepaid packages, credit and second numbers hidden in names and notes, and returns clean `clients.csv` and `packages.csv` plus a certificate.
- **Check before changing.** `boo_check_changes` tests a list of corrections against the data and returns which fit and which are refused, with reasons.
- **Prove it.** `boo_certify_sample` runs the demo switch end to end against its hidden truth; `boo_verify_certificate` checks any Boo certificate's seal.
- **Verdicts.** `AT REST` when every record and dollar matches. `STILL HAUNTED` when something is missing or extra, with what it is.

## When to use it

- Leaving software that is shutting down, or that never had an export.
- Cleaning an export before importing it into new software.
- Proving to an owner, an accountant or an auditor that nothing was lost.

Do not use it to invent data: every value comes from the source, and money owed by a client is never counted as credit.

## Setup

Node 20 or later. The MCP server runs straight from the repository:

```
npx -y --package=github:idle-logic/familiar#haunt boo-mcp
```

See `mcp.json`. Photos and screenshots are read in the web app (Gemini) or with `boo raise photo.jpg` and a `GEMINI_API_KEY`; the MCP tools work offline on CSV text.

## Steering

`steering/migration-workflow.md` is loaded with the power: collect, analyse, clean, migrate, verify, and the rule that a verdict comes only from a tool result.
