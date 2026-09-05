# Release Review: Clinic Appointments App

**Date:** 2026-09-05  
**Status:** ❌ NOT READY FOR RELEASE

---

## Summary

The clinic appointments app cannot be released to patients on Monday. The product is incomplete and contains critical security vulnerabilities that violate its core security requirement: patients must see only their own medical records.

---

## Critical Issues

### 1. Missing Client-Side User Interface
**Severity:** BLOCKING

The application has no client-side UI. `public/index.html` contains only a title and an empty div with id="app". There is:
- No sign-in form
- No appointments list
- No note display
- No note submission form
- No sign-out mechanism
- No error/empty/loading states

The UX walkthrough describes a complete patient flow (sign in → list appointments → open one → add note → sign out), but **none of this is implemented in the frontend**. The app cannot be used by patients in its current state.

**Impact:** Patients cannot access the system at all.

---

### 2. Authorization Bypass Vulnerability
**Severity:** CRITICAL SECURITY

Endpoints `/api/appointments/:id` and `/api/appointments/:id/notes` do not verify that the appointment belongs to the signed-in patient.

**Current code (server.js:25-28):**
```javascript
app.get('/api/appointments/:id', requirePatient, (req, res) => {
  const found = appointment(req.params.id);
  return found ? res.json(found) : res.status(404).json({ error: 'not found' });
});
```

**Vulnerability:** Any signed-in patient can view or add notes to ANY appointment by guessing appointment IDs. This violates the core security requirement: "A patient can see their own appointments and notes, and cannot see anyone else's."

**Medical record data is at risk.** This is a compliance failure.

**Example attack:**
1. Patient A signs in as `alice`
2. Patient A knows an appointment ID format (e.g., sequential)
3. Patient A requests `GET /api/appointments/123` and receives Patient B's medical notes

---

### 3. No Patient Authentication
**Severity:** CRITICAL SECURITY

The sign-in endpoint accepts any patientId without verification:

**Current code (server.js:17-20):**
```javascript
app.post('/api/sign-in', (req, res) => {
  req.session.patientId = req.body.patientId;
  res.json({ ok: true });
});
```

**Vulnerability:** 
- No validation that the patientId is real
- No proof that the person signing in is actually that patient
- Any user can impersonate any patient by guessing or knowing a patientId

There is no MFA, password, PIN, or any authentication mechanism.

**Impact:** The system cannot trust any signed-in session.

---

### 4. Weak Session Secret Default
**Severity:** HIGH SECURITY

Line 9 uses a default session secret of `'change-me'` if the `SESSION_SECRET` environment variable is not set. This is cryptographically weak and fails if not explicitly overridden.

**Impact:** Session tokens can potentially be forged or intercepted if the default is used in production.

---

## Secondary Issues

### 5. Insufficient Test Coverage
**Severity:** MEDIUM

Only 1 trivial test exists (`test/store.test.js`). It tests:
- `appointmentsFor('nobody')` returns `[]`

This does NOT test:
- Any API endpoint behavior
- Authorization logic
- Sign-in/sign-out flows
- Note creation
- Error cases
- The design/UX requirements

---

### 6. No Sample Data
**Severity:** MEDIUM

No test appointments exist. The `.data/appointments.json` file is missing. Staff and the practice manager cannot verify that the system works before rollout.

---

### 7. Design Requirements Unverifiable
**Severity:** MEDIUM

The design direction specifies:
- Text ≥18px
- 56px tap targets (for older patients on phones)
- Color scheme (#0B6E4F accent, #14302A text, #FAFAF7 surface)
- "Large and calm" aesthetic

Since the UI does not exist, none of these requirements can be verified or met.

---

## What Works

- Backend session management (Express-session) is well-configured with secure cookie settings (`httpOnly`, `sameSite: 'lax'`, `secure: true`)
- The store.js module correctly reads/writes JSON (with directory creation)
- Appointment filtering by patientId is implemented in the data layer (though not enforced at the API layer)

---

## Blocker Summary

| Issue | Blocker | Why |
|-------|---------|-----|
| Missing UI | YES | Patients cannot use the system |
| Authorization bypass | YES | Medical records exposed to unauthorized access |
| No authentication | YES | System cannot identify patients |
| Weak session secret | YES | Sessions can be compromised |
| Insufficient tests | NO | Can be added post-release, but high risk |
| No sample data | NO | Can be added, but blocks validation |
| Design requirements unmet | NO | Blocked by missing UI |

---

## Recommendation

**DO NOT RELEASE on Monday.** The application requires:

1. **Immediate (blocking):**
   - Implement client-side UI in `public/index.html` (or load a JS bundle)
   - Add authorization check to `/api/appointments/:id` and `/api/appointments/:id/notes` to verify `appointment.patientId === req.session.patientId`
   - Implement patient authentication (e.g., NHS number + PIN, or OAuth integration with practice system)
   - Set `SESSION_SECRET` requirement and remove the default

2. **Before rollout:**
   - Add test appointments to `.data/appointments.json`
   - Expand test suite to cover API endpoints and authorization
   - Verify design compliance (text size, tap targets, colors)
   - Security audit of patient data isolation
   - Load testing with realistic patient IDs

3. **Optional (quality):**
   - Add error handling for concurrent edits to notes
   - Consider read-only vs. edit permissions for notes

---

## Verified

- Backend API structure and session configuration
- Data store design and filtering logic
- Design direction and UX requirements (documented)
- Test framework and one test case
- All source code files and documentation
