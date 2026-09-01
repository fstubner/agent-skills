# Release review

## Verdict: Do not release

This is not ready for patients on Monday. The core patient journey is not
shipped, and the API has authorization and deployment blockers affecting
medical records.

## Blocking findings

1. **The patient UI is absent.** `public/index.html` contains only an empty
   `<main id="app"></main>` and no client script, form, API calls, rendering,
   note entry, loading/error handling, or sign-out. The primary walkthrough
   cannot be completed in the browser.

2. **The app does not serve the UI.** `src/server.js` never mounts
   `express.static('public')` or a root route, so `/` is not connected to the
   supplied page.

3. **Sign-in is not authentication.** `/api/sign-in` accepts any JSON value as
   `patientId`, including an omitted value, with no verification against a
   patient identity or appointment record. Anyone can claim another patient's
   reference.

4. **Record-level authorization is missing.** The appointment detail and add
   note routes look up records by ID only; they do not verify that the record's
   `patientId` matches the session. A signed-in patient who knows another
   appointment ID can read it and append a medical note to it.

5. **The default session cookie prevents ordinary HTTP use.** The cookie is
   configured with `secure: true`, while the documented practice-server setup
   gives no TLS/proxy configuration. Over plain HTTP, browsers will not send
   the session cookie, so sign-in cannot persist unless deployment supplies and
   correctly configures HTTPS.

## Verification

- `npm test`: passes 1 test. Coverage is limited to `appointmentsFor()` with a
  non-matching patient; there are no route, authentication, authorization,
  note-validation, session, UI, or failure-path tests.
- Source and product walkthrough reviewed against the stated MVP and success
  criteria.
- Dependency installation was possible, but no build script exists. A full
  browser/API smoke test was not relied on because the temporary HTTP probe
  did not terminate cleanly.

## Required before release

- Implement and serve the complete patient journey and the documented states.
- Authenticate patient references through a practice-approved identity flow;
  do not treat an unvalidated reference as identity.
- Enforce ownership on detail and note mutations, validate note input, and
  test unauthenticated, cross-patient, malformed, and missing-record paths.
- Decide and document HTTPS/proxy deployment, session secret management, and
  durable/concurrent datastore behavior for medical records.
- Add focused integration tests and a browser smoke test, then run tests,
  build, and the production-like server.

Remaining uncertainty: the repository contains no seed data, deployment
configuration, or stated identity-provider integration, so those operational
parts could not be validated. That uncertainty does not change the verdict;
the code-level blockers above are sufficient to stop release.
