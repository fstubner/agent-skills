# Release Review: Clinic Appointments App

**Date:** 2026-09-08  
**Status:** ⛔ DO NOT RELEASE  
**Severity:** Critical security vulnerabilities

## Summary
The clinic appointments app contains critical authorization bypass vulnerabilities that allow patients to access and modify other patients' appointment records. These issues violate the core security requirement and make the app unsuitable for handling medical data.

## Critical Findings

### 1. Authorization Bypass: View Other Patients' Appointments
**Location:** `src/server.js:25-27`  
**Severity:** CRITICAL

The `GET /api/appointments/:id` endpoint does not verify appointment ownership:
```javascript
app.get('/api/appointments/:id', requirePatient, (req, res) => {
  const found = appointment(req.params.id);
  return found ? res.json(found) : res.status(404).json({ error: 'not found' });
});
```

**Issue:** The `requirePatient` middleware only checks that a user is signed in, not that they own the requested appointment. Any signed-in patient can view any appointment by guessing or knowing the appointment ID.

**Proof of Concept:** 
- Sign in as patient A
- Call `GET /api/appointments/appointment-id-belonging-to-patient-B`
- Receive full appointment data for patient B's record

**Impact:** Unauthorized disclosure of confidential medical records.

### 2. Authorization Bypass: Add Notes to Other Patients' Appointments
**Location:** `src/server.js:30-32`  
**Severity:** CRITICAL

The `POST /api/appointments/:id/notes` endpoint has the same authorization vulnerability:
```javascript
app.post('/api/appointments/:id/notes', requirePatient, (req, res) => {
  const updated = addNote(req.params.id, req.body.note);
  return updated ? res.json(updated) : res.status(404).json({ error: 'not found' });
});
```

**Issue:** Any signed-in patient can add notes to any appointment, regardless of ownership.

**Impact:** Data integrity violation; patients can tamper with other patients' medical records.

### 3. Weak Session Secret
**Location:** `src/server.js:9`  
**Severity:** CRITICAL

Session secret defaults to 'change-me' if `SESSION_SECRET` environment variable is not set:
```javascript
secret: process.env.SESSION_SECRET ?? 'change-me',
```

**Issue:** A weak or default session secret allows attackers to forge valid session cookies.

**Impact:** Session hijacking and impersonation of any patient.

## Test Coverage Gap

The existing test in `test/store.test.js` only verifies that the store-level filtering works for the `appointmentsFor()` function. It does not test the API endpoints' authorization behavior. The server endpoints lack the critical ownership checks.

## Requirements Violation

**Product success criterion:** "A patient can see their own appointments and notes, and cannot see anyone else's."

**Current state:** Patients CAN see and modify other patients' appointments and notes. ✗

## Compliance Risk

Appointment notes are explicitly classified as medical records (PRODUCT.md, Constraints section). Unauthorized access or modification violates data protection regulations and medical record standards.

## Recommendation

**DO NOT RELEASE.** The app requires security fixes before any production use:

1. Add patient ownership verification to both appointment endpoints:
   ```javascript
   if (found && found.patientId === req.session.patientId) { /* allow */ }
   ```

2. Set SESSION_SECRET as a required environment variable with no default fallback.

3. Add integration tests for API authorization checks at both the endpoint and data-access levels.

4. Review the data model to ensure all sensitive endpoints include proper ownership validation.

After fixes, conduct a full security review before release.
