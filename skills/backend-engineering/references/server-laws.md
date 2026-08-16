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
- Query parameters and path segments are inputs too.

## Law 6 — authorization and sessions

`check-backend.js` covers one syntactic slice of this (`B-session-cookie`:
a session-like cookie set without HttpOnly/Secure/SameSite). Everything
below is read by a human or by the acceptance turn.

For each handler that reads or writes a row belonging to someone:

- The ownership check is **in the handler or the query**, not only in
  router middleware. `WHERE id = ? AND user_id = ?` is the shape that
  cannot be bypassed by a second entry point added later.
- Enumeration: swapping the id in the URL for another user's id returns
  403/404, not the row. Check this on the read path too, not just writes.
- Role checks name the permission, not the screen: `canRefundOrder`, not
  `isAdminPage`.
- Session invalidation exists and is reachable — logout, password change,
  and role downgrade each revoke or rotate.
- Tokens in URLs are findable in logs and referrers. Session material moves
  in a cookie or an `Authorization` header, never a query string.

## Law 7 — limits on anonymous reach

For every endpoint an unauthenticated caller can hit, and every
authenticated one that costs money or sends mail:

- A named limit — requests per window per IP *and* per account, whichever
  the attack targets. Login brute force is per-account; scraping is per-IP.
- Body size cap, so a 2GB JSON POST is rejected before it is parsed.
- Where the limit lives is written down (app middleware, gateway, WAF).
  "At the edge" without a file or config reference means nowhere.
- Password reset and signup send mail on request from a stranger. If they
  have no limit, they are a free mail cannon with your domain on it.

## Reporting

Findings from this review feed the acceptance turn as prose evidence
alongside the checker report — cite file:line, not vibes.
