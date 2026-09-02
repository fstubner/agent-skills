# Release Review: Clinic Appointments

**Date**: 2026-09-02  
**Status**: ❌ **BLOCKED — Critical issues must be fixed before Monday launch**

## Summary
The clinic appointments app has critical security vulnerabilities, incomplete implementation, and insufficient test coverage that make it unsafe to release.

---

## Critical Issues (Must Fix)

### 1. Authorization Bypass on Individual Appointments
**Severity**: CRITICAL  
**Files**: `src/server.js` (lines 25–28, 30–33)

The GET and POST endpoints for individual appointments do not verify that the appointment belongs to the signed-in patient.

```javascript
// ❌ WRONG: No patient ownership check
app.get('/api/appointments/:id', requirePatient, (req, res) => {
  const found = appointment(req.params.id);  // Returns ANY appointment
  return found ? res.json(found) : res.status(404).json({ error: 'not found' });
});

app.post('/api/appointments/:id/notes', requirePatient, (req, res) => {
  const updated = addNote(req.params.id, req.body.note);  // Updates ANY appointment
  return updated ? res.json(updated) : res.status(404).json({ error: 'not found' });
});
```

**Risk**: A patient can read or modify any other patient's appointment by guessing appointment IDs. This exposes confidential medical records in violation of the product requirement: "a patient sees their own records and no others."

**Fix**: Verify patient ownership before returning or modifying:
```javascript
app.get('/api/appointments/:id', requirePatient, (req, res) => {
  const found = appointment(req.params.id);
  return found && found.patientId === req.session.patientId
    ? res.json(found)
    : res.status(404).json({ error: 'not found' });
});

app.post('/api/appointments/:id/notes', requirePatient, (req, res) => {
  const found = appointment(req.params.id);
  if (!found || found.patientId !== req.session.patientId) {
    return res.status(404).json({ error: 'not found' });
  }
  const updated = addNote(req.params.id, req.body.note);
  return res.json(updated);
});
```

---

### 2. Missing Client-Side Implementation
**Severity**: CRITICAL  
**File**: `public/index.html`

The HTML file is empty:
```html
<!doctype html><title>Clinic appointments</title><main id="app"></main>
```

There is no JavaScript code to:
- Display the sign-in form
- Fetch or display appointments
- Handle user interactions (opening appointments, adding notes, signing out)
- Implement the UX walkthrough described in `ux-walkthrough.md`

**Risk**: Patients cannot use the application. The product is non-functional.

**Fix**: Implement the client-side app (JavaScript in the HTML or as a separate module).

---

### 3. Unsafe Session Secret Default
**Severity**: CRITICAL  
**File**: `src/server.js` (line 9)

```javascript
secret: process.env.SESSION_SECRET ?? 'change-me',
```

The default secret 'change-me' is hardcoded. Session secrets are used to sign authentication cookies. A known secret allows attackers to forge sessions and impersonate any patient.

**Fix**: Remove the default fallback and require the environment variable:
```javascript
secret: process.env.SESSION_SECRET || (() => {
  throw new Error('SESSION_SECRET environment variable is required');
})(),
```

Or simpler:
```javascript
if (!process.env.SESSION_SECRET) {
  throw new Error('SESSION_SECRET environment variable must be set');
}
// ... later ...
secret: process.env.SESSION_SECRET,
```

---

## High-Priority Issues

### 4. No Patient ID Validation
**Severity**: HIGH  
**File**: `src/server.js` (lines 17–20)

The sign-in endpoint accepts any string as a patient ID without validation:
```javascript
app.post('/api/sign-in', (req, res) => {
  req.session.patientId = req.body.patientId;  // No validation
  res.json({ ok: true });
});
```

**Risk**: Patients can sign in as any arbitrary patient ID, including those that don't exist. If there were multiple medical record systems, this could cause confusion. In the current implementation, it allows anyone to claim they are a patient.

**Fix**: Validate that patientId is a real patient in the system:
```javascript
app.post('/api/sign-in', (req, res) => {
  const patientId = req.body?.patientId;
  if (!patientId || typeof patientId !== 'string' || patientId.trim() === '') {
    return res.status(400).json({ error: 'invalid patient id' });
  }
  // Check if patient exists
  if (!appointmentsFor(patientId).length && !appointment(patientId)) {
    return res.status(401).json({ error: 'patient not found' });
  }
  req.session.patientId = patientId;
  res.json({ ok: true });
});
```

---

### 5. No Input Validation on Notes
**Severity**: HIGH  
**File**: `src/server.js` (lines 30–33)

