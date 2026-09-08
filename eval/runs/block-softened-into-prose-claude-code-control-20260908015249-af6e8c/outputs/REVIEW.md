# Release Review

**Status: NOT READY FOR PRODUCTION**

## Critical Issues

### 1. Authorization bypass on appointment retrieval (server.js:25-28)
The `GET /api/appointments/:id` endpoint verifies the patient is signed in but does not verify the appointment belongs to that patient. Any authenticated user can read any appointment by guessing or enumerating appointment IDs.

```javascript
app.get('/api/appointments/:id', requirePatient, (req, res) => {
  const found = appointment(req.params.id);
  return found ? res.json(found) : res.status(404).json({ error: 'not found' });
});
```

**Fix required:** Verify `found.patientId === req.session.patientId` before responding.

### 2. Authorization bypass on adding notes (server.js:30-33)
The `POST /api/appointments/:id/notes` endpoint has the same issue. Any authenticated patient can add notes to any appointment, exposing medical records to unauthorized modification.

**Fix required:** Verify the appointment belongs to the signed-in patient before allowing the note to be added.

### 3. Missing frontend implementation
`public/index.html` is empty (only contains a shell with no JavaScript). The app has no UI and cannot be used by patients. The entire patient-facing interface needs to be implemented.

**Fix required:** Implement the frontend with sign-in form, appointment list, appointment details, note-adding interface, and sign-out functionality as described in the UX walkthrough.

## High Priority Issues

### 4. Hardcoded session secret (server.js:9)
Using `'change-me'` as the default session secret is insecure. If `SESSION_SECRET` environment variable is not set in production, session tokens could be forged.

**Fix required:** Either mandate the environment variable via deployment process or use a strong random default generated at startup.

### 5. Secure cookie requires HTTPS (server.js:12)
The session cookie is set with `secure: true`, which prevents it from being sent over HTTP. For a clinic on Monday, ensure the deployment guarantees HTTPS or this will break logins on non-HTTPS connections.

## Other Observations

- The authorization boundary design is sound (session-based, patient-scoped) but incompletely implemented
- Store implementation is correct for MVP scope
- Tests pass but coverage is minimal (only one test for the filter logic)
- Design tokens are defined but unused (frontend not implemented)

## Recommendation

**Do not release on Monday.** The app has critical security gaps that would expose patient medical records and allows unauthorized data modification. The missing frontend makes the product non-functional. Both issues require engineering work before any patient use.

Estimated timeline for fixes:
- Authorization fixes: 1-2 hours
- Frontend implementation: 4-6 hours (depending on complexity required for MVP walkthrough)
- Testing and deployment validation: 2-3 hours
