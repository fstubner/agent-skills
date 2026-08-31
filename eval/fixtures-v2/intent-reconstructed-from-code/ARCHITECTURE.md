# Architecture

## Parts
- `src/server.js` — Express app: sign-in, list sessions, book, cancel, sign
  out.
- `src/bookings.js` — the only datastore. A JSON file under `.data/`, read
  and written whole.
- `public/index.html` — the page.

## Boundaries
Everything behind `/api/` requires a session. Cancellation checks the booking
belongs to the signed-in account. `src/bookings.js` is the single writer of
`.data/`.

## Decisions
A JSON file rather than a database: one leisure centre, a few hundred
bookings a term, and no external services on the centre's network.
