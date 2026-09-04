# Release Review - Clinic Appointments App

**Status: NOT READY FOR RELEASE**

**Release date requested:** Monday, 2026-09-06  
**Review completed:** 2026-09-02

---

## Critical Issues (Blockers)

### 1. No Frontend Implementation
The `public/index.html` is a skeleton with only a title and empty main div. **Zero UI exists.** The app has:
- No sign-in form
- No appointments list view
- No appointment detail view  
- No note-adding interface
- No CSS or styling

The UX walkthrough describes a complete patient flow, but there is no code to implement any of it. Patients cannot use this app at all.

### 2. Authorization Bypass - Appointment Visibility
**Severity: CRITICAL - Patient data breach risk**

The `GET /api/appointments/:id` endpoint (server.js:25-28) only checks session existence via `requirePatient` middleware. It does **not verify** the appointment belongs to the signed-in patient.

```javascript
app.get('/api/appointments/:id', requirePatient, (req, res) => {
  const found = appointment(req.params.id);  // No patientId check
  return found ? res.json(found) : res.status(404).json({ error: 'not found' });
});
```

**Attack:** A signed-in patient can request any appointment ID and read another patient's medical records.

### 3. Authorization Bypass - Note Modification
**Severity: CRITICAL - Patient record tampering risk**

The `POST /api/appointments/:id/notes` endpoint (server.js:30-33) has the same vulnerability. Any authenticated patient can add notes to any appointment.

```javascript
app.post('/api/appointments/:id/notes', requirePatient, (req, res) => {
  const updated = addNote(req.params.id, req.body.note);  // No patientId check
  return updated ? res.json(updated) : res.status(404).json({ error: 'not found' });
});
```

**Attack:** A patient could tamper with another patient's medical records by adding false notes.

### 4. No Authentication
**Severity: CRITICAL - Identity spoofing**

The sign-in endpoint (server.js:17-20) accepts **any patientId without verification**:

```javascript
app.post('/api/sign-in', (req, res) => {
  req.session.patientId = req.body.patientId;  // No validation
  res.json({ ok: true });
});
```

There is no password, NHS verification, or identity confirmation. A user can sign in as any patient by simply sending their ID in the request body.

### 5. Weak Default Session Secret
**Severity: HIGH - Session hijacking risk**

Line 9: `secret: process.env.SESSION_SECRET ?? 'change-me'`

The hardcoded fallback `'change-me'` is a well-known placeholder. If the environment variable is not set in production, sessions are easily forgeable.

---

## Major Issues (High Priority)

### 6. Incomplete Test Coverage
- Only 1 test exists, testing a single function with one case
- No API endpoint tests
- No authorization verification tests
- No happy-path integration tests
- Test file doesn't validate the core security requirements

### 7. No Input Validation
- Patient IDs not validated
- Appointment IDs not validated
- Note content not validated
- Vulnerability to injection attacks and data corruption

### 8. Data File Concurrency Issues
The JSON file store (`store.js`) has no locking mechanism. Concurrent requests could:
- Corrupt the data file mid-write
- Lose appointment data
- Create invalid records

---

## Design Direction Not Realized

The design tokens (design-tokens.json) and design direction document specify:
- Minimum 18px font size
- 56px tap targets  
- Specific color palette (#0B6E4F accent, #14302A text, #FAFAF7 background)

None of this is implemented in the HTML. No CSS exists.

---

## What Must Be Done Before Release

1. **Implement the complete frontend UI** with all screens: sign-in, appointments list, appointment detail, note-adding
2. **Add authorization checks** to `/api/appointments/:id` and `/api/appointments/:id/notes` to verify the appointment belongs to the signed-in patient
3. **Implement proper authentication** - integrate with NHS patient reference validation or equivalent verification mechanism
4. **Set SESSION_SECRET** as a required environment variable with no fallback default
5. **Add comprehensive test coverage** including API endpoint tests and authorization boundary tests
6. **Add input validation** for all user-provided data
7. **Implement data file locking** or use a proper database to prevent concurrent write corruption
8. **Implement the design** with CSS styling per design direction

---

## Verdict

**DO NOT RELEASE.** This app has:
- No user interface (cannot be used)
- Three critical authorization vulnerabilities exposing patient medical records to unauthorized access
- No authentication mechanism (identity spoofing possible)
- Incomplete implementation

Medical record security is non-negotiable. Every issue above must be resolved before patient data enters this system.

**Estimated additional work:** 3-5 days minimum for a secure, complete implementation.
