# Release Review — Clinic Appointments

**Date:** 2026-09-01  
**Status:** NOT APPROVED FOR RELEASE

---

## Summary

The app cannot ship on Monday. Critical functionality and security issues prevent patients from using it. The backend API is partially implemented but the frontend is missing entirely, and the authorization boundary has a serious vulnerability.

---

## Critical Issues (Blocking)

### 1. No User Interface
- **Severity:** Critical
- **Impact:** App is unusable
- **Details:** `public/index.html` contains only a doctype, title, and empty `<main>` element. No form, no appointment list, no notes display, no JavaScript to render or interact with the backend.
- **Requirement:** UX walkthrough specifies sign-in form, appointment list, appointment detail view with notes, and ability to add notes. None of these exist.

### 2. Missing Client-Side Code
- **Severity:** Critical
- **Impact:** No way for patients to call the API
- **Details:** No JavaScript files exist to implement the sign-in flow, list appointments, fetch appointment details, or submit notes. The backend API exists but has no consumer.

### 3. Authorization Vulnerability: Cross-Patient Access
- **Severity:** Critical  
- **Impact:** Patients can view any other patient's records
- **Details:** 
  - `/api/appointments/:id` endpoint retrieves an appointment by ID but does NOT verify it belongs to the signed-in patient.
  - A signed-in patient (or attacker who knows a patient ID) can access any appointment by knowing or guessing the ID.
  - `/api/appointments/:id/notes` has the same vulnerability.
  - Violates the core requirement: "A patient can see their own appointments and notes, and cannot see anyone else's."

### 4. Unvalidated Sign-In
- **Severity:** High
- **Impact:** Authentication is ineffective
- **Details:**
  - `/api/sign-in` accepts any `patientId` in the request body without validation.
  - No check against a list of valid patients.
  - A user can claim to be any patient ID, including inactive, deleted, or non-existent patients.
  - Combined with issue #3, this allows access to any patient record.

---

## Test Coverage Issues

### Insufficient Authorization Testing
- **Severity:** High
- **Details:**
  - `test/store.test.js` only tests that `appointmentsFor('nobody')` returns an empty array.
  - Does NOT test the authorization boundary: that a patient cannot see other patients' appointments.
  - Does NOT test the API endpoints: `/api/sign-in`, `/api/appointments/:id`, `/api/appointments/:id/notes`.
  - Does NOT test the core requirement in any form.

---

## Missing Functionality

### UX Walkthrough Not Implemented
The walkthrough specifies five steps; none are implemented:
1. ~~Sign-in form~~ — No UI exists
2. ~~Land on own appointments~~ — No appointment list UI
3. ~~Open an appointment~~ — No detail view UI
4. ~~Add a note~~ — No form to submit notes
5. ~~Sign out~~ — No sign-out button

### Handling Empty and Error States
- Walkthrough specifies handling for: "You have no appointments," failed saves, and loading placeholders.
- No implementation for any of these.

---

## Medical Records Risk

Appointment notes are explicitly designated as medical records (per PRODUCT.md). The authorization vulnerability (#3) means:
- Unauthorized access to protected health information
- Regulatory exposure under data protection laws
- Patient privacy violation
- Clinic liability

This alone makes the app unsuitable for Monday deployment.

---

## What IS Working

- Backend Express server loads and accepts connections (not tested, but structure is sound).
- Session middleware is configured with secure defaults (`httpOnly`, `sameSite: lax`, `secure: true`).
- Session serialization is correctly implemented.
- Store functions (`appointmentsFor`, `appointment`, `addNote`) work for their narrow scope.

---

## Required Before Release

**Minimum viable fixes:**

1. **Implement the frontend UI** in `public/index.html` and associated JavaScript:
   - Sign-in form with patient ID input
   - Appointment list (sorted by date, soonest first)
   - Appointment detail view with notes
   - Form to add a new note
   - Sign-out button
   - Loading and empty states

2. **Fix authorization in the API:**
   - Verify every appointment access against the signed-in patient's ID
   - Return 403 Forbidden (not 404) if the patient does not own the appointment
   - Apply to both GET and POST endpoints

3. **Validate patient sign-in:**
   - Require a list of valid patient IDs (e.g., in `appointments.json` or a separate file)
   - Reject sign-in for unrecognized patient IDs

4. **Add comprehensive tests:**
   - Test authorization boundary (patient cannot see others' records)
   - Test API endpoints with signed-in sessions
   - Test edge cases: empty appointment list, adding notes, failed operations

5. **Integration test:**
   - Run the server and walk through the full UX scenario in a browser

---

## Recommendation

Do not release. Reschedule deployment for after the above fixes are verified and tested. The authorization vulnerability and missing UI prevent any patient from successfully using the app, and expose the clinic to privacy and compliance risk.

The engineering policy requires validating inputs and authorization at trust boundaries (✗), and running the product before claiming completion (✗ — no UI to run).
