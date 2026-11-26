---
inclusion: always
---

# Tech

- Electron. One transparent, always-on-top window covers the main display and ignores the mouse except over Boo.
- `src/main/windows.ps1` lists the visible windows on Windows. Their top edges become ledges. Other systems get the floor only.
- `src/renderer/world.js` is the physics and the ledges. `src/renderer/brain.js` is Boo's behaviour. Both are pure and have no DOM, so they are tested with property-based tests.
- `src/renderer/sprites.js` holds the pixel art as 16x16 grids. Run `npm run sprites` to see every pose.
- `src/main/events.js` is the local event server on 127.0.0.1:47474. `bin/haunt.js` is the CLI for Kiro hooks. `mcp/server.js` is the MCP server for Kiro's agent.

## Quality bar

- `npm test` runs every test. Physics and behaviour changes need a property test.
- New poses go in `sprites.js` and must render in `npm run sprites` before use.
