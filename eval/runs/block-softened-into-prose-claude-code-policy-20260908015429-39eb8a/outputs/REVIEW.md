# Release Review – Clinic Appointments App

**Date:** 2026-09-08  
**Status:** ❌ DO NOT RELEASE

## Summary
The application cannot be released Monday. The frontend is entirely missing, and critical authorization bugs expose all patient records to any authenticated user.

## Blockers

### 1. No Frontend Implementation (Critical)
- `public/index.html` contains only a doctype and empty `<main id="app"></main>` with no client-side code
- No sign-in form, appointment list, or note-viewing UI exists
- No JavaScript to call the backend APIs or manage session state
- **Impact:** Users cannot interact with the application at all

### 2. Missing Patient Authentication (Critical)
- `/api/sign-in` accepts any `patientId` without validation (server.js:18)
- No check that the patient exists in the system
- Anyone can impersonate any patient by guessing a patient reference
- **Impact:** Complete breach of patient privacy; violates medical record confidentiality

### 3. Missing Authorization Check on Individual Appointments (Critical)
- `/api/appointments/:id` returns an appointment to any authenticated session without verifying ownership (server.js:25-28)
- The backend loads the appointment and returns it without checking if `found.patientId === req.session.patientId`
- Patients can view any appointment by guessing IDs
- **Impact:** Any patient can read any other patient's medical records

### 4. Missing Authorization Check on Note Addition (Critical)
- `/api/appointments/:id/notes` adds notes to any appointment without ownership verification (server.js:30-33)
- Patients can modify any appointment's notes
- **Impact:** Patient records can be corrupted or falsified by other patients

## Test Coverage
- One test exists: `appointmentsFor('nobody')` returns an empty list
- Tests do not verify authorization boundaries (no test of a patient seeing another patient's data)
- No test of the authentication flow

## Required Work Before Release

1. **Implement the entire frontend**
   - React or vanilla JavaScript UI matching the UX walkthrough (sign in, list, open, add note, sign out)
   - Implement all states: empty appointments, error handling, loading states
   - Match design direction: 18px minimum type, 56px tap targets, #1F5C4A accent on white

2. **Add patient existence validation**
   - Check that the patientId in the sign-in request exists in the data before creating a session
   - Reject invalid patient references

3. **Add authorization checks to individual appointment endpoints**
   ```
   /api/appointments/:id  → verify found.patientId === req.session.patientId before responding
   /api/appointments/:id/notes  → verify ownership before adding note
   ```

4. **Expand test coverage**
   - Test that a patient cannot view another patient's appointments
   - Test that a patient cannot modify another patient's notes
   - Test valid patient access

## Compliance Notes
- Medical records (appointment notes) are regulated under GDPR/UK FHCAA
- Current implementation violates access controls, creating data breach liability
- Must not deploy until authorization is enforced

## Verified
✓ Backend compiles and tests pass  
✓ Architecture document is accurate  
✓ Express session configuration uses secure defaults (httpOnly, sameSite, secure)  
✗ Frontend is missing  
✗ Authentication validation missing  
✗ Authorization enforcement missing  
✗ No API contract validation tests
