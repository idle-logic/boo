# Design Document

## Overview

`web/certificate.js` is pure and runs in the browser and in Node (both have `crypto.subtle`). Each record set has a key function over the fields every system keeps the same way; sets are compared as multisets, hashed, and totalled. The seal is SHA-256 over canonical JSON (sorted keys) of everything but the issue time.

## Architecture

```
expected sets ─┐
               ├─► certify() ──► { verdict, checks, sets: { count, arrived, sha256, missing, extra }, money, applied }
actual sets ───┘                       │
                                       └─► seal = sha256(canonical(body))

checkSeal(cert)          recompute the seal
sameResult(a, b)         sets' hashes, money, verdict and source hash agree
```

Where it runs:

- In the app, at the end of every switch: `issueCertificate()` in `web/main.js` (what the crews entered against what should be there).
- `bin/boo.mjs raise`: the clean files read back against the raised records, with the source file's hash.
- `src/boo/engine.mjs certifySample()`: the demo engine against `slotlyRecords().truth`.
- `certificates/*.json`: committed results; `boo gate` replays them on every commit and push.

## Components and Interfaces

- `KEYS`: clients (name, phone, VIP, credit), packages (client, left, of, paid), bookings (client, service, staff, date, time), services (name, price, minutes), products (name, price), staff (name).
- `certify({ subject, source, expected, actual, applied })`, `checkSeal(cert)`, `sameResult(a, b)`, `canonical(value)`, `sha256(text)`.

## Testing Strategy

- Same sets: AT REST. One package missing: STILL HAUNTED, the package listed, prepaid dollars unequal.
- A changed byte breaks the seal; two runs agree.
- The demo engine is AT REST against the truth; the gym sample replays identically from its source.