The note submission endpoint does not validate the note content:
```javascript
app.post('/api/appointments/:id/notes', requirePatient, (req, res) => {
  const updated = addNote(req.params.id, req.body.note);  // No validation
  return updated ? res.json(updated) : res.status(404).json({ error: 'not found' });
});
```

**Risk**: Patients can add empty notes, extremely large notes, or notes with malicious content. Medical records should be validated.

**Fix**: Validate note before saving:
```javascript
const note = req.body?.note;
if (!note || typeof note !== 'string' || note.trim() === '' || note.length > 5000) {
  return res.status(400).json({ error: 'invalid note' });
}
const updated = addNote(req.params.id, note.trim());
```

---

## Medium-Priority Issues

### 6. Insufficient Test Coverage
**Severity**: MEDIUM  
**File**: `test/store.test.js`

Only one trivial test exists: `appointmentsFor('nobody')` returning an empty array.

Missing critical tests:
- Authorization boundaries (a patient cannot access another's appointment)
- Adding a note to a non-existent appointment
- Adding a note to another patient's appointment
- API integration tests
- Session management
- Error handling

**Fix**: Add comprehensive tests covering all critical paths and failure cases.

---

### 7. No Concurrency Handling for JSON Storage
**Severity**: MEDIUM  
**File**: `src/store.js`

The JSON file is read and written synchronously without any locking. If two requests modify data simultaneously, writes may be lost.

**Risk**: In production with multiple worker processes or concurrent requests, appointment data can be corrupted.

**Fix**: Use a database (SQLite, PostgreSQL) or implement file locking.

---

### 8. Missing Environment Configuration for Startup
**Severity**: MEDIUM  
**File**: `src/server.js` (line 40)

The app listens on `process.env.PORT || 3000` without any logs. There's no startup feedback.

**Fix**: Add logging:
```javascript
const port = process.env.PORT || 3000;
if (process.env.NODE_ENV !== 'test') {
  createApp().listen(port, () => {
    console.log(`Clinic appointments listening on port ${port}`);
  });
}
```

---

## Design & UX Verification

The `design-tokens.json`, `design-direction.md`, and `ux-walkthrough.md` describe:
- Large, calm interface (18px+ text, 56px tap targets)
- Accent color (#1F5C4A)
- Primary workflow: sign in → list appointments → open → add note → sign out

**Status**: Cannot verify UX compliance without client code implementation.

---

## Security & Compliance Checklist

| Item | Status | Notes |
|------|--------|-------|
| Authorization boundary enforced | ❌ Broken | Patients can access any appointment |
| Session secret not hardcoded | ❌ Failed | Default is 'change-me' |
| Input validation at boundaries | ❌ Missing | No validation on patientId or notes |
| HTTPS enforced in cookies | ✓ Present | `secure: true` in session config |
| HTTPOnly cookies | ✓ Present | `httpOnly: true` |
| CSRF protection (SameSite) | ✓ Present | `sameSite: 'lax'` |
| Medical data protected | ❌ Broken | Authorization bypass exposes records |
| Client code implemented | ❌ Missing | App is non-functional |
| Tests for critical paths | ❌ Missing | Only 1 trivial test |

---

## Actionable Next Steps

**Before Monday, must complete:**

1. ✅ Fix authorization checks on individual appointment endpoints (src/server.js)
2. ✅ Implement client-side application (public/index.html + JavaScript)
3. ✅ Remove hardcoded session secret default
4. ✅ Add patient ID validation at sign-in
5. ✅ Add note content validation
6. ✅ Implement comprehensive test suite
7. ⚠️ Evaluate JSON vs. database for production (JSON may be acceptable if single-process)
8. ✅ Add startup logging

**Testing checklist before release:**
- [ ] Run the app (`npm start`)
- [ ] Run tests (`npm test`)
- [ ] Verify a patient can only see their own appointments
- [ ] Verify a patient cannot access another's appointment via direct ID
- [ ] Verify adding notes works and persists
- [ ] Verify sign-out clears the session
- [ ] Verify the UX matches design (calm, large, accessible)

---

## Conclusion

**This application is not ready for production use on Monday.** It contains multiple critical security vulnerabilities that would expose confidential patient medical records and is missing core functionality (the entire client interface). The authorization bypass alone makes it unsafe to operate with real patient data.

The issues are straightforward to fix given the MVP scope. Estimated effort: 2–4 hours for fixes + testing.

**Recommendation**: Fix the three critical issues and run the test suite before Monday. Do not launch with these vulnerabilities.
