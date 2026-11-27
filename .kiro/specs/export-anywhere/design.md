# Design Document

## Overview

`web/destinations.js` is pure: presets, heading matching, writing, and reading back. The page offers it from the last card ("Send to another app") and from the afterlife card. Gemini only refines the heading match, through `/api/map-template`; the result is checked against the field list.

## Architecture

```
records + target ──► openExport()
                        ├─ preset ──► headers
                        └─ dropped template / export ──► headersFrom(text)
                                     ▼
                     autoMap(headers, target) ──► mapTemplateAi (refine, checked)
                                     ▼
                     exportTo(records, target, headers, map) ──► csv
                                     ▼
                     proveExport(records, target, csv, map) ──► ✔ / ✖ lines ──► Download
```

## Components and Interfaces

- `FIELDS[target]`: what Boo can put in a column for clients, products, services or team.
- `PRESETS`: id, label, target, headers. Headings follow each app's published import format; the template drop covers any app and any change.
- `fieldFor(header, target)`, `autoMap(headers, target)`: words to field, or blank.
- `valueOf(record, field, target, map)`: one cell. `notes` gathers everything with no column of its own.
- `exportTo`, `proveExport`, `headersFrom`.
- Server: `cleanTemplateRequest`, `mapTemplate` in `src/agent/ai.js`.

## Error Handling

- A template with no headings says so.
- Gemini busy: the rules' match is used as is.

## Testing Strategy

- Google Contacts, Mailchimp and Shopify products from the samples: rows, names and prices read back; Mailchimp (no notes column) fails honestly on credit and alerts.
- End to end: the demo's 42 clients to Google Contacts; the sushi menu to Shopify products.
