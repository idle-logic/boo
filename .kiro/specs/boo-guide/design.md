# Design Document

## Overview

Two ghosts share one identity. The roaming Boo (`web/pet.js`) is a physics body driven by a pure brain; the working Boo (`web/ghost.js`) flies scripted paths during the phases. `free()` and `busy()` swap between them at the same spot.

## Architecture

```
src/renderer/world.js   physics: gravity, ledges, obstacles     (pure, tested)
src/renderer/brain.js   behaviour: wander, guide, goto, tuck,   (pure, tested)
                        sleep, alert, held
web/pet.js              DOM, sprites, input, nap, obstacle bumps
web/main.js             free() / busy() / perch(text) / holdStill()
```

## Components and Interfaces

- `createPet({ windows, bounds, onClick, obstacles, nap })` returns `{ handle(event), box, destroy() }`.
- Brain events: `say`, `click`, `grab`, `drop`, `tuck`, `guide`, `wait`, `goto`, `release`.
- `perch(text)` sends `guide` beside the popup, then a sticky `wait` line.
- `holdStill()` sends `goto` at Boo's own spot while the chat is open; `closeChat()` sends `release`.
- `brain.tuckCorner = 'left'` in the browser; the desktop app keeps the right corner.

## Error Handling

- If the Netlify badge cannot be measured (cross-origin), a fixed region stands in for it.

## Testing Strategy

- Property tests: Boo always lands on a ledge top, never under a window in front of it, and a reachable ledge is reachable by a jump.
- End to end: Boo perches with a gap from the popup and no overlap; the chat stays inside the window.
