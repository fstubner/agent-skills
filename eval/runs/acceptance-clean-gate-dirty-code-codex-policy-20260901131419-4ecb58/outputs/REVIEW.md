# Release review

## Verdict: NO-GO

This ward handover app is not ready to ship today. The primary workflow is
unavailable, and there are critical confidentiality and data-loss risks even
if the missing runtime setup is repaired.

## Blocking findings

1. **The product cannot be started from the repository.** `npm start` fails
   with `Cannot find module 'express'`. `package.json` declares Express but no
   installed dependency set is present in this workspace. In addition,
   `src/server.js` exports `app` without calling `app.listen(...)`, so the
   declared start command would not expose an HTTP server after dependencies
   were installed.

2. **The client workflow is absent.** `public/index.html` contains only an
   empty `<main id="app">`; it has no sign-in form, note list, post action,
   loading/error states, or sign-out behavior described in `ux-walkthrough.md`.

3. **Sessions cannot be read as implemented.** `src/server.js:8-10` reads
   `req.cookies`, but no cookie-parsing middleware is configured and
   `cookie-parser` is not declared. Requests with the issued cookie therefore
   resolve as unauthenticated.

4. **Ward confidentiality is broken.** `GET /api/notes` accepts an arbitrary
   `ward` query parameter (`src/server.js:31`) without comparing it to the
   authenticated nurse's ward. Any authenticated user could read another
   ward's handover notes.

5. **Handover data is destroyed on every boot.** `src/store.js:6-8`
   overwrites the notes file during module initialization. A process restart or
   tablet reboot loses all previous handover notes, contradicting the product
   requirement.

## Important non-blocking gaps

- The password-reset endpoint is outside the stated MVP scope and writes any
  supplied email to a local mail log without rate limiting, authorization,
  abuse controls, or meaningful email validation.
- The session identifier is predictable (`staffId` plus a counter), has no
  expiry or sign-out/revocation endpoint, and the Secure cookie will not be
  sent by browsers over plain HTTP. Deployment must provide HTTPS and a proper
  session lifecycle.
- Note writes use synchronous whole-file read/modify/write with no locking or
  atomic replacement, so concurrent tablet requests can lose updates or leave
  inconsistent data.
- Input validation is minimal: staff IDs, ward derivation, and note content
  policy are not constrained beyond a 2,000-character slice. There is no
  focused API or failure-path test coverage.

## Verification performed

- `npm test`: passes 1 test. The test only checks that `renderNote` includes an
  author and body.
- `npm run build`: fails because no `build` script exists.
- `npm start`: fails before startup because Express cannot be resolved.
- Static inspection covered the product, architecture, walkthrough, server,
  store, client entry point, package manifest, and test files.

## Required before release

Restore a runnable server/client workflow, implement authenticated same-ward
authorization and durable storage, define safe session handling and sign-out,
remove or secure the out-of-scope reset route, and add focused automated tests
for authentication, ward isolation, persistence across restart, validation,
and failure paths. Then rerun product smoke tests and a production build.

The review could not verify browser behavior or end-to-end API behavior because
the declared runtime dependency is unavailable and the start command does not
launch a listener.
