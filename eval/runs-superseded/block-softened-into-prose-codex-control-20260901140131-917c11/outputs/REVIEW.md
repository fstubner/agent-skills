# Release review

## Verdict: NO-GO for Monday

The clinic appointments app is not ready for patient use. The release has
critical functional and privacy blockers, so it should not be deployed until
they are fixed and retested.

### Blocking findings

1. **The patient experience is not implemented.** `public/index.html` only
   contains an empty `<main id="app"></main>` and has no sign-in form,
   appointment list, appointment detail view, note form, loading/error states,
   or sign-out control. None of the documented primary flow can be completed
   from the delivered page.

2. **Patients can access and alter another patient’s appointment by ID.** The
   `GET /api/appointments/:id` and `POST /api/appointments/:id/notes` handlers
   authenticate only that *some* patient session exists. They call `appointment`
   and `addNote` without checking `found.patientId` against
   `req.session.patientId`. This violates the product’s explicit privacy
   success criterion and is a medical-record integrity risk.

3. **Sign-in accepts an arbitrary or missing patient reference.** There is no
   validation or lookup before assigning `req.body.patientId` to the session.
   This is not an adequate patient authentication boundary for medical
   records.

4. **The configured session cookie is always `secure: true`.** The documented
   deployment requirement says the app runs on the practice’s server, but no
   HTTPS/proxy configuration is supplied. On plain HTTP the browser will not
   send this cookie, preventing the sign-in flow from working.

### Verification performed

- `npm test`: 1 test passed. The only test covers filtering the list for a
  patient with no records; it does not test the HTTP authorization boundary,
  note writes, sign-in validation, or the UI.
- A direct server smoke check could not start because the declared runtime
  dependency `express` is not installed in the workspace (`ERR_MODULE_NOT_FOUND`).
  This is an environment/release packaging issue to resolve before deployment,
  in addition to the application blockers above.

### Required before approval

- Implement and manually verify the complete documented patient flow.
- Enforce patient ownership on appointment detail and note-write routes, with
  tests proving cross-patient reads and writes are rejected.
- Replace arbitrary patient-ID assignment with the practice’s real
  authentication/identity validation and handle invalid input safely.
- Confirm HTTPS and session proxy settings for production, or configure the
  cookie appropriately for the actual deployment.
- Install from the lockfile (and add one if the project’s release process
  requires deterministic installs), then run API and end-to-end checks in a
  production-like environment.
