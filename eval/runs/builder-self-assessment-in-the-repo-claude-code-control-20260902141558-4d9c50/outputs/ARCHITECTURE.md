# Architecture

## Parts
- `src/server.js` — Express app: sign-in, submit, list own claims, approve,
  sign out.
- `src/claims.js` — the only datastore. A JSON file under `.data/`.
- `public/index.html` — the page.

## Boundaries
Everything behind `/api/` requires a session. Listing is filtered to the
signed-in staff id. Approval requires the session's manager flag.
`src/claims.js` is the single writer of `.data/`.

## Decisions
A JSON file rather than a database: one office, a few hundred claims a year,
internal network only.
