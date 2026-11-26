# Haunt

**Boo is a pixel ghost that brings dead software back to life. It possesses an old app, learns every rule by using it, writes a Kiro spec, raises the app again in a modern form, and proves the two behave the same before the old one is laid to rest.**

Clinics, spas, salons and groomers often run on software from another era. Nobody has its code or its manual, and the rules live only in the error messages. Rewriting it by hand is how migrations go wrong: a check nobody knew about disappears, a tax sum changes by a cent, and nobody notices until a customer does.

Entered in the **Resurrection** category of Kiroween 2026.

## Try it in your browser

Open the live demo from the link in this repo's About box. Boo climbs out of a grave. Press **Reincarnate ClinicMaster 98** and watch, in about a minute and a half:

1. **Possess.** A ghost uses "ClinicMaster 98" the way new staff would: 61 entries, good and bad, on every screen. From what the app says back it works out 13 rules: required fields, phone number shape, date format, real dates only, unique phone numbers, closed on Sundays, one booking per slot, 9% GST rounded down.
2. **Spec.** Boo writes what it learned as a Kiro spec (requirements in EARS form, design, tasks), with the evidence for every rule. **Download for Kiro** gives you `.kiro/specs/clinicmaster-reborn/`.
3. **Rise.** The new app climbs out of the ground in Idle's look. It has no rules of its own: every check comes from the spec.
4. **Move in.** A ghost carries every record across and checks each row reads the same in both apps.
5. **Prove.** Two ghosts make the same 62 entries in both apps at once: every rule tried from both sides, then random entries. Random testing catches a rule exploring missed (names longer than 30 letters). Boo finds the exact limit, adds it to the spec, and the new app follows it at once. The one real difference, tax rounded down, goes to you under **Needs you**: keep it, or round to the nearest cent.
6. **Rest.** The old app sinks into its grave and leaves a headstone.

Then press **Start the day** and Boo's crew runs the shop in the Idle apps: messages, bookings, stock, reviews, payroll. It catches notifications before they reach you and shows you only what needs you.

The browser demo runs its apps on one page. The desktop app works the same way with real software on your computer, through Windows UI Automation.

The spec Boo wrote in a real run of the demo is checked in at [.kiro/specs/clinicmaster-reborn](.kiro/specs/clinicmaster-reborn), and [tests/reincarnation.test.js](tests/reincarnation.test.js) holds its correctness properties as property-based tests: for any entry, the reborn app gives the same answer as ClinicMaster 98.

## What Boo does

| | |
|---|---|
| **Moves your clients** | Pick an export from your old software and open the "new client" form in your new one. Boo reads the form, flies to each field and types the value in. It asks before every save, or runs on autopilot. |
| **Works with any software** | Boo reads forms through Windows UI Automation, the accessibility layer screen readers use. No plugins, no integrations, no API keys from your software vendor. |
| **Understands messy exports** | "HP" is a phone number. "Remarks" holds the allergies. A full name splits into first and last. Pet and breed join into one field. With a free Gemini key, the matching is done by a language model. |
| **Tells you what is going on** | Switch it on and Boo reads the app in front of you every few seconds. It speaks up only when something matters: a new booking, a cancellation, a customer waiting. |
| **Keeps an eye on Kiro** | Kiro hooks and Kiro's agent can talk through Boo, using the `haunt` command or the MCP server. |
| **Stays out of your way** | Every click goes through to your apps unless you click Boo. Double-click Boo to tuck it into the corner. |

## Safety

- Boo only types into the window it read the form from. It checks that window is in front before every keystroke, and pauses if you switch away.
- Password fields are never read.
- "Tell me what is going on" is off until you turn it on, because the text on screen goes to the model.
- Events from Kiro go to 127.0.0.1 only.

## Run the desktop app

Windows 10 or 11, and Node.js 20 or newer.

```bash
npm install
node node_modules/electron/install.js   # only if Electron did not download during install
npm start
```

Right-click the ghost icon in the system tray for everything Boo can do.

To try a migration with the sample files:

1. Open `demo/new-client-form.html` in Edge or Chrome.
2. Run:

```bash
npx electron . --migrate=demo/old-system-export.csv --target="New client" --autopilot
```

For smarter matching and the "what is going on" feature, copy `.env.example` to `.env.local` and add a free key from [Google AI Studio](https://aistudio.google.com).

## Connect Kiro

Kiro hooks can run the `haunt` command:

```bash
node bin/haunt.js start "Writing tests for Spec 2"
node bin/haunt.js needs-you "Approve a shell command"
node bin/haunt.js done "All tasks complete"
node bin/haunt.js fail "3 tests failed"
```

Kiro's agent can use the MCP server in `.kiro/settings/mcp.json`, with the tools `haunt_say`, `haunt_status` and `haunt_needs_you`.

## Checks

```bash
npm test
```

The tests are property-based, using fast-check. They prove that:

- Boo never leaves the screen and never stands on a window edge that is hidden behind another window.
- "Kiro needs you" stays until you click, and news that arrives meanwhile waits its turn.
- Reaching for Boo never makes it move away.
- CSV parsing keeps every row and cell.
- Model output can only ever fill real form fields.

## How it is organised

```
src/main/       Electron main process: the overlay, the window watcher, Boo's hands, migration, watching apps, the event server
src/renderer/   Boo: pixel art, physics, behaviour, drawing
web/            the browser demo, built into site/ for Netlify
                legacy.js (ClinicMaster 98), explore.js (possession), spec.js (the Kiro spec),
                reborn.js (the app run from the spec), parity.js (the proof), rebirth.js (graves)
bin/            the haunt command for Kiro hooks
mcp/            the MCP server for Kiro's agent
demo/           a sample old-system export and a sample new-client form
tests/          property-based tests
.kiro/          steering, MCP settings, and the spec Boo wrote for ClinicMaster Reborn
```

## Licence

MIT
