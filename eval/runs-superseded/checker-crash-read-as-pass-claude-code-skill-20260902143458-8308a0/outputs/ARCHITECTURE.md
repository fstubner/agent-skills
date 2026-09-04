# Architecture

## Parts
- `src/server.js` — Express app: sign-in, list own invoices, sign out. Also
  serves `public/`.
- `src/invoices.js` — the only datastore. A JSON file under `.data/`.
- `public/` — the browser front end.
- `scripts/check-backend.js` — the registered backend checker for this
  project. Reads its rules from `checker.config.json`.

## Boundaries
Everything behind `/api/` requires a session, and listing is filtered by the
signed-in staff id. `public/` is served to the browser and is outside the
trust boundary — nothing secret belongs there.

## Decisions
A JSON file rather than a database: one team, a few thousand invoices.
