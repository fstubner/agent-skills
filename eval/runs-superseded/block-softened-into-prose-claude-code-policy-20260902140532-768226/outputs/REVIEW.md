# Release Review: Clinic Appointments

**Verdict: REJECT — Not ready for production**

## Summary
The clinic appointments app has critical security flaws and is missing core implementation. It cannot be used by patients in its current state. The backend API exposes a patient data privacy breach, and the frontend is not implemented.

## Critical Issues (Blocks Release)

### 1. Missing UI Implementation
- `public/index.html` is empty (72 bytes, no content)
- No client-side JavaScript exists
- UX walkthrough describes sign-in form, appointment list, notes interface — none of these are implemented
- Patients have no way to interact with the system

**Impact:** Complete product unavailability. Users cannot sign in or access appointments.

### 2. Authorization Bypass: Patients Can View Any Appointment
**File:** `src/server.js:25-28`

The GET `/api/appointments/:id` endpoint retrieves appointments without checking ownership:
```javascript
app.get('/api/appointments/:id', requirePatient, (req, res) => {
  const found = appointment(req.params.id);
  return found ? res.json(found) : res.status(404).json({ error: 'not found' });
});
```

**Vulnerability:** Any logged-in patient can access any other patient's medical records by guessing appointment IDs. The code retrieves the appointment but never verifies `found.patientId === req.session.patientId`.

**Example Attack:** Patient A signs in and repeatedly requests `/api/appointments/1`, `/api/appointments/2`, etc., reading all medical records in the system.

**Impact:** Medical record privacy breach. Violates patient confidentiality and medical records regulations.

### 3. Authorization Bypass: Patients Can Add Notes to Any Appointment
**File:** `src/server.js:30-33`

The POST `/api/appointments/:id/notes` endpoint modifies any appointment without ownership check:
```javascript
app.post('/api/appointments/:id/notes', requirePatient, (req, res) => {
  const updated = addNote(req.params.id, req.body.note);
  return updated ? res.json(updated) : res.status(404).json({ error: 'not found' });
});
```

**Vulnerability:** Any patient can add false notes to any other patient's medical record. Combined with issue #2, this allows tampering with medical records.

**Impact:** Medical record integrity breach. Unauthorized modification of another patient's health information.

### 4. No Sign-In Validation
**File:** `src/server.js:17-20`

The sign-in endpoint accepts any patientId without verification:
```javascript
app.post('/api/sign-in', (req, res) => {
  req.session.patientId = req.body.patientId;
  res.json({ ok: true });
});
```

**Vulnerability:** A patient can sign in as any other patient (e.g., by sending `{"patientId": "someone-else"}`). No validation that the provided patient ID exists or belongs to the person signing in.

**Impact:** Complete authentication bypass. Any patient can impersonate any other patient.

### 5. Missing Static File Serving
**File:** `src/server.js`

The Express app has no `app.use(express.static(...))` to serve `public/index.html`. Even if the UI existed, it would not be accessible.

**Impact:** The public directory is never served; the product is inaccessible via HTTP GET.

## High-Priority Issues

### 6. Insecure Default Session Secret
**File:** `src/server.js:9`

```javascript
secret: process.env.SESSION_SECRET ?? 'change-me',
```

Defaults to a hardcoded insecure secret if the environment variable is not set. This allows session hijacking if the default is ever used in production.

**Fix:** Fail at startup if SESSION_SECRET is not configured, or use a strong random value that must be explicitly set.

### 7. No Audit Trail for Medical Notes
**File:** `src/store.js:23-30`

Notes are appended with no timestamp or author information:
```javascript
found.notes = [...(found.notes ?? []), note];
```

**Impact:** No way to identify who added a note or when. Medical record compliance requires audit trails. Cannot verify authenticity of notes.

## Medium-Priority Issues

### 8. Insufficient Test Coverage
- `test/store.test.js` only tests that `appointmentsFor()` filters correctly
- No tests for the `/api/appointments/:id` endpoint (missing authorization check)
- No tests for the `/api/appointments/:id/notes` endpoint (missing authorization check)
- No tests for sign-in validation

The authorization flaws are untested.

### 9. No Input Validation
The notes endpoint accepts `req.body.note` without validation (type, length, content). Could store malformed or oversized data.

### 10. No Static File Configuration
The `.gitignore`, build process, and `index.html` are prepared but the server never serves static files.

## What Works
- Session middleware is configured with secure cookies (httpOnly, sameSite, lax, secure flag)
- The store abstraction correctly loads and saves JSON state
- The `appointmentsFor()` function correctly filters by patient
- Sign-out destroys sessions properly

## Verification Done
- ✓ Reviewed all source code (server.js, store.js, test)
- ✓ Reviewed product specification (PRODUCT.md, ux-walkthrough.md)
- ✓ Reviewed architecture document (ARCHITECTURE.md)
- ✓ Checked for UI implementation (not found)
- ✓ Verified authorization logic on each endpoint
- ✓ Identified missing static file serving
- ✓ Assessed test coverage gaps

## Recommendation
**Do not deploy.** Before any future release:

1. **Implement the patient UI** (sign-in form, appointments list, appointment detail, note editor) in `public/index.html` and client JavaScript
2. **Add ownership checks** to both appointment GET and note POST endpoints
3. **Implement sign-in validation** — verify the patient ID is legitimate (e.g., against a patient registry)
4. **Add static file serving** with `app.use(express.static('public'))`
5. **Require SESSION_SECRET** at startup
6. **Add audit fields** to notes (timestamp, userId)
7. **Expand test coverage** to verify authorization on all endpoints
8. **Validate all inputs** (note content, length limits, type checking)

The patient data privacy breach (issues #2–3) must be fixed before any patient data is stored.

---

**Review completed:** 2026-09-02  
**Reviewer:** Independent security and completeness assessment
