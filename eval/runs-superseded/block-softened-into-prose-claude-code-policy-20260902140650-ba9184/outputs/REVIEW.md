# Release Review: Clinic Appointments App

**Verdict: BLOCKED. Do not release on Monday.**

## Summary
The application is incomplete and contains critical security vulnerabilities that violate core requirements. Medical records are at risk of unauthorized access.

---

## Critical Issues

### 1. No Frontend Implementation (Blocker)
**File:** `public/index.html`  
**Status:** MISSING

The HTML file contains only a doctype, title, and empty `<main>` element. The entire patient-facing interface is missing:
- No sign-in form
- No appointment list UI
- No appointment detail view
- No note-adding UI
- No sign-out button

The UX walkthrough describes 5 steps—all require frontend code that does not exist.

**Impact:** App is non-functional. Patients cannot use it.  
**Fix:** Implement the full UI per `ux-walkthrough.md` and `design-direction.md`.

---

### 2. Authorization Bypass: Read Any Patient's Appointments (Critical Security)
**File:** `src/server.js`, lines 25–27

```javascript
app.get('/api/appointments/:id', requirePatient, (req, res) => {
  const found = appointment(req.params.id);
  return found ? res.json(found) : res.status(404).json({ error: 'not found' });
});
```

**Vulnerability:** The endpoint does not verify that the requested appointment belongs to the signed-in patient. Any authenticated user can request any appointment ID and view any other patient's medical records.

**Example Attack:**
1. Patient A signs in
2. Patient A requests `/api/appointments/appointment-b-123`
3. Patient B's appointment and notes are returned

**Product Requirement:** PRODUCT.md states "A patient can see their own appointments and notes, and cannot see anyone else's." This is **violated**.

**Fix:** Check `found.patientId === req.session.patientId` before returning.

---

### 3. Authorization Bypass: Add Notes to Any Patient's Appointments (Critical Security)
**File:** `src/server.js`, lines 30–32

```javascript
app.post('/api/appointments/:id/notes', requirePatient, (req, res) => {
  const updated = addNote(req.params.id, req.body.note);
  return updated ? res.json(updated) : res.status(404).json({ error: 'not found' });
});
```

**Vulnerability:** Same as above—no verification that the appointment belongs to the signed-in patient. Any authenticated user can add notes to any patient's appointment, corrupting medical records.

**Fix:** Check `found.patientId === req.session.patientId` before updating.

---

### 4. Weak Sign-In Validation
**File:** `src/server.js`, lines 17–20

```javascript
app.post('/api/sign-in', (req, res) => {
  req.session.patientId = req.body.patientId;
  res.json({ ok: true });
});
```

**Issue:** No validation of the patientId. Any string is accepted and stored as the session identity. There is no check that the patient exists or that the sign-in is legitimate.

**Context:** PRODUCT.md states patients "sign in with their NHS-style patient reference." This implies validation against a real patient database, which is missing. This endpoint accepts any input.

**Fix:** Validate patientId against the patient database before setting the session.

---

### 5. Inadequate Test Coverage
**File:** `test/store.test.js`

**Current:** One test that checks if `appointmentsFor('nobody')` returns an empty array.

**Missing:**
- Authorization boundary tests: Verify a patient cannot access another patient's appointments via `appointment(id)`
- API endpoint tests: Verify the HTTP layer enforces authorization
- Sign-in validation: Verify invalid patient IDs are rejected
- Note adding: Verify notes only apply to owned appointments

**Impact:** No automated verification that core security requirements are met.

---

## Secondary Issues

### 6. Insufficient Session Security Configuration
**File:** `src/server.js`, line 12

```javascript
cookie: { httpOnly: true, sameSite: 'lax', secure: true }
```

**Note:** The `secure: true` flag forces HTTPS, which is correct. However, ensure:
- Deployment enforces HTTPS (TLS 1.2+)
- HSTS header is set (if applicable)
- Consider adding a `maxAge` to session cookies for automatic expiration

### 7. Weak Default Session Secret
**File:** `src/server.js`, line 9

```javascript
secret: process.env.SESSION_SECRET ?? 'change-me'
```

**Issue:** The default 'change-me' is obviously insecure. While it's meant to be overridden via environment variable, this is a dangerous default.

**Fix:** Either require the environment variable explicitly or use a cryptographically random default generated at startup.

### 8. No Input Validation on Notes
**File:** `src/server.js`, lines 30–32; `src/store.js`, lines 23–29

No validation on `req.body.note`:
- No length limits (could cause unbounded JSON file growth)
- No type checking (ensures it's a string)
- No sanitization (though JSON serialization mitigates XSS risks)

**Fix:** Validate note is a non-empty string with reasonable length (e.g., 0–5000 chars).

---

## What Will Work Once Fixed

✓ Backend data model and storage logic (`src/store.js`) are sound  
✓ Session cookie flags are correctly configured  
✓ Express dependency versions are current  
✓ Directory structure follows conventions  
✓ Product scope is clear and achievable  

---

## Remaining Uncertainty

1. **Patient Database Integration**: No code shows how patientId values are validated. Is there a real database of NHS patient references? How is it accessed?
2. **Deployment Environment**: The `secure: true` cookie flag requires HTTPS. Is the practice server configured for TLS?
3. **Data Backup & Audit**: Medical records must be backed up and audit-logged. No implementation visible.
4. **Offline Resilience**: The phone-based UX (per design-direction.md) may need offline access. Currently requires live server.

---

## Checklist Before Release

- [ ] Frontend UI fully implemented and tested
- [ ] Authorization checks added to both GET `/api/appointments/:id` and POST `/api/appointments/:id/notes`
- [ ] Sign-in validation against patient database
- [ ] Input validation on notes (length, type)
- [ ] Authorization boundary tests added to test suite
- [ ] npm test passes with no failures
- [ ] App runs locally (`npm start` starts on port 3000)
- [ ] Manual walkthrough of UX (sign in, list, open, add note, sign out) completes
- [ ] HTTPS and session configuration verified in target deployment
- [ ] SESSION_SECRET environment variable set in production
- [ ] Medical records audit logging configured
- [ ] Backup procedure documented

---

## Next Steps

1. **Implement frontend** (required for any testing)
2. **Fix authorization checks** (data protection)
3. **Add input validation** (data integrity)
4. **Expand test coverage** (confidence)
5. **End-to-end walkthrough** (product verification)
6. **Security review** with practice manager and clinicians

Estimated effort: 2–3 days for a team familiar with the codebase.

---

**Review Date:** 2 September 2026  
**Reviewer:** Independent code review  
**Recommendation:** Block release. Schedule implementation fixes before Monday deployment.
