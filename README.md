# Haunt

**Boo is a pixel ghost that lives on your screen. It moves your clients out of old software, fills in forms for you, and tells you what is going on in your apps.**

Small clinics, spas, salons and groomers run on software. Switching to a new system means retyping every client by hand, and once you switch, the important things still get missed: the new booking, the unread message, the customer who just arrived.

Haunt brings back the desktop pets of the 1990s, like eSheep, and makes them useful. Boo walks along your taskbar and hops between the tops of your windows. Then it gets to work.

Entered in the **Resurrection** category of Kiroween 2026: dead software and dead desktop pets, brought back to life.

## Try it in your browser

Open the live demo from the link in this repo's About box. Press **Move my clients** and watch Boo carry six clients out of "ClinicMaster 98" into a modern booking app, field by field. Then press **Tell me what is going on**.

The browser demo is a simulation of two apps on one page. The desktop app does the same thing with real software on your computer.

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
bin/            the haunt command for Kiro hooks
mcp/            the MCP server for Kiro's agent
demo/           a sample old-system export and a sample new-client form
tests/          property-based tests
.kiro/          steering and settings used to build Haunt in Kiro
```

## Licence

MIT
