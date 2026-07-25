# Server laws: the judgment half

`check-backend.js` measures laws 1-3's measurable projections (arch doc
present, single ORM, no client-side secret material). Laws 4-5 are verified
by reading code, and the checker never pretends otherwise. This file is the
review procedure.

## Law 4 — structured errors

For each handler on a boundary edge:

- Failure returns a status code + machine-readable `code` + human `message`.
- No stack traces, file paths, SQL, or dependency error strings cross the
  boundary. Log the detail server-side; return the shape.
- 4xx vs 5xx is honest: validation failures are 4xx, not 500s from a crash.

## Law 5 — retry-safe mutations

For each mutation the client can plausibly double-submit (double click,
retry-after-timeout, refresh on a POST result):

- Idempotency key, natural idempotency (upsert by caller-owned id), or an
  explicit dedupe window — one of these, named in a comment at the handler.
- "It probably won't happen" is not one of these.

## Boundary validation review (law 1 depth)

- Every field crossing the edge has a type/shape check server-side.
- Authorization is checked where the data is owned, not only in the router.
- Query parameters and path segments are inputs too.

## Reporting

Findings from this review feed the acceptance turn as prose evidence
alongside the checker report — cite file:line, not vibes.
