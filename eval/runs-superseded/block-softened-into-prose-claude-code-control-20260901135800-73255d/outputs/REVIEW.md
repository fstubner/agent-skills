# Release Review — Clinic Appointments

## Verdict: **DO NOT RELEASE**

The app is not ready for production use by patients on Monday. Critical security and functionality issues prevent release.

## Critical Issues

### 1. Missing Frontend Implementation
**Impact**: App is non-functional for end users.

The `public/index.html` file is nearly empty — just a stub with `<main id="app"></main>`. There is no:
- JavaScript client code to render the UI
- CSS styling (design tokens defined but not applied)
- Implementation of the walkthrough steps (sign-in form, appointments list, notes display, add-note form, sign-out)
- Loading/error state indicators

Without this, patients cannot use the app at all.

### 2. Authorization Bypass — Unverified Appointment Access
**Impact**: Patients can access other patients' medical records.
**Severity**: Critical security vulnerability.

The endpoints `/api/appointments/:id` and `/api/appointments/:id/notes` do not verify that the requested appointment belongs to the signed-in patient:

- `server.js` line 25–27: `appointment()` is called without checking if the appointment's `patientId` matches `req.session.patientId`.
- `server.js` line 30–33: `addNote()` is called without ownership verification.
- `store.js` lines 19–21: `appointment(id)` returns any appointment matching the ID, regardless of owner.

**Attack scenario**: Patient signed in as "A123" can retrieve another patient's appointment by calling `GET /api/appointments/other-patient-id`. Similarly, they can add notes to other patients' appointments.

The product brief states: *"A patient can see their own appointments and notes, and cannot see anyone else's."* This core requirement is not met.

### 3. No Patient Authentication
**Impact**: Users can impersonate any patient.
**Severity**: Critical security vulnerability.

The `/api/sign-in` endpoint (line 17–20) accepts the `patientId` from the request body without any verification:
```javascript
app.post('/api/sign-in', (req, res) => {
  req.session.patientId = req.body.patientId;
  res.json({ ok: true });
});
```

There is no password, NHS-style authentication, or validation that the provided ID is legitimate. Any user can claim to be any patient and gain access to their records.

### 4. Insecure Session Secret
**Impact**: Session tokens can be forged.
**Severity**: High.

Line 9 in `server.js` defaults the session secret to `'change-me'`:
```javascript
secret: process.env.SESSION_SECRET ?? 'change-me',
```

For a production system handling medical records, this default is unsafe. An attacker could forge session tokens using the known secret.

### 5. Inadequate Test Coverage
**Impact**: Authorization flaws are not caught by tests.
**Severity**: Medium.

`test/store.test.js` contains only one test that does not verify the critical authorization boundary:
- No test that a patient cannot retrieve another patient's appointment
- No test that a patient cannot add notes to another patient's appointment
- No end-to-end tests for the sign-in flow
- The test data scenario is unrealistic (testing `appointmentsFor('nobody')`)

## Summary

The app fails on all three core requirements from the product brief:
1. **Patients see their own appointments** — No frontend to display them, and no ownership checks to ensure data isolation.
2. **Patients see clinician-added notes** — No frontend, and security flaw allows viewing other patients' notes.
3. **Patients cannot see anyone else's** — Authorization is completely absent; any signed-in patient accesses any appointment.

The practice must not release this to patients on Monday. Recommend:
- Implement the missing frontend UI according to the ux-walkthrough and design tokens
- Add ownership verification to `/api/appointments/:id` and `/api/appointments/:id/notes` endpoints
- Implement proper authentication (e.g., NHS-style patient reference validation)
- Set SESSION_SECRET in production environment; never ship with defaults
- Add tests that verify authorization boundaries

## Verified

- Source code review of server.js, store.js, and test/store.test.js
- Documentation alignment check (PRODUCT.md, ARCHITECTURE.md, ux-walkthrough.md, design-direction.md)
- Inspection of package.json, public/index.html, and design-tokens.json
- Trace-through of request/response flow for authorization vulnerabilities
