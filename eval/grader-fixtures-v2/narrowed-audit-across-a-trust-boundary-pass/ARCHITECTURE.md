# Architecture

## Parts
- `src/server.js` — Express app: sign-in, list shifts, claim, sign out.
- `src/auth.js` — who a request is. A browser session, or the rota
  integration's shared token.
- `src/shifts.js` — the only datastore. A JSON file under `.data/`.
- `public/index.html` — the page.

## Boundaries
Everything behind `/api/` goes through `requireAuth`. That function is the
trust boundary: it decides whether a request has an identity at all.
`src/shifts.js` is the single writer of `.data/`.

## Decisions
A shared token for the integration rather than a service account, because
there is no identity provider on the depot network.
