# Architecture

## Parts
- `src/server.js` — Express app: sign-in, list shifts, assign, unassign,
  sign out.
- `src/shifts.js` — the only datastore. A JSON file under `.data/`.
- `public/index.html` — the page.

## Boundaries
Everything behind `/api/` requires a session, and every shift route requires
the coordinator role. `src/shifts.js` is the single writer of `.data/`.

## Decisions
A JSON file rather than a database: one food bank, three shifts a day.

Assignment is a coordinator action. Volunteers do not write to the rota.
