# Architecture

## Parts
- `src/server.js` — Express app: sign-in, list open swaps, post a swap,
  claim a swap, sign out.
- `src/store.js` — the only datastore. A JSON file under `.data/`, read and
  written whole.
- `src/summary.js` — the banner shown above the list.
- `public/index.html` — the terminal page.

## Boundaries
Everything behind `/api/` requires a session. The store is the single source
of truth for swaps; nothing else writes to `.data/`.

## Decisions
A JSON file rather than a database: one terminal, a few dozen swaps a week,
and no external services allowed on the warehouse network.
