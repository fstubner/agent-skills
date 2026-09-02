# Acceptance Review — Clinic Appointments App

**Verdict: BLOCK**

## Critical Finding: Authorization Bypass Vulnerability

The app fails its core security requirement from PRODUCT.md: "A patient can see their own appointments and notes, and cannot see anyone else's."

### Issue Details

**Location:** `src/server.js`, lines 25–28 and 30–33

The `/api/appointments/:id` and `/api/appointments/:id/notes` endpoints perform no ownership check before returning data or accepting updates:

```javascript
app.get('/api/appointments/:id', requirePatient, (req, res) => {
  const found = appointment(req.params.id);  // No patientId filter
  return found ? res.json(found) : res.status(404).json({ error: 'not found' });
});

app.post('/api/appointments/:id/notes', requirePatient, (req, res) => {
  const updated = addNote(req.params.id, req.body.note);  // No ownership check
  return updated ? res.json(updated) : res.status(404).json({ error: 'not found' });
});
```

The underlying `appointment()` and `addNote()` functions in `src/store.js` fetch by ID only, without filtering for the signed-in patient:

```javascript
export function appointment(id) {
  return load().appointments.find((a) => a.id === id) ?? null;  // No patientId check
}
```

### Attack Scenario

1. Patient A signs in with their ID (e.g., `patient123`)
2. Patient A can access **any** appointment by guessing or discovering its ID via the `/api/appointments/:id` endpoint
3. Patient A can add notes to **any** appointment via `/api/appointments/:id/notes`

This violates the security boundary defined in ARCHITECTURE.md: "The signed-in patient reference is the authorisation boundary: a patient sees their own records and no others."

### Why This Is a Block

- **Severity:** Critical. Violates patient privacy and HIPAA-relevant concerns for medical records.
- **Scope:** Affects the core functionality — data isolation is non-negotiable for a healthcare app.
- **Test Coverage:** The test suite (`test/store.test.js`) only validates `appointmentsFor()` filtering; it does not test the endpoint-level authorization.

## What Was Verified

- **Code Review:** Manual inspection of `src/server.js`, `src/store.js`, and `test/store.test.js`.
- **Security Analysis:** Authorization checks in endpoints against patient context.
- **Acceptance Gate Report:** Previous report (2026-08-31) was CONDITIONAL due to missing runtime verification; re-running the gate is pending approval.

## What Was Not Verified

- **Live Walkthrough:** Runtime behavior not tested; acceptance gate runtime check deferred.
- **Engineering Assessment:** Full codebase audit (agent-skills:engineering-assessment) not yet run.
- **Data Access Patterns:** No live database inspection or fuzzing of appointment ID discovery.

## Recommendation

**Do not release.** The authorization bypass must be fixed before Monday. Implement patient ownership checks in both endpoints:

```javascript
app.get('/api/appointments/:id', requirePatient, (req, res) => {
  const found = appointment(req.params.id);
  if (!found || found.patientId !== req.session.patientId) {
    return res.status(404).json({ error: 'not found' });
  }
  return res.json(found);
});
```

Apply the same fix to the `/api/appointments/:id/notes` endpoint.

---

**Context:** This review was conducted independently from the build, before runtime verification. The gate and walkthrough remain pending.
