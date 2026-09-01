# Release review

## Verdict: NO-GO

This is not ready for patients on Monday. The stated MVP is not present end to end, and the authorization boundary for medical records is broken.

## Findings

- **Critical — cross-patient data exposure:** `GET /api/appointments/:id` looks up an appointment by ID but never verifies that its `patientId` matches the signed-in patient. Any authenticated patient who can guess an ID can read another patient's appointment and clinician notes.
- **Critical — cross-patient record modification:** `POST /api/appointments/:id/notes` has the same missing ownership check. An authenticated patient can add a note to another patient's appointment.
- **Critical — no usable patient UI:** `public/index.html` contains only a title and an empty `<main>`; it has no sign-in form, appointment list/detail, note form, sign-out flow, loading state, empty state, or save-error handling. The server also does not serve the `public/` directory.
- **High — unauthenticated sign-in:** `/api/sign-in` accepts any `patientId` without validation or an authentication factor. This permits impersonating any known/reference-formatted patient ID and undermines the stated sign-in requirement.
- **High — deployment/runtime failure in this workspace:** `npm start` cannot load because `express` is declared but not installed (`ERR_MODULE_NOT_FOUND`). There is no lockfile or documented install/deployment procedure.
- **High — session configuration is unsafe for the documented server setup:** the session cookie is always `secure: true`; over ordinary HTTP this prevents the browser from sending the session cookie. The fallback session secret is `change-me`, which is not suitable for production.
- **Medium — insufficient validation and failure handling:** request bodies and note content are not validated; malformed or empty patient IDs/notes are accepted. JSON-file writes have no locking or error handling, so concurrent note writes can lose data and a failed write can surface as an uncontrolled server error.
- **Medium — test coverage does not protect the release criteria:** only one test exists, covering `appointmentsFor('nobody')`. There are no API tests for authentication, ownership on read/write, sign-out, validation, persistence failures, or the required UI flows.

## Verification performed

- Read the product brief, architecture, UX walkthrough, design direction, source, and test files.
- Ran `npm test`: 1 test passed.
- Ran the available build command (`npm run build --if-present`): no build script is defined, so no build was performed.
- Attempted to start the product: startup failed before listening because the `express` dependency is unavailable.
- Reviewed the route and datastore code for the stated patient-isolation requirement; the two ID-based routes lack the required ownership predicate.

## Required before release

Implement and test the complete patient flow; enforce ownership on every record read and write; establish real patient authentication and production session-secret handling; validate inputs; make the server serve the client; install and lock dependencies; and run automated tests, a production build, and an authenticated end-to-end smoke test against representative patient records.

## Remaining uncertainty

No seeded appointment data or deployment configuration was present in the workspace, so production infrastructure, TLS, backup/recovery, and real authentication integration could not be assessed. Those unknowns do not change the no-go decision because the application fails the core MVP and privacy acceptance criteria in its current form.
