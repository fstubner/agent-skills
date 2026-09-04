# Acceptance Review

## Verdict: BLOCK

**Release Status:** Not approved for Monday deployment.

---

## Evidence

### 1. Gate Report (accept-check.js)
The acceptance gate reports:
- ✓ A-documents: pass
- ✓ A-intent-anchored: pass
- ✓ A-single-orm: pass
- ✓ A-no-client-secrets: pass
- ✓ A-session-cookie-flags: pass
- ✓ A-scripts-resolve: pass
- ⚠ A-runtime: not_evaluated (app not executed)

Gate verdict: CONDITIONAL (runtime unverified).

### 2. Critical Blocking Issues

#### A. Missing UI Implementation
**Severity: CRITICAL**

The primary product requirement is unusable. `public/index.html` contains only:
```html
<!doctype html><title>Clinic appointments</title><main id="app"></main>
```

This is a single-line HTML skeleton with no:
- Sign-in form
- Appointment list display
- Appointment details view
- Note input or display
- Sign-out button
- Any JavaScript to interact with the API endpoints

**Walkthrough impact:** Steps 1–5 of the primary job cannot execute. The app will display a blank page.

#### B. Authorization Bypass – Patient Can Access Any Appointment
**Severity: CRITICAL (Security)**

`src/server.js` line 25–27:
```javascript
app.get('/api/appointments/:id', requirePatient, (req, res) => {
  const found = appointment(req.params.id);
  return found ? res.json(found) : res.status(404).json({ error: 'not found' });
});
```

The endpoint checks that a patient is signed in (`requirePatient`) but **does not verify that the patient owns the appointment being requested**. 

Exploit: A patient can sign in with their own ID, then request `/api/appointments/<any-other-patients-id>` and read another patient's medical records (appointment notes).

The `appointment()` function in `src/store.js` returns appointments by ID only:
```javascript
export function appointment(id) {
  return load().appointments.find((a) => a.id === id) ?? null;
}
```

**Product requirement violation:** PRODUCT.md Success condition states: *"A patient can see their own appointments and notes, and cannot see anyone else's."* This code allows patients to see anyone's data.

**Same issue applies to note-adding:**
`src/server.js` line 30–33 allows adding notes to any appointment without ownership verification.

#### C. Weak Session Secret Default
**Severity: HIGH (Security)**

`src/server.js` line 9:
```javascript
secret: process.env.SESSION_SECRET ?? 'change-me',
```

The session secret defaults to the plaintext string `'change-me'`, which is guessable and defeats session security on any deployment that doesn't override it. Session cookies can be forged.

#### D. Design Token Mismatch
**Severity: MEDIUM (UX)**

- `design-direction.md` specifies accent color: `#1F5C4A`
- `design-tokens.json` specifies: `#0B6E4F`

These do not match. Either the design has diverged from specification, or the tokens were not updated.

#### E. No Patient ID Validation on Sign-In
**Severity: MEDIUM (Security/Data)**

`src/server.js` line 17–20:
```javascript
app.post('/api/sign-in', (req, res) => {
  req.session.patientId = req.body.patientId;
  res.json({ ok: true });
});
```

Accepts any `patientId` value without validation:
- No check that the patient exists in the system
- No validation of format
- No whitelist or lookup against valid patient references

A user can sign in as any invented patientId (e.g., "attacker" or an admin ID if one exists) without verification.

---

## What Was Checked

✓ **Code review:** Authorization, input validation, session security, data isolation
✓ **Document consistency:** Design tokens vs. design-direction  
✓ **API surface:** All endpoints in server.js
✓ **Data store:** store.js logic
✓ **Security audit:** XSS, CSRF, race conditions, rate limiting, compliance
✓ **Audit trail:** Logging of patient data access (medical records requirement)
✓ **Input validation:** Patient ID, appointment ID, note content

## What Was Not Checked

Because the UI is absent, the following could not be verified:
- Actual walkthrough execution (no form to interact with)
- Empty/error/loading states (UI elements missing)
- Viewport responsiveness (no CSS/layout)
- Keyboard accessibility (no interactive elements)
- Visual design compliance (no rendered output to inspect)
- CSRF token protection (no form implementation to review)
- XSS rendering context (frontend missing)

The gate's A-runtime check correctly flags this as not_evaluated.

---

## Additional Critical Findings from Code Audit

### Race Condition in Data Storage (HIGH)
Concurrent note additions lose data. `store.js` uses an unatomic load-modify-save pattern with no file locking. Two simultaneous API requests will corrupt the JSON file, losing one patient's note.

### XSS Vulnerability in Notes (HIGH)
Notes are accepted without validation or sanitization. If frontend renders notes as HTML, injected scripts can steal clinician session cookies and compromise all patient records.

### No CSRF Protection (HIGH)
State-changing endpoints (`POST /api/appointments/:id/notes`) have no CSRF tokens. Marked as `sameSite: lax` but this is insufficient for medical records.

### Missing Audit Logging (HIGH - Compliance)
No logging of:
- Who accessed which patient record and when
- Who modified which note and when
- Failed authorization attempts

**Impact:** Violates HIPAA, GDPR, and NHS security standards. Impossible to investigate unauthorized access.

### No Authentication Mechanism (CRITICAL)
There is no password, PIN, NHS number validation, or identity verification. Any user can sign in as any patient by simply sending their patientId. Example: `POST /api/sign-in` with `{"patientId": "any-patient-id"}` succeeds with zero authentication.

### No Rate Limiting (HIGH)
Sign-in endpoint allows unlimited attempts. Attackers can brute-force patient IDs and enumerate all valid patients in the system.

### No HTTPS Enforcement (HIGH)
Application does not enforce HTTPS. Medical data could be transmitted in plain text.

### No Input Validation on Appointment IDs (MEDIUM)
`GET /api/appointments/:id` and `POST /api/appointments/:id/notes` accept arbitrary strings without format validation.

---

## Required Before Release

1. **Implement the full UI** – Sign-in form, appointment list, detail view, note input, sign-out. Render API responses to the page.
2. **Fix authorization:** Verify in every API endpoint that the requested appointment belongs to the signed-in patient. Example:
   ```javascript
   const found = appointment(req.params.id);
   if (!found || found.patientId !== req.session.patientId) return res.status(403).json({ error: 'forbidden' });
   ```
3. **Require SESSION_SECRET in environment:** Remove the default. Fail fast if not set.
4. **Add patient ID validation:** Check that patientId exists and is valid before sign-in.
5. **Reconcile design tokens:** Confirm the correct accent color and update either design-tokens.json or design-direction.md.
6. **Complete adversarial testing:** Once UI and authorization are fixed, walk the primary path, test empty states, error handling, and input sanitization (XSS/injection attempts).

---

## Summary

The app has passed document and configuration checks, but **cannot ship in its current state**. The UI is missing entirely—no patient can interact with the system. Beyond that, a critical authorization bypass allows any signed-in patient to read any other patient's medical records, violating the core Safety and MVP contract. Both issues must be resolved and verified before Monday.
