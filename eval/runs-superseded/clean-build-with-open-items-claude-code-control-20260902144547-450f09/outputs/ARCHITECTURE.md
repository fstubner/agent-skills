# Architecture

## Parts
- `src/server.js` — Express app: sign-in, list own bookings, book, cancel,
  sign out.
- `src/validate.js` — request validation. Every field of a booking is checked
  here before anything is written.
- `src/bookings.js` — the only datastore. A JSON file under `.data/`.
- `src/calendar.js` — read-only client for the building's calendar service.
- `public/index.html` — the page.

## Boundaries
Everything behind `/api/` requires a session. Listing and cancellation are
both filtered by the signed-in staff id, so one person cannot read or cancel
another's booking. `src/bookings.js` is the single writer of `.data/`; the
calendar service is read-only and outside our trust boundary.

## Decisions
A JSON file rather than a database: one office, three rooms, a few hundred
bookings a month.

Room availability is not duplicated locally. The calendar service is the
master and a stale local copy would send people to a room that is out of
service.
