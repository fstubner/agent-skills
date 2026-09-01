# Release Review: Clinic Appointments App

**Date**: 2026-09-01  
**Planned Release**: Monday (2026-09-06)  
**Verdict**: ❌ **NOT APPROVED FOR RELEASE**

---

## Summary

The app has critical gaps and security vulnerabilities that make it unsafe and non-functional for patient use. The entire user interface is missing, and the backend has unmitigated authorization flaws that would allow patients to access each other's medical records.

---

## Critical Issues

### 1. **Missing User Interface (Blocker)**
- **Status**: Complete absence
- **Impact**: Patients cannot use the app at all
- **Details**:
  - `public/index.html` is an empty shell with no JavaScript
  - No client-side code exists to render the sign-in form, appointment list, or note-taking interface
  - The UX walkthrough specifies required flows (sign in → view appointments → read notes → add note → sign out) that have no implementation
  - Server API endpoints exist but are unreachable by patients without client code

### 2. **Authorization Bypass: Patients Can Access Any Appointment (Critical Security Flaw)**
- **Location**: `src/server.js:25-27` (GET `/api/appointments/:id`)
- **Issue**: Endpoint retrieves ANY appointment by ID without verifying ownership
- **Vulnerability**: A signed-in patient with ID "P001" can fetch appointment details for any other patient by guessing or enumerating appointment IDs
- **Impact**: Unauthorized access to medical notes from other patients
- **Example Attack**: 
  ```
  // Patient signs in as P001
  // Makes request to /api/appointments/999
  // Can read notes from patient P999 even though notes are not theirs
  ```
- **Required Fix**: Validate that `appointment.patientId === req.session.patientId` before returning data

### 3. **Authorization Bypass: Patients Can Add Notes to Any Appointment (Critical Security Flaw)**
- **Location**: `src/server.js:30-32` (POST `/api/appointments/:id/notes`)
- **Issue**: Endpoint adds a note to ANY appointment without verifying ownership
- **Vulnerability**: A patient can write notes into another patient's medical record
- **Impact**: Data integrity violation; medical records are tampered
- **Required Fix**: Validate appointment ownership before adding notes

### 4. **No Patient Validation on Sign-In (Critical Security Flaw)**
- **Location**: `src/server.js:17-19` (POST `/api/sign-in`)
- **Issue**: Accepts any `patientId` from the request body without checking against a valid patient list
- **Vulnerability**: A user can claim to be any patient ID. No verification that the patient exists or that they are who they claim to be
- **Impact**: Complete authentication bypass; any user can impersonate any patient
- **Required Fix**: 
  - Require a password or multi-factor identifier in addition to patient ID
  - Validate the patient ID against a known list of enrolled patients
  - Implement rate limiting to prevent brute-force attacks

### 5. **Hardcoded Weak Session Secret (Security Flaw)**
- **Location**: `src/server.js:9`
- **Issue**: `secret: process.env.SESSION_SECRET ?? 'change-me'`
- **Vulnerability**: Default secret is "change-me" — easily guessable. If `SESSION_SECRET` env var is not set in production, session tokens can be forged
- **Impact**: Attackers can forge session cookies and impersonate any patient
- **Required Fix**: 
  - Fail fast: throw an error if SESSION_SECRET is not set in production
  - Use a cryptographically secure random string (minimum 32 bytes)

### 6. **Missing HTTPS Enforcement**
- **Location**: `src/server.js:12`
- **Issue**: `secure: true` flag on cookies requires HTTPS, but no redirect or enforcement exists
- **Vulnerability**: If deployed over HTTP (common in development or misconfigured), secure cookies won't be sent, undermining session security
- **Impact**: Session tokens exposed in transit; user sessions vulnerable
- **Note**: While the code *intends* HTTPS, there's no fallback or clear error if HTTPS isn't available

---

## Additional Issues

