# Release Review — Clinic Appointments App

**Status: NOT READY FOR RELEASE**

The app has critical blockers that make it unsuitable for production use on Monday.

## Critical Issues (Block Release)

### 1. No Client-Side Code
The frontend is an empty HTML skeleton (1 line, just `<title>` and empty `<main>`). There is no JavaScript to handle:
- Sign-in form display and submission
- Appointment list rendering
- Appointment detail view
- Note adding
- Sign-out functionality

**Impact**: The app is completely non-functional. Users see a blank page.

### 2. Authorization Bypass — View Any Appointment
File: `src/server.js`, lines 25-28

```javascript
app.get('/api/appointments/:id', requirePatient, (req, res) => {
  const found = appointment(req.params.id);
  return found ? res.json(found) : res.status(404).json({ error: 'not found' });
});
```

The `appointment()` function returns any appointment by ID without verifying it belongs to the signed-in patient. A patient can enumerate appointment IDs and read anyone's medical records.

**Example attack**: 
- Patient A signs in with their patient ID
- Patient A requests `/api/appointments/patient-b-appt-123`
- If they guess the right ID format, they read Patient B's appointment and notes

**Impact**: HIPAA/medical privacy violation. Total data breach risk.

### 3. Authorization Bypass — Add Notes to Any Appointment
File: `src/server.js`, lines 30-33

Same vulnerability as above. A patient can add notes to anyone's appointment, corrupting medical records.

**Impact**: Medical records integrity violation. Could cause patient harm if malicious notes are added.

## High-Priority Issues

### 4. No Input Validation — Sign-In
File: `src/server.js`, line 18

```javascript
req.session.patientId = req.body.patientId;
```

The patient ID is used directly from the request body. No validation, type checking, or sanitization. A patient could set it to:
- `null` / `undefined` → breaks session checks
- `true`, `{}` → bypasses logic
- SQL injection patterns (even though this uses JSON files, not SQL)

**Impact**: Session bypass, potential privilege escalation, undefined behavior.

### 5. No Input Validation — Note Content
File: `src/server.js`, line 31

```javascript
const updated = addNote(req.params.id, req.body.note);
```

The note is saved directly without validation. Could be:
- `null`, `undefined`
- Extremely large (memory/disk exhaustion)
- Malicious content (XSS if rendered client-side)

**Impact**: Medical records corruption, storage exhaustion, potential XSS if frontend renders notes without escaping.

### 6. Weak Default Session Secret
File: `src/server.js`, line 9

```javascript
secret: process.env.SESSION_SECRET ?? 'change-me'
```

The comment says "change-me" but it's actually used as a fallback. Without clear documentation that this MUST be set in production, someone will deploy with the default hardcoded secret. This allows session hijacking.

**Impact**: Session forgery, account takeover.

### 7. HTTPS-Only Cookie in Development
File: `src/server.js`, line 12

```javascript
cookie: { httpOnly: true, sameSite: 'lax', secure: true }
```

The `secure: true` flag means cookies won't be sent over HTTP. If developers test locally without HTTPS, the app will fail silently (session cookies won't be sent, auth will break). This is a footgun for development.

**Impact**: Confusion during testing/development, broken auth in non-HTTPS environments.

## Medium-Priority Issues

### 8. Test Coverage Is Inadequate
File: `test/store.test.js`

Only one test that checks `appointmentsFor('nobody')` returns `[]`. Tests should cover:
- Authorization boundaries (patient can only see their own appointments)
- The authorization bypass vulnerability above (can request any appointment ID?)
- Adding notes to other patients' appointments
- Edge cases (empty notes, null values, etc.)

**Impact**: Vulnerabilities aren't caught by automated tests.

## Design Issues

### 9. Color Contrast
File: `design-tokens.json`

Text color `#14302A` on surface `#FAFAF7` may not meet WCAG AA contrast requirements for accessibility. The design direction specifies "large and calm" for older patients, but contrast needs verification.

**Impact**: Accessibility issue for older patients (the target demographic).

## Summary

This app cannot ship:
- **It doesn't work** (no frontend code)
- **It's not secure** (authorization bypass allows reading/writing anyone's medical records)
- **It's not validated** (input validation is missing)
- **It hasn't been tested** (test suite doesn't verify security)

### What Needs to Happen

1. **Build the frontend** — Implement the sign-in form, appointment list, detail view, and note-adding UI in JavaScript. Should match `ux-walkthrough.md`.

2. **Fix authorization** — In `/api/appointments/:id` and `/api/appointments/:id/notes`, verify that the appointment's `patientId` matches `req.session.patientId`. Example:
   ```javascript
   const found = appointment(req.params.id);
   if (!found || found.patientId !== req.session.patientId) {
     return res.status(403).json({ error: 'forbidden' });
   }
   ```

3. **Add input validation** — Validate and sanitize `patientId` and `note` on the server.

4. **Require SESSION_SECRET** — Fail on startup if the environment variable is not set.

5. **Fix cookie security** — Use conditional `secure` flag: `secure: process.env.NODE_ENV === 'production'`.

6. **Expand test coverage** — Test authorization boundaries and known vulnerabilities.

7. **Verify accessibility** — Confirm color contrast meets WCAG AA.

---

**Recommendation**: Do not release Monday. The authorization vulnerabilities alone make this unsuitable for handling medical records. Estimated effort to fix: 2–3 days for a developer familiar with the codebase.
