# Release verdict

**Status: DO NOT RELEASE**

## Critical issues

### 1. Authorization bypass on individual appointment endpoints

**Severity: Critical** — Violates core security requirement.

The endpoints `GET /api/appointments/:id` and `POST /api/appointments/:id/notes` do not verify that the requesting patient owns the appointment. Any authenticated patient can access or modify another patient's medical records by guessing or discovering appointment IDs.

**Location:** `src/server.js:25-27` and `src/server.js:30-32`

**Flow:**
- `appointmentsFor(patientId)` correctly filters to the user's appointments (line 22-23)
- Individual appointment endpoints bypass this filter and return any appointment by ID

**Example attack:**
```
Sign in as patient A (patientId: "A123")
GET /api/appointments/appointment-b-uuid → returns patient B's appointment
POST /api/appointments/appointment-b-uuid/notes → adds note to patient B's record
```

**Required fix:** Verify the appointment belongs to the signed-in patient:
```javascript
app.get('/api/appointments/:id', requirePatient, (req, res) => {
  const found = appointment(req.params.id);
  if (!found || found.patientId !== req.session.patientId) {
    return res.status(404).json({ error: 'not found' });
  }
  return res.json(found);
});
```

Apply the same check to the notes endpoint.

### 2. Frontend is incomplete

**Severity: High** — App is non-functional for users.

The HTML file at `public/index.html` is a bare container with no application code. The UX walkthrough describes the desired flow (sign in, list appointments, open one, add note, sign out) but there is no implementation.

**Status:** The backend API exists but users cannot interact with it.

## Issues requiring attention

### 3. No test coverage for authorization

The test in `test/store.test.js` only verifies that `appointmentsFor()` filters correctly. There are no tests for:
- Authorization on individual appointment access
- Authorization on adding notes
- Patient isolation across different patient IDs

### 4. Session security considerations

The session secret defaults to `'change-me'` (line 9, `src/server.js`). Before production deployment, ensure:
- `SESSION_SECRET` environment variable is set to a strong random value
- Cookies are configured with `secure: true` (requires HTTPS)

This is implemented but depends on environment configuration.

## What was verified

✓ Requirements (PRODUCT.md): Sign in, list appointments, open one, add note, sign out
✓ Architecture (ARCHITECTURE.md): Express app with JSON file datastore and session-based auth
✓ Dependencies: Express 4.19.0, express-session 1.18.0
✓ Data model: Appointments with patientId, notes array, and ID
✓ Authentication: Session middleware and requirePatient guard on /api/* routes
✗ Authorization: Individual appointment endpoints lack ownership checks
✗ Frontend implementation: HTML container only, no UI code
✗ End-to-end flow: Cannot verify without frontend or running app
✗ Tests: Incomplete coverage; no authorization tests

## Recommendation

**Delay deployment by at least one week.** The authorization bypass is a data protection violation that makes the app unsuitable for handling medical records. This must be fixed and tested before Monday's launch.

Required before release:
1. Implement authorization check on `GET /api/appointments/:id` and `POST /api/appointments/:id/notes`
2. Add test cases for authorization (e.g., patient A cannot see patient B's appointments)
3. Implement the frontend to complete the UX flow
4. Run end-to-end testing with the complete app
5. Configure production environment variables (SESSION_SECRET, HTTPS)
