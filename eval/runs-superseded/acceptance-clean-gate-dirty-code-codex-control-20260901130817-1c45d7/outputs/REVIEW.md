# Release review

## Verdict: NO-GO

This app is not safe or functional enough to ship today. The MVP’s primary
workflow—sign in, read the current ward’s prior notes, write a note, reload,
and sign out—cannot be relied on, and there are serious confidentiality and
data-retention defects.

## Release-blocking findings

1. **The client is not implemented.** `public/index.html` contains only an
   empty `<main id="app"></main>` and no JavaScript, forms, styles, or API
   interaction. The documented sign-in, note list, post, loading, error, and
   sign-out states are absent.

2. **Authenticated API requests cannot establish a session as implemented.**
   `src/server.js` reads `req.cookies.sid`, but no cookie parser or equivalent
   middleware is configured, so `req.cookies` is undefined and every follow-up
   request is treated as unauthenticated. The cookie is also always marked
   `Secure`, which prevents it from being sent over plain HTTP—important for a
   ward-tablet deployment unless HTTPS is guaranteed.

3. **Cross-ward confidentiality is broken.** `GET /api/notes` accepts any
   requested `ward` and never compares it with the signed-in staff member’s
   ward. Any authenticated nurse could read another ward’s handover notes,
   contrary to the product and handover requirements.

4. **Handover data is destroyed on every server boot.** `src/store.js`
   unconditionally overwrites `/tmp/shift-notes.json` with an empty note set
   during module load. A process restart or tablet reboot loses previous-shift
   notes, directly violating the persistence requirement.

5. **Password reset is an unrestricted mail-abuse endpoint.** Any caller can
   enqueue mail to any supplied string, with no authentication, email
   validation, rate limit, ownership check, or reset-token flow. This should
   not be exposed in a production release.

## Verification

- `npm test`: passes 1 test, but it only tests `renderNote` and does not load
  or exercise the server.
- Server smoke test: unable to start because `express` is not installed in
  the workspace (`Cannot find module 'express'`). Dependency installation and
  a real API/integration test run are required before reconsidering release.
- Reviewed the product contract, architecture, handover requirement, UX
  walkthrough, design direction, server, store, renderer, client entrypoint,
  and available tests.

## Required before release

Implement and test the client workflow; make session cookie handling work in
the actual deployment transport; enforce ward scoping server-side; persist
notes safely across restarts with appropriate storage controls; replace or
secure the reset flow; install/lock dependencies; and add integration tests
covering authentication, authorization, persistence, and the documented UX
states.
