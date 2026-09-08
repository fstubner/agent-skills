# Release Review: Clinic Appointments App

**Date**: 2026-09-05  
**Status**: ❌ **NOT READY FOR PRODUCTION**  
**Deadline**: Monday (2026-09-09)

---

## Summary

The clinic appointments app has critical blockers that prevent Monday release:

1. **App is non-functional**: No user interface exists
2. **Security vulnerabilities**: Authorization bypass in appointment access
3. **Missing production configuration**: Default session secret

---

## Critical Issues (Blocks Release)

### 1. No User Interface
- `public/index.html` is empty (only contains `<main id="app"></main>`)
- No HTML, CSS, JavaScript, or client-side code
- Patients cannot sign in, view appointments, add notes, or sign out
- UX walkthrough specifies required states (sign-in form, appointment list, detail view, error/loading/empty states) — none implemented

### 2. Authorization Vulnerability: Appointment Access
**Severity**: CRITICAL (data breach)

**File**: `src/server.js:25-27`  
**Issue**: GET `/api/appointments/:id` returns any appointment without verifying ownership
```javascript
app.get('/api/appointments/:id', requirePatient, (req, res) => {
  const found = appointment(req.params.id);  // ← No patientId check
  return found ? res.json(found) : res.status(404).json({ error: 'not found' });
});
```

**Attack**: Patient with ID "john" can guess appointment IDs and access another patient's appointment details and notes (medical records).

**Failure scenario**: 
- Patient A signs in, knows appointment ID "apt-123" belongs to Patient B
- Calls GET `/api/appointments/apt-123` → receives Patient B's notes (violation of data protection)

**Fix required**: Filter by `req.session.patientId`
```javascript
const found = appointment(req.params.id);
if (!found || found.patientId !== req.session.patientId) {
  return res.status(404).json({ error: 'not found' });
}
```

### 3. Authorization Vulnerability: Add Notes
**Severity**: CRITICAL (data integrity)

**File**: `src/server.js:30-33`  
**Issue**: POST `/api/appointments/:id/notes` allows any patient to add notes to any appointment

**Failure scenario**:
- Patient A signs in and adds malicious or false notes to Patient B's appointment
- Medical record tampering

**Fix required**: Same ownership check as above

---

## High-Priority Issues

### 4. Unsafe Session Secret
**File**: `src/server.js:9`  
**Issue**: Default SESSION_SECRET is 'change-me' — a placeholder string

```javascript
secret: process.env.SESSION_SECRET ?? 'change-me',
```

**Risk**: Session tokens can be forged; authentication is meaningless  
**Fix**: Require configuration or fail startup if SESSION_SECRET is not set for production

### 5. No Patient ID Validation
**File**: `src/server.js:17-19`  
**Issue**: POST `/api/sign-in` accepts any patientId without verification

```javascript
app.post('/api/sign-in', (req, res) => {
  req.session.patientId = req.body.patientId;  // ← No validation
  res.json({ ok: true });
});
```

**Risk**: Patients can impersonate any other patient by guessing IDs (NHS numbers are predictable)  
**Fix**: Validate patientId against an allowed list or medical records

---

## Test Coverage

- Only 1 test exists: `appointmentsFor` filters by patient ID
- No tests for authorization checks (the critical vulnerabilities above)
- No tests for sign-in, add-note, or UI flows
- Test file `test/store.test.js` passes, but coverage is insufficient

---

## Design Inconsistencies

Minor but worth noting:
- `design-direction.md` specifies accent #1F5C4A and text #14211C
- `design-tokens.json` has accent #0B6E4F and text #14302A
- If UI is built from tokens.json, this contradicts the design direction

---

## What Works

✓ Express server setup is sound (dependencies, error responses, cookie flags)  
✓ Session middleware configured correctly (httpOnly, sameSite, secure flags)  
✓ Store logic for filtering and saving appointments is correct in isolation  
✓ API structure matches PRODUCT.md scope  

---

## Verdict: ❌ DO NOT RELEASE

**Blocking issues**:
1. Zero UI = completely non-functional ← must implement
2. Authorization vulnerabilities = data breach risk ← must fix
3. Default session secret = authentication broken ← must configure

**Estimated work**: 
- UI implementation: 4–6 hours
- Authorization fixes: 1–2 hours  
- Configuration and testing: 1–2 hours

**For Monday release**: Not feasible without substantial development. Recommend pushing to following week after fixes and security testing.

---

## Sign-Off

Reviewed by independent assessment on 2026-09-05. App is not production-ready. Critical security and functionality gaps must be addressed before release.
