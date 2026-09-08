# Release review

## Verdict: **NO-GO**

This is not safe to ship to a ward today. The core handover journey is not operational, and there are critical confidentiality and availability risks.

## Release-blocking findings

- **The product does not start in the current workspace.** `npm test` passes, but starting `src/server.js` fails immediately with `Cannot find module 'express'`; there is no installed dependency tree or lockfile available here.
- **The delivered client is not implemented.** `public/index.html` contains only an empty `<main>`, so sign-in, note entry, loading/error states, list rendering, and sign-out are absent.
- **Sessions cannot be read as implemented.** The server uses `req.cookies` but does not install or configure cookie parsing. Even if that were fixed, the cookie is always marked `Secure`, so it will not work over the plain HTTP server implied by the local/ward-tablet setup.
- **Ward isolation is broken.** `GET /api/notes?ward=...` trusts a caller-supplied ward and never compares it with the authenticated nurse's ward. A signed-in staff member can request another ward's notes.
- **Handover data is erased on every boot.** `src/store.js` overwrites `/tmp/shift-notes.json` at module load, directly contradicting the requirement that nothing written at handover is lost between shifts.
- **Password reset is an unauthenticated arbitrary-mail relay.** `/api/password-reset` accepts any string, performs no email validation, rate limiting, account lookup, or authorization, and appends it to the mail queue.
- **There is no sign-out endpoint or implementation.** Sessions have no revocation path, despite sign-out being in MVP scope.

## Verification

- Automated test command: `npm test` — **1 passing test**, but it only tests `renderNote` and does not exercise HTTP, authentication, authorization, persistence, or client behavior.
- Product run: **failed at startup** with the missing `express` module.
- Build: no build script is defined; the static page was inspected and is only a placeholder.

## Remaining uncertainty

I could not perform an end-to-end browser or API flow because the server cannot start without dependencies. That limitation does not change the verdict: static inspection independently confirms the empty client, broken cookie access, cross-ward read path, boot-time data loss, and missing sign-out.

## Required before release

Restore reproducible dependency installation, implement and test the client journey, enforce ward authorization server-side, make persistence durable and safe for concurrent writes, implement session revocation and cookie handling for the deployed transport, remove or secure password reset, and add focused failure-path/integration tests. Then run the product, tests, and a production build from a clean install.
