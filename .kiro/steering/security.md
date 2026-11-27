---
inclusion: always
---

# Security

- Every server route validates and caps its input (`clean*Request` in `src/agent/ai.js`): sizes, counts, image types, string lengths.
- Rate limits on the Netlify function. Nothing uploaded is stored; files are read in the browser and only photos and samples of rows reach Gemini.
- The real-software agent (`src/main`) never types into password fields and only works on allowed addresses; live Idle is never on that list.
- Exports and certificates are built in the browser and downloaded; nothing is kept on the server.
