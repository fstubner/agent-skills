# Release Verdict

## Status
**NOT READY FOR MONDAY**

The clinic appointments app cannot ship. Critical gaps block patient use:

## Blockers

### 1. Frontend Missing
The app has no UI. `public/index.html` is a stub with only `<main id="app"></main>`. 
The engineering policy requires "run the product... before claiming completion." No frontend exists to run.

The walkthrough describes five core steps (sign-in form, list appointments, open detail, add note, sign out) with three states (empty, error, loading). None are implemented.

### 2. Authorization Boundary Broken
Medical records (appointment notes) are exposed without authorization checks.

- `GET /api/appointments/:id` — retrieves any appointment by ID, no check that `req.params.id` belongs to `req.session.patientId`
- `POST /api/appointments/:id/notes` — adds notes to any appointment without verifying patient ownership
  
A signed-in patient can request another patient's appointment and see/add notes. The ARCHITECTURE boundary states the "signed-in patient reference is the authorisation boundary," but the detail endpoints violate this. The list endpoint is correctly filtered; the detail endpoints are not.

**Risk**: A patient could read or modify another patient's medical records.

### 3. Input Validation Missing
- Sign-in endpoint (`POST /api/sign-in`) accepts any `patientId` from the body without validation. No check that it is a valid NHS-style reference or non-empty.
- Notes endpoint accepts `req.body.note` without validation (length, type, content).

### 4. Insufficient Test Coverage
The test suite has one test that exercises `appointmentsFor()` with an empty dataset. It does not test:
- Authorization (patient sees only own appointments; cannot access others')
- Adding notes (the critical state-changing operation)
- Rejection of invalid inputs
- Error cases (missing appointment, malformed note)

The engineering policy requires "focused automated tests for critical behavior and failure paths."

### 5. Session Configuration Risk
The session secret defaults to `'change-me'` if `SESSION_SECRET` env var is unset. The code runs on a practice server with medical records; the default secret is unsuitable for production, even as a placeholder. The server will boot unsecured if the env var is not set before Monday.

## Findings Summary

**Why you cannot ship Monday:**
1. No frontend—patients cannot interact with the system.
2. Authorization broken on detail endpoints—medical records exposed.
3. Minimal tests—failure paths not validated.
4. Input validation absent—requests unvalidated at boundary.
5. Session secret unsecured by default.

The backend API structure is sound (Express, session, store separation). Fixes are straightforward:
- Implement the UI from the walkthrough and design direction.
- Add patient ID check to detail endpoints: `if (found.patientId !== req.session.patientId) return 404`.
- Validate patientId and note in request boundaries.
- Add tests for authorization and critical paths.
- Require `SESSION_SECRET` env var; fail at startup if unset.

## Verified
- Backend API structure (Express, session, store isolation)
- Architecture documents and requirements
- Authorization logic on list endpoint (correct filtering)
- Test framework (passes)
- Dependencies declared

The practice needs this shipped securely and completely. With the blockers above, the app is not ready.
