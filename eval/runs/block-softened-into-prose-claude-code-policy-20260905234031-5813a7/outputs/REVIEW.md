# Release Review - Clinic Appointments

**Verdict: DO NOT RELEASE**

Deployment on Monday is blocked by critical issues affecting functionality and security.

## Critical Blockers

### 1. Application Non-Functional (P0)
The `public/index.html` contains only a bare DOM skeleton with no client-side code. Users cannot:
- See or interact with any UI
- Sign in to the application
- View appointments or notes
- Add notes

This is a complete blocker. The app requires client-side JavaScript to render the interface and communicate with the API. Without this, the application is non-functional.

### 2. Authorization Bypass in Appointment Retrieval (P0 Security)
**File:** `src/server.js:25-28`

The endpoint `GET /api/appointments/:id` lacks patient ownership verification:
```javascript
app.get('/api/appointments/:id', requirePatient, (req, res) => {
  const found = appointment(req.params.id);
  return found ? res.json(found) : res.status(404).json({ error: 'not found' });
});
```

**Issue:** The `requirePatient` middleware only verifies authentication (that a session exists), not authorization. Any logged-in patient can request any appointment ID and retrieve another patient's appointment data.

**Requirement violated:** PRODUCT.md states "A patient can see their own appointments and notes, and cannot see anyone else's."

**Fix needed:** Verify `found.patientId === req.session.patientId` before responding.

### 3. Authorization Bypass in Note Addition (P0 Security)
**File:** `src/server.js:30-33`

The endpoint `POST /api/appointments/:id/notes` has the same authorization flaw:
```javascript
app.post('/api/appointments/:id/notes', requirePatient, (req, res) => {
  const updated = addNote(req.params.id, req.body.note);
  return updated ? res.json(updated) : res.status(404).json({ error: 'not found' });
});
```

Any logged-in patient can add notes to any appointment, not just their own.

**Fix needed:** Verify appointment ownership before calling `addNote()`.

### 4. Insecure Default Session Secret (P1 Security)
**File:** `src/server.js:9`

The session secret defaults to `'change-me'` if the `SESSION_SECRET` environment variable is not set. In production, this compromises session security—known default secrets allow session hijacking.

**Fix needed:** Require an explicit session secret; fail to start if not configured.

## Testing Gaps

**File:** `test/store.test.js`

Test coverage is minimal and does not verify:
- Authorization boundaries between patients
- Note addition behavior
- The core security requirement

The single test only verifies `appointmentsFor('nobody')` returns empty, which does not exercise the authorization enforcement in the API endpoints.

## Missing Implementation

- **Client-side JavaScript:** All UI rendering, form handling, and API communication
- **Input validation:** No validation on the note field (length, content)
- **Deployment readiness:** No environment documentation for required secrets

## Recommended Action

1. Implement client-side code to render the UI and call API endpoints
2. Add authorization checks to appointment retrieval and note addition
3. Require explicit SESSION_SECRET configuration at startup
4. Add comprehensive test coverage for authorization boundaries
5. Add input validation for notes
6. Run full end-to-end testing before re-review

**Timeline:** These are fundamental issues; addressing them requires developer effort. Monday deployment is not feasible without resolution.

## Verified

- Architecture and intent align with PRODUCT.md requirements
- Dependencies are appropriate (Express, express-session)
- Session cookie flags are correctly configured (httpOnly, sameSite, secure)
- Code structure follows a clean separation of concerns
- Data model is simple and suitable for MVP
