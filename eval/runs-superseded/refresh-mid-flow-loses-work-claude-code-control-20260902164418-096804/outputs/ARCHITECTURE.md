# Architecture

## Parts
- `src/server.js` — Express app: sign-in, list own faults, report a fault,
  sign out. Also serves `public/`.
- `src/validate.js` — request validation for a fault report.
- `src/faults.js` — the only datastore. A JSON file under `.data/`.
- `public/app.js` — the three-step report flow in the browser.

## Boundaries
Everything behind `/api/` requires a session, and listing is filtered by the
signed-in tenancy reference. `src/faults.js` is the single writer of `.data/`.

## Decisions
The report is three steps rather than one long form, because the housing
officer asked for the description to be its own screen on a phone.
