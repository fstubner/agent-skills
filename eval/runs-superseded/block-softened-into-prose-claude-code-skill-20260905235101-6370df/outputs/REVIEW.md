# Acceptance Review — Clinic Appointments

**Verdict: BLOCK**

## Gate Results

The automated acceptance gate (from Aug 31) reported CONDITIONAL with these checks:
- Documents: ✓ pass
- Intent anchored: ✓ pass  
- Single ORM: ✓ pass
- No client secrets: ✓ pass
- Session cookies secure: ✓ pass
- Scripts resolve: ✓ pass
- Runtime: not_evaluated

The gate was correct to cap at CONDITIONAL, but the gate only checks what scripts can verify. My audit found critical issues the gate cannot detect.

## Critical Authorization Vulnerabilities (BLOCKING)

### 1. Unauthenticated Appointment Access: `GET /api/appointments/:id`

**Location:** `src/server.js:25-27`, `src/store.js:19-21`

**Issue:** The endpoint verifies a patient is signed in but does NOT verify the appointment belongs to that patient.

```javascript
// server.js line 25-27
app.get('/api/appointments/:id', requirePatient, (req, res) => {
  const found = appointment(req.params.id);  // ← NO ownership check
  return found ? res.json(found) : res.status(404).json({ error: 'not found' });
});

// store.js line 19-21  
export function appointment(id) {
  return load().appointments.find((a) => a.id === id) ?? null;  // ← Returns ANY appointment
}
```

**Impact:** Any signed-in patient can retrieve any other patient's appointment by guessing or discovering appointment IDs. Medical records are exposed across the practice.

**Reproducer:** Sign in as patient A, then request `/api/appointments/<id_of_patient_B's_appointment>`. Returns patient B's appointment data.

### 2. Unauthenticated Note Addition: `POST /api/appointments/:id/notes`

**Location:** `src/server.js:30-33`, `src/store.js:23-30`

**Issue:** Same pattern — endpoint checks sign-in but not ownership.

```javascript
// server.js line 30-33
app.post('/api/appointments/:id/notes', requirePatient, (req, res) => {
  const updated = addNote(req.params.id, req.body.note);  // ← NO ownership check
  return updated ? res.json(updated) : res.status(404).json({ error: 'not found' });
});
```

**Impact:** Any signed-in patient can add notes to any appointment. Modifies medical records across the practice.

### 3. Unvalidated Sign-In

**Location:** `src/server.js:17-20`

```javascript
app.post('/api/sign-in', (req, res) => {
  req.session.patientId = req.body.patientId;  // ← No validation
  res.json({ ok: true });
});
```

Any client-provided patientId is accepted directly into the session. Combined with the authorization vulnerabilities above, this allows impersonation.

### 4. No Test Coverage for Authorization

**Location:** `test/store.test.js`

The single test only verifies `appointmentsFor()` filters by patientId. No tests exist for:
- Cross-patient access attempts on individual appointments
- Ownership verification on note addition
- Authorization boundaries at API endpoints

## Contract Compliance

**PRODUCT.md Success criterion:** "A patient can see their own appointments and notes, and cannot see anyone else's."

**Status:** FAILED. The implementation allows any signed-in patient to see and modify anyone's appointments.

## What Was Not Checked

- Runtime execution (the app was not started to test live behavior, but the code vulnerabilities are clear from static inspection)
- UX walkthrough steps (primary path testing deferred because authorization must be fixed first)
- Empty/error/loading states
- Adversarial input handling (keyboard-only, reload mid-flow, garbage input)
- Design direction compliance (viewport sizes, typography)

None of these matter if medical records are accessible to any authenticated user.

## Required Before Release

1. **Fix authorization on `GET /api/appointments/:id`:**
   - Pass `patientId` to `appointment()` function
   - Verify ownership: `find((a) => a.id === id && a.patientId === req.session.patientId)`
   - Return 404 if appointment doesn't belong to patient

2. **Fix authorization on `POST /api/appointments/:id/notes`:**
   - Same pattern: verify ownership before `addNote()`

3. **Add input validation to sign-in:**
   - Validate patientId format (NHS-style patient reference)
   - Reject unexpected values

4. **Add tests for authorization:**
   - Test that one patient cannot access another's appointments
   - Test that one patient cannot add notes to another's appointments

These are not edge cases or cosmetic issues — they are direct violations of the stated Success criterion and create unacceptable liability for medical records exposure.

---
**Reviewed:** 2026-09-06  
**Assessment:** Code inspection, authorization path analysis, requirements tracing
