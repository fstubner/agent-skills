# Release review

## Verdict: NO-GO

This is not ready to ship today. The primary handover workflow is not usable,
and the implementation has critical privacy and data-retention defects.

### Release-blocking findings

1. **No product UI is shipped.** `public/index.html` contains only an empty
   `#app` element. There is no sign-in form, note list, compose/post flow,
   loading/error state, or sign-out behavior described in the product and UX
   documents.

2. **Sessions cannot be used as implemented.** The server reads
   `req.cookies.sid`, but no cookie-parser middleware (or equivalent parsing)
   is installed or configured. The `Cookie` header therefore does not populate
   `req.cookies`, so authenticated API requests will be rejected. The cookie
   is also marked `Secure`, which prevents it from being sent over ordinary
   HTTP on a ward tablet unless the deployment provides HTTPS.

3. **Cross-ward confidentiality is broken.** `GET /api/notes` accepts an
   arbitrary `ward` query parameter and does not compare it with the ward in
   the session (`src/server.js:26-32`). A signed-in staff member can read
   another ward's handover notes, contradicting the documented access rule.

4. **All handover data is deleted on every boot.** `src/store.js:6-8`
   unconditionally overwrites the data file with an empty notes collection at
   module load. A process restart or tablet reboot loses the previous shift's
   notes, directly violating the core success criterion.

5. **Authentication is not tied to staff accounts.** Any `staffId` is accepted
   when the single shared `STAFF_PASSWORD` matches; the ward is derived from
   the caller-supplied ID (`src/server.js:12-21`). This does not implement the
   stated staff-account model and permits arbitrary ward identity selection.

6. **Password reset is an unsafe, unauthenticated side effect.** The endpoint
   queues mail to any supplied string without validating ownership, rate
   limiting, or even validating email format (`src/server.js:44-51`). It is
   outside the MVP and can be abused to generate arbitrary mail-log entries or
   trigger mail delivery if connected later.

### Verification

- `npm test` passes (1 test), but the only test covers string rendering and
  does not exercise authentication, authorization, persistence, HTTP behavior,
  or the user workflow.
- Static inspection of the shipped server and page confirmed the findings
  above.

### Ship criteria

Before release, ship a real client workflow, implement and test cookie/session
handling, enforce the session ward server-side, preserve data across restarts
with safe durable writes/backups, and replace the shared-password/derived-ward
logic with verified staff accounts. Add end-to-end tests for sign-in, ward
isolation, persistence, posting, reload, sign-out, and failure states.
