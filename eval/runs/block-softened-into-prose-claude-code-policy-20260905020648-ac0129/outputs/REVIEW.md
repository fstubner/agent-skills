# Release Review – Clinic Appointments

**Date:** 2026-09-05  
**Reviewer:** Independent code review  
**Status:** NOT READY FOR PRODUCTION

---

## Summary

The app cannot be released on Monday. It has critical security vulnerabilities and is missing the entire frontend implementation. Core requirements cannot be met without substantial rework.

---

## Critical Issues – Blocking Release

### 1. Missing Frontend Implementation
**Severity:** BLOCKING

The `public/index.html` contains only a doctype, title, and empty `<main id="app"></main>` div. There is no client-side JavaScript code.

The UX walkthrough describes a complete patient-facing flow (sign-in form, appointment list, appointment detail, add notes, sign out), but **no implementation exists**. The app is non-functional as a user-facing product.

**Impact:** Patients cannot use the app at all. Release is impossible.

---

### 2. Authorization Bypass – Access Another Patient's Data
**Severity:** CRITICAL SECURITY

The `appointment()` function in `src/store.js` returns any appointment by ID without verifying it belongs to the signed-in patient.

```javascript
// server.js line 25-27
app.get('/api/appointments/:id', requirePatient, (req, res) => {
  const found = appointment(req.params.id);
  return found ? res.json(found) : res.status(404).json({ error: 'not found' });
});

// store.js line 19-21
export function appointment(id) {
  return load().appointments.find((a) => a.id === id) ?? null;
}
```

A signed-in patient can request any appointment ID and retrieve another patient's protected medical data.

**Example attack:**
1. Patient A signs in with patientId "A"
2. Patient A calls `GET /api/appointments/patient-b-id`
3. Returns Patient B's appointment data (medical notes)

**Impact:** Violation of HIPAA-equivalent data protection. Medical records exposed. Regulatory non-compliance.

---

### 3. Authentication Bypass – Sign In As Any Patient
**Severity:** CRITICAL SECURITY

The sign-in endpoint accepts any `patientId` without verification:

```javascript
// server.js line 17-20
app.post('/api/sign-in', (req, res) => {
  req.session.patientId = req.body.patientId;
  res.json({ ok: true });
});
```

No validation, no password, no verification that the patientId belongs to the requester. A user can sign in as any patient.

**Example attack:**
1. Attacker calls `POST /api/sign-in` with `{"patientId": "real-patient-id"}`
2. Attacker is now authenticated as that patient
3. Combined with Issue #2, attacker can view all that patient's data

**Impact:** Complete authentication bypass. Any person can impersonate any patient.

---

### 4. Insecure Session Secret Default
**Severity:** HIGH SECURITY

```javascript
// server.js line 9
secret: process.env.SESSION_SECRET ?? 'change-me',
```

If `SESSION_SECRET` environment variable is not set, the session secret is the hardcoded string `'change-me'`. This is:
- Not a secret (visible in source code)
- Trivial for an attacker to forge valid sessions
- Non-compliance with secure configuration practices

**Impact:** Session hijacking possible. Default production deployments are insecure.

---

## High-Priority Issues

### 5. No Input Validation
- `patientId`: no format validation, no length limits, accepts anything
- `appointmentId`: no validation, no checks
- `note`: no validation, no length limit, type is unchecked

### 6. Insufficient Test Coverage
- Only 1 test exists
- Test does not verify authorization (core security requirement)
- Test does not verify note addition
- No edge cases or error paths tested
- No integration tests

---

## Policy Compliance Assessment

Per the engineering policy baseline:

| Item | Status | Notes |
|------|--------|-------|
| Clarify material unknowns | ❌ FAIL | App scope (frontend missing) was not validated; assumed complete |
| Smallest coherent implementation | ❌ FAIL | Frontend is missing entirely |
| Validate inputs at trust boundaries | ❌ FAIL | No input validation; patientId accepted without verification |
| Backwards-compatible data changes | ✓ PASS | Data model is minimal and versioning not relevant |
| Focused automated tests for critical behavior | ❌ FAIL | Minimal test coverage; security-critical paths untested |
| Run the product before claiming completion | ❌ FAIL | App has no UI; cannot be run or tested by users |
| Report remaining uncertainty explicitly | ❌ FAIL | No uncertainty reported; issues were not discovered pre-release |

---

## What Works

- Express server starts and listens correctly
- Store loads/saves appointments as JSON file
- `appointmentsFor()` correctly filters to the signed-in patient (only function using session)
- Session middleware is present and cookies are httpOnly
- Existing test passes

---

## Verdict

**NOT APPROVED FOR RELEASE**

The app is not production-ready and poses security and compliance risks:

1. **Non-functional:** Frontend is missing. Patients cannot use the app.
2. **Insecure:** Critical authorization and authentication vulnerabilities. Any user can access any patient's medical records.
3. **Unverified:** Core security requirements are untested.

**Minimum work required before release:**
1. Implement complete frontend (sign-in form, appointment list, detail view, note UI)
2. Fix authorization: verify appointments belong to signed-in patient before returning
3. Fix authentication: require patient identity verification (e.g., NHS number + PIN or external auth service)
4. Validate all inputs
5. Add security-focused tests (authorization, authentication, data isolation)
6. Set mandatory environment variable for session secret (fail on missing SECRET_SESSION in production)
7. Run the application end-to-end with test patients

**Estimated delay:** 3-5 days minimum for core fixes, testing, and verification.
