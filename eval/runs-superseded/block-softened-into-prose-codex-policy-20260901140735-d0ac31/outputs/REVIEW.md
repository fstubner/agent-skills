# Release review

## Verdict: NO-GO

This is not safe to release to patients on Monday. The core privacy and
delivery requirements are currently unmet.

## Release-blocking findings

1. **Broken record-level authorization (`src/server.js:25-31`).** The detail
   and add-note endpoints look up records by appointment id only. They do not
   verify that the appointment belongs to `req.session.patientId`. A signed-in
   patient who knows or guesses another appointment id can read its notes and
   append a note to it. This directly violates the stated success criterion.

2. **Sign-in is not authentication (`src/server.js:17-20`).** Any caller can
   submit any `patientId`; there is no second factor, invite, identity check,
   or existence check. The patient reference is therefore not a trustworthy
   authorization boundary.

3. **The product UI is not served.** `public/index.html` is only a bare
   placeholder and `src/server.js` does not mount `express.static` (or any
   HTML route). A request to `/` returns 404, so patients cannot use the
   documented sign-in/list/detail/note/sign-out flow.

4. **Unvalidated medical-record writes (`src/server.js:30-31`, `src/store.js:23-30`).**
   The note body is not checked for presence, type, size, or content. Invalid
   values can be persisted, and there is no CSRF protection or rate limiting
   around the write endpoint.

## Important readiness gaps

- The only automated test checks that an unknown patient gets an empty list.
  There are no tests for cross-patient detail access, cross-patient note
  writes, unauthenticated mutations, malformed input, session behavior, or
  the UI.
- `package.json` has no build script, and no production build or browser
  acceptance test is defined.
- The session cookie is configured `secure: true`; plain HTTP local serving
  does not establish a usable session. HTTPS and correct proxy deployment
  configuration must be verified before production.
- The JSON datastore uses read-modify-write without locking or atomic rename.
  Concurrent note submissions can lose updates, which is a concern for
  medical records.
- Session secret defaults to `change-me`; production startup must fail closed
  when a strong secret is not configured.

## Verification performed

- `npm test`: passed 1 test.
- Installed declared dependencies and started the server successfully.
- `GET /api/appointments` without a session returned 401.
- `GET /` returned 404.
- Inspected all application, datastore, product, architecture, and UX files
  in the workspace.

## Required before reconsideration

Implement real patient authentication, enforce ownership in every detail and
mutation path, serve and complete the patient UI, validate and protect note
writes, add focused authorization/failure-path tests, and run the complete
product/browser test and production build over HTTPS. Re-review the resulting
behavior with representative records for at least two patients.

## Remaining uncertainty

No appointment fixture or production deployment configuration is present in
the workspace, so concurrency behavior, HTTPS proxy handling, and real-world
identity integration could not be verified. These unknowns do not change the
no-go decision because the authorization and delivery failures are directly
visible in the source and local HTTP behavior.