### 7. **Insufficient Test Coverage**
- **File**: `test/store.test.js`
- **Issue**: Only one test; no coverage of authorization logic or the critical appointment access check
- **Impact**: No automated verification that patients cannot access others' records
- **Needed**: Tests for:
  - Patient can fetch only their own appointments
  - Patient cannot fetch another patient's appointment by ID
  - Patient cannot add notes to another patient's appointment

### 8. **No Input Validation**
- Notes added via POST have no length limits, type checks, or sanitization
- Appointment IDs and patient IDs are not validated for format or existence
- Risk of storing malformed data or enabling injection attacks

### 9. **Missing Error Handling**
- Store operations (file I/O) have minimal error recovery
- If `.data/appointments.json` becomes corrupted, the app silently returns empty data
- No logging for debugging or auditing access

---

## Compliance with Requirements

| Requirement | Status | Notes |
|---|---|---|
| Sign in | ❌ No UI | Endpoint exists but no form to call it; auth is unsecured |
| View own appointments | ❌ No UI + Authorization broken | Cannot view; even if UI existed, can access others' records |
| View notes | ❌ No UI + Authorization broken | Cannot see; authorization flaw allows cross-patient access |
| Add notes | ❌ No UI + Authorization broken | Cannot add; can add to anyone's appointment |
| Sign out | ❌ No UI | Endpoint exists but unreachable |
| **Authorization boundary**: patient sees own records only | ❌ FAILED | No verification of ownership; complete bypass |
| Medical records security | ❌ FAILED | Hardcoded secrets, no HTTPS enforcement, any patient can add notes to any record |

---

## Risk Assessment

**Patient Safety**: 🔴 CRITICAL  
- Medical records can be accessed and modified by other patients
- Potential for fraud, coercion, or unauthorized access to sensitive health information

**Regulatory**: 🔴 CRITICAL  
- NHS patient data is protected under UK GDPR and Data Protection Act 2018
- Unauthorized access and modification of medical records violates these regulations
- App cannot go live in this state without legal liability

**Operational**: 🔴 CRITICAL  
- App is non-functional; patients cannot use it
- No fallback to phone call process if app is deployed

---

## Recommended Actions Before Release

**Do not release.** Before any deployment:

1. **Implement the complete UI** (mandatory)
   - Client-side JavaScript to render all flows from UX walkthrough
   - Responsive design per design direction (18px minimum text, 56px tap targets)

2. **Fix all authorization flaws** (mandatory)
   - Validate `req.session.patientId` matches the resource being accessed on every protected endpoint
   - Implement proper authentication (not just patient ID)

3. **Implement patient identity verification** (mandatory)
   - Require NHS patient reference + password or PIN
   - Maintain a patient roster and validate against it

4. **Secure the session secret** (mandatory)
   - Use strong, random secret from environment variable
   - Fail if not set in production

5. **Add comprehensive tests** (mandatory)
   - Authorization tests for cross-patient access
   - Full flow tests from sign-in to note addition

6. **Add input validation** (mandatory)
   - Validate and sanitize all user inputs
   - Validate appointment IDs and patient IDs against known data

7. **Implement HTTPS enforcement** (recommended)
   - Redirect HTTP to HTTPS
   - Verify secure cookies work in deployment environment

8. **Add audit logging** (recommended)
   - Log all access to medical records for compliance and forensics
   - Track who accessed what and when

9. **Add error handling and recovery** (recommended)
   - Graceful handling of file I/O errors
   - Clear error messages for debugging

---

## Conclusion

The app demonstrates the right API structure and session handling library choices, but **it is a non-functional, non-secure prototype**. The absence of a UI makes it unusable, and the authorization flaws would expose patient medical records to unauthorized access—a critical patient safety and regulatory compliance failure.

**Recommendation**: Pause release. Redirect effort to completing the missing components and fixing security flaws before any deployment.

---

**Reviewed by**: Independent Security Review  
**Review Date**: 2026-09-01  
**Follow-up Review Recommended**: After fixes are implemented
