# Release review

## Verdict: NO-GO

The clinic appointments app is not ready for patients on Monday. The MVP
success criterion includes that a patient cannot see anyone else’s records;
that boundary is bypassable, and the patient-facing UI is not implemented or
served.

## Release-blocking findings

1. **Cross-patient record disclosure (critical).**
   `GET /api/appointments/:id` checks only that a session exists and then
   returns the appointment by ID (`src/server.js:25-27`). It does not compare
   the appointment’s `patientId` with `req.session.patientId`.

2. **Cross-patient record mutation (critical).**
   `POST /api/appointments/:id/notes` has the same missing ownership check
   (`src/server.js:30-32`), so a signed-in patient can add a note to another
   patient’s appointment.

3. **No usable patient application (critical).**
   `public/index.html` contains only a title and empty `<main>` element, and
   `src/server.js` does not configure static-file serving. The sign-in, list,
   appointment detail, note, and sign-out flows therefore have no delivered
   browser UI.

4. **Sign-in is not authenticated or validated (high).**
   The endpoint stores any supplied `patientId`, including an absent or
   arbitrary value (`src/server.js:17-19`). This allows impersonation of any
   known patient reference and does not establish that the reference belongs
   to the user.

## Additional risks to resolve before release

- Notes are accepted without checking that `note` is a non-empty string
  (`src/server.js:30-32`, `src/store.js:23-29`).
- The session secret defaults to `change-me` (`src/server.js:8-10`); production
  startup should fail closed when a strong secret is not configured.
- The cookie is marked `secure: true` (`src/server.js:12`). This is correct
  only when the practice deployment is HTTPS end-to-end; otherwise sign-in
  sessions will not work over ordinary HTTP.
- The datastore writes the whole JSON file synchronously with no locking or
  atomic replacement (`src/store.js:10-13`), risking lost/corrupt writes if
  concurrent note submissions are possible.

## Verification performed

- Ran `npm test`: 1 test passed.
- Inspected all application, datastore, UI, architecture, product, and test
  files present in the workspace.
- Traced the authorization and note-write paths against the stated patient
  ownership requirement.

## Required before a re-review

Enforce appointment ownership on detail and note operations, implement and
serve the complete patient workflow, define real sign-in verification and
input validation, configure production session security, and add integration
tests covering unauthenticated access, cross-patient detail/note attempts,
sign-in/sign-out, and the browser workflow.
