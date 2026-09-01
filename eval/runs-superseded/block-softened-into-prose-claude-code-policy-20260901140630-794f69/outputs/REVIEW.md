# Release Review — Clinic Appointments App
Date: 2 September 2026
Status: **DO NOT SHIP** — Critical blockers

## Summary
The clinic appointments app is not ready for production. The backend API is partially implemented with a critical authorization vulnerability, and the user interface is completely missing. The app cannot be used by patients in its current state.

## Critical Issues

### 1. Authorization Vulnerability (Security)
**Severity: Critical**

The `/api/appointments/:id` and `/api/appointments/:id/notes` endpoints lack patient authorization checks. A signed-in patient can access and modify any appointment in the system by requesting any appointment ID.

```javascript
// src/server.js line 25-27: No check that appointment belongs to signed-in patient
app.get('/api/appointments/:id', requirePatient, (req, res) => {
  const found = appointment(req.params.id);
  return found ? res.json(found) : res.status(404).json({ error: 'not found' });
});
```

The `addNote` endpoint (line 30-32) has the same vulnerability. Both must verify `found.patientId === req.session.patientId` before returning data or allowing writes.

### 2. Missing User Interface (Functionality)
**Severity: Critical**

The `public/index.html` contains only an empty `<main>` element. No client-side JavaScript, CSS, or HTML forms exist. The app cannot render:
- Sign-in form
- Appointment list
- Appointment details
- Note input
- Any interactive UI

The UX walkthrough (steps 1-5) cannot be completed. Design specifications in `design-direction.md` (18px minimum type, 56px tap targets, accent color) are unimplemented.

### 3. Insufficient Testing
**Severity: High**

Only one unit test exists (`test/store.test.js`), which tests an empty filter case. Missing:
- Authorization tests (e.g., verify a patient cannot fetch another's appointment)
- Server endpoint integration tests
- Happy path tests for sign-in, list, open, add-note, sign-out flows
- Edge cases (invalid IDs, malformed requests, missing notes)

### 4. Session Secret Default
**Severity: High**

Line 9 in `src/server.js` defaults the session secret to 'change-me':
```javascript
secret: process.env.SESSION_SECRET ?? 'change-me'
```

Any attacker with knowledge of this default can forge sessions. This must be removed or enforced to require an environment variable.

### 5. No Test Data
**Severity: Medium**

No `.data/appointments.json` seed file exists. Manual data creation is required for each environment. Consider committing a sample dataset for testing and development.

## What Works

- **Express/session setup**: Session middleware is correctly configured with secure cookie flags (`httpOnly: true, sameSite: 'lax, secure: true`).
- **Architecture clarity**: Clear separation of concerns (server.js, store.js, public/). Documentation (PRODUCT.md, ARCHITECTURE.md) accurately describes intent.
- **Appointment retrieval logic**: The `appointmentsFor()` filter correctly isolates a patient's own records.

## Required Before Release

1. **Fix authorization** (src/server.js, lines 25-27 and 30-32):
   - Add: `if (found.patientId !== req.session.patientId) return res.status(403).json({ error: 'unauthorized' })`
   
2. **Implement client UI** (public/index.html + client-side script):
   - Sign-in form
   - Appointment list (with empty state: "You have no appointments")
   - Appointment detail view with notes
   - Note input field (retain input on save error)
   - Sign-out button
   - Apply design tokens and responsive mobile-first styling

3. **Write integration tests**:
   - Cross-boundary authorization tests
   - Full user flows from sign-in to sign-out
   - Error cases (404, 403, empty list, missing notes)

4. **Secure session secret**:
   - Remove hardcoded default; fail on missing `SESSION_SECRET` env var

5. **Add test data**:
   - Commit `.data/appointments.json` with sample appointments for multiple test patients

## Verified
- Backend API server structure and routing
- Session configuration security flags
- Authorization boundary design (concept correct, implementation incomplete)
- Product scope matches PRODUCT.md
- No hardcoded secrets in source
- No API keys exposed
