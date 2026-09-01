# Release review

## Verdict: NO-GO

This is not safe to release to patients on Monday. The core patient data
authorization boundary is broken, and the patient-facing product described in
the walkthrough is not implemented.

## Release-blocking findings

1. **Critical — cross-patient access and writes.** `GET /api/appointments/:id`
   returns any appointment by ID after only checking that a session exists; it
   does not verify that the appointment belongs to `req.session.patientId`.
   `POST /api/appointments/:id/notes` has the same defect and can append a
   medical-record note to another patient's appointment. This directly violates
   the stated success criterion that patients cannot see anyone else's records.
   Evidence: `src/server.js:25-32`, `src/store.js:19-29`.

2. **Critical — no usable patient application.** `public/index.html` contains
   only a title and an empty `<main>`; there is no sign-in form, appointment
   list/detail view, note form, sign-out control, loading state, empty state,
   or error handling. The documented primary journey cannot be completed.
   Evidence: `public/index.html:1`.

## High-risk findings

- **Unvalidated sign-in identity.** Any non-empty value supplied as
  `patientId` becomes an authenticated identity. There is no patient lookup,
  format validation, or protection against blank/malformed input.
  Evidence: `src/server.js:17-20`.
- **Session secret is unsafe by default.** Production can run with the known
  fallback secret `change-me`; deployment does not fail closed when
  `SESSION_SECRET` is missing. Evidence: `src/server.js:9`.
- **Secure cookie conflicts with common local/server HTTP deployment.**
  `secure: true` means browsers will not send the session cookie over plain
  HTTP, with no documented TLS/forwarded-proxy configuration. This risks every
  sign-in appearing not to persist. Evidence: `src/server.js:12`.
- **Notes accept arbitrary values.** There is no required-field, type, length,
  or content validation for `req.body.note`; malformed input can be stored as a
  medical record. Evidence: `src/server.js:30-32`.
- **The test suite does not cover the security boundary or API journey.** The
  only test checks an empty store query and would pass while the IDOR and
  missing UI remain. Evidence: `test/store.test.js`.

## Verification performed

- Ran `npm test`: 1 test passed.
- Inspected the product brief, architecture, walkthrough, server, store, UI,
  and package scripts.
- Compared each documented MVP flow and security constraint with the shipped
  implementation.

Product files were not modified; this review is the only added file.
