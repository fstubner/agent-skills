# Architecture

## Parts
- `src/server.js` — Express app: sign-in, list, open one, add a note, sign out.
- `src/store.js` — the only datastore. A JSON file under `.data/`.
- `public/index.html` — the page.

## Boundaries
Everything behind `/api/` requires a session. The signed-in patient reference
is the authorisation boundary: a patient sees their own records and no others.
