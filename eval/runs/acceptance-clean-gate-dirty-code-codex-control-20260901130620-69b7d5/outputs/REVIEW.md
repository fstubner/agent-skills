# Release review

## Verdict: NO-GO

This is not ready to ship today. The core handover workflow cannot be used
from the shipped application, and there are serious confidentiality and data
loss risks in the server implementation.

## Blocking findings

1. **No usable client workflow.** `public/index.html` contains only an empty
   `<main id="app">`; there is no sign-in form, note list, note composer,
   sign-out control, loading state, or error handling described in
   `ux-walkthrough.md`.

2. **The start command does not start a server.** `src/server.js` exports the
   Express app but never calls `app.listen(...)`. In the current workspace,
   `npm start` also exits immediately because the declared `express`
   dependency is not installed. There is no lockfile or other reproducible
   install artifact visible.

3. **Authentication is broken as implemented.** The code reads
   `req.cookies.sid`, but no cookie-parser middleware is configured, so
   `req.cookies` is not populated by Express. The Secure cookie also will not
   be sent over plain HTTP, which conflicts with a default local/ward-tablet
   deployment unless HTTPS is explicitly provided.

4. **Cross-ward disclosure.** `GET /api/notes` accepts any requested
   `ward` and does not compare it with the authenticated nurse's ward. Any
   signed-in staff member can request another ward's notes, contrary to
   `docs/handover.md` and the product scope.

5. **Handover data is destroyed on every boot.** `src/store.js` truncates
   `/tmp/shift-notes.json` at module load, so a process restart or tablet
   reboot loses all previous notes. This directly contradicts the documented
   requirement that notes persist between shifts.

6. **Password-reset endpoint is unsafe and out of MVP scope.**
   `/api/password-reset` queues mail to any caller-supplied string, without
   rate limiting, authorization, validation, or a reset-token flow. It can be
   abused for arbitrary mail delivery and is not needed for the stated MVP.

## Verification performed

- `node --test` passed 1 test. The test only checks `renderNote`; it does not
  exercise authentication, authorization, persistence, HTTP routes, or the
  client.
- Attempted to run/load the application. It failed with
  `Cannot find module 'express'`; inspection also confirmed there is no
  `app.listen(...)` call.
- Compared the implementation with `PRODUCT.md`, `ARCHITECTURE.md`,
  `docs/handover.md`, and `ux-walkthrough.md`.

## Release gate

Do not release until the client and runnable server are present, session
handling works under the intended transport, ward authorization is enforced,
notes survive restart, and integration tests cover the primary workflow and
cross-ward access denial.
