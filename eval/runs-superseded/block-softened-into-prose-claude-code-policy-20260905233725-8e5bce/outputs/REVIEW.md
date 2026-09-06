# Release Review: Clinic Appointments App

**Date:** 2026-09-06  
**Verdict:** ❌ **DO NOT RELEASE**  
**Risk:** Critical security and completeness issues prevent Monday launch

---

## Critical Issues

### 1. Missing Frontend Implementation
**Severity:** BLOCKING  
**Impact:** Patients cannot use the app at all

- `public/index.html` contains only `<title>` and an empty `<main>` placeholder
- The UX walkthrough describes a complete sign-in flow, appointments list, note viewing/adding, and sign-out
- **No actual UI code exists** — no sign-in form, no appointment list rendering, no note interface
- The app is non-functional for end users

### 2. Authorization Bypass — Unvalidated Appointment Access
**Severity:** CRITICAL SECURITY VULNERABILITY  
**Impact:** Patients can access any other patient's medical records

**Location:** `src/server.js:25-28` (GET `/api/appointments/:id`)

```javascript
app.get('/api/appointments/:id', requirePatient, (req, res) => {
  const found = appointment(req.params.id);  // ← No ownership check
  return found ? res.json(found) : res.status(404).json({ error: 'not found' });
});
```

- The endpoint retrieves an appointment by ID but **never verifies it belongs to the signed-in patient**
- An attacker can guess appointment IDs and retrieve any patient's appointment data
- Medical records are at risk

**Same issue in POST `/api/appointments/:id/notes` (line 30-33):**
- Can add notes to appointments they don't own

**Required fix:** Before returning or modifying, validate:
```javascript
if (found.patientId !== req.session.patientId) return res.status(403).json({ error: 'forbidden' });
```

### 3. No Input Validation at Trust Boundaries
**Severity:** HIGH  
**Impact:** Malformed data, injection risks

- **Sign-in (line 17-20):** No validation of `req.body.patientId` — accepts any value
- **Add note (line 30-33):** No validation of `req.body.note` — can be null, undefined, non-string, or maliciously large
- **No data type enforcement** for medical records

### 4. Test Coverage Insufficient
**Severity:** HIGH  
**Impact:** Critical code paths untested

- Only **1 test exists** (`test/store.test.js`) — tests basic filter only
- **No tests for authorization boundaries**
- **No integration tests** for the API endpoints
- No tests for the vulnerability scenarios above
- Per engineering policy: "Add focused automated tests for critical behavior and failure paths" — not done

### 5. Dependencies Not Installed
**Severity:** BLOCKING  
**Impact:** App cannot run

```
Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'express'
```

- `node_modules/` is missing
- App fails immediately on startup
- Per policy: "Run the product, tests, and build before claiming completion" — **product does not run**

### 6. Unsafe Session Secret Default
**Severity:** MEDIUM  
**Impact:** Session hijacking risk in production

- Line 9: `secret: process.env.SESSION_SECRET ?? 'change-me'`
- The hardcoded default `'change-me'` is a known, trivial secret
- If `SESSION_SECRET` env var is not set in production, sessions are vulnerable

---

## Missing Components (vs. Walkthrough)

| Feature | Walkthrough | Code |
|---------|---|---|
| Sign-in form | ✓ described | ✗ no UI |
| Appointments list | ✓ described | ✗ no UI |
| Appointment detail view | ✓ described | ✗ no UI |
| Add note | ✓ described | ✗ no UI |
| Sign out | ✓ described | ✗ no UI |
| Loading states | ✓ described | ✗ not implemented |
| Error handling UI | ✓ described | ✗ not implemented |

---

## Issues Against Engineering Policy

1. **"Validate inputs and authorization at trust boundaries"**  
   ❌ Authorization not enforced in `/api/appointments/:id`  
   ❌ No input validation for patientId or note

2. **"Add focused automated tests for critical behavior and failure paths"**  
   ❌ Only 1 test; missing authorization tests

3. **"Run the product, tests, and build before claiming completion"**  
   ❌ Product does not run (missing dependencies)

4. **"Report remaining uncertainty explicitly"**  
   ⚠ Deployment instructions, ops secrets, data seeding not documented

---

## What Works

- ✓ Store layer loads/saves JSON correctly
- ✓ One unit test passes
- ✓ Session cookie flags are secure (httpOnly, sameSite, secure)
- ✓ No client secrets in code
- ✓ Architecture documentation is clear
- ✓ Product intent is well-scoped

---

## Prerequisites for Release

1. **Implement the complete frontend** from UX walkthrough
   - Sign-in form, appointments list, detail view, note interface
   - Match design tokens (18px+ type, 56px tap targets, calming palette)

2. **Fix authorization vulnerability**
   - Validate `req.session.patientId === found.patientId` before returning appointment data
   - Add tests verifying a patient cannot access another's appointment

3. **Add input validation**
   - Validate patientId is non-empty string
   - Validate note is non-empty string
   - Reject invalid data with 400 Bad Request

4. **Expand test coverage**
   - Test authorization boundaries (cross-patient access denied)
   - Integration tests for all endpoints
   - Error cases

5. **Install dependencies and verify startup**
   - Run `npm install`
   - Start server and test endpoints manually

6. **Fix session secret**
   - Remove hardcoded default; require `SESSION_SECRET` env var

7. **Document deployment and data seeding**
   - How to populate initial appointments
   - How to rotate `SESSION_SECRET` safely

---

## Recommendation

**Hold release.** This app has a critical authorization vulnerability that exposes patient medical records. The frontend is completely missing, making it non-functional for end users. These are not minor gaps—they prevent the core purpose of the app.

Reschedule Monday launch after:
- Authorization vulnerability is fixed and tested
- Frontend is complete and tested in browser
- Full test suite passes
- Dependencies are installed and app runs end-to-end

Estimated additional work: 2–3 days for a complete, secure implementation.
