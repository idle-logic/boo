---
name: workaround-hunting
description: Recognise the places staff hide data when old software has no field for it, and where each belongs in new software
---

# Workaround hunting

Old software can't hold everything, so people hide data where it doesn't belong. Every hiding place has a proper home in new software. This is the list Boo works from; the rules live in `web/habits.js` (any data) and `web/interpret.js` (the demo app).

## In names

| Seen in the old data | What it really is | Where it goes |
| --- | --- | --- |
| `Mei Tan ★`, `**VIP**`, `*VIP*`, `VIP` | VIP status | VIP field, name cleaned |
| `(PPD ALLERGY)`, `(ASTHMA)`, `(PREGNANT)`, `(KNEE SURGERY)` | Health alert | Alert field, name cleaned |
| `(DO NOT CALL)`, `[CORPORATE - DBS]` | A warning or an account note | Notes, name cleaned |

## In phone fields

`9123 4567 / 9988 7766 (mum)` is two numbers. The first is the phone; the rest go to the notes.

## In notes

- **Prepaid packages**, in any of these shapes: `PKG blowdry: 3 left of 5, paid $250`, `prepaid 10 massages ($600) - 4 remaining`, `5x blowdry pkg, 1 used. pd $250`, `10 class pass, 3 used, paid $250`, `PT pack: 4 left of 12, paid $960`. Each becomes a package with sessions left, total and paid.
- **Credit**: `credit $80`, `gift card balance $60`, `account credit $25` become store credit.
- **Money owed by the client is never credit**: `owes $40 locker fee` stays a note and goes to Gemini.
- **Health**: allergies, pregnancy, diabetes, asthma, surgery, injuries become an alert.
- **No fixed shape**: owed, paid ahead, voucher, promo, comped, honour, no show. Rules set these aside for Gemini (see `grounded-ai`).

## In fake records

- A service called `RETAIL - Argan oil` is a product.
- An appointment for `BLOCKED` is a break; a `CLEAN UP` booked straight after a service is that service's buffer time.
- Cancellation rules typed as a paragraph become the cancellation window, fee and no-show fee.
- Two staff with the same phone number may be one person (`Jas K.` and `Jasmine Koh`): ask, never merge silently.

## On paper

Crossed-out text is no longer true. Gemini wraps it in `~~`; Boo leaves it out and lists it as "Crossed out on paper".

## When you find a new hiding place

1. Add the shape to `web/habits.js` with a test in `tests/` that names its acceptance criterion.
2. Run `node bin/boo.mjs gate`. If a certificate changes because more is now found, reissue with `node bin/boo.mjs certify --write` and say why.
