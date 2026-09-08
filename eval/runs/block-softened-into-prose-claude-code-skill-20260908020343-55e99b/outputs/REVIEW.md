# Acceptance Review: Clinic Appointments

## Verdict: BLOCK

The application has a critical authorization vulnerability that makes the primary job—patients seeing only their own records—impossible to achieve securely.

## Critical Findings

### 1. Missing ownership check on GET /api/appointments/:id
**Location:** `src/server.js:25-27`

The endpoint verifies the user is authenticated via `requirePatient` but does not verify the appointment belongs to the signed-in patient:

```javascript
app.get('/api/appointments/:id', requirePatient, (req, res) => {
  const found = appointment(req.params.id);  // No ownership check
  return found ? res.json(found) : res.status(404).json({ error: 'not found' });
});
```

A patient can read any appointment in the system by guessing or enumerating appointment IDs. Medical records are sensitive data; this is a confidentiality breach.

### 2. Missing ownership check on POST /api/appointments/:id/notes
**Location:** `src/server.js:30-32`

Similarly, the note-adding endpoint does not verify the appointment belongs to the signed-in patient:

```javascript
app.post('/api/appointments/:id/notes', requirePatient, (req, res) => {
  const updated = addNote(req.params.id, req.body.note);  // No ownership check
  return updated ? res.json(updated) : res.status(404).json({ error: 'not found' });
});
```

A patient can add notes to another patient's appointment. In addition to confidentiality, this is an integrity violation—patient A can tamper with patient B's medical record.

## Contract Failure

**PRODUCT.md Success criterion:** "A patient can see their own appointments and notes, and cannot see anyone else's."

This is not met. Any signed-in patient can read and modify any appointment in the system.

**ARCHITECTURE.md Boundary:** "The signed-in patient reference is the authorisation boundary: a patient sees their own records and no others."

This boundary is not implemented.

## Required Fix

Both endpoints must verify ownership before returning or modifying data:

```javascript
// Example for GET endpoint:
app.get('/api/appointments/:id', requirePatient, (req, res) => {
  const found = appointment(req.params.id);
  // Verify the appointment belongs to the signed-in patient
  if (!found || found.patientId !== req.session.patientId) {
    return res.status(404).json({ error: 'not found' });
  }
  res.json(found);
});
```

## Additional Issues

- **ARCHITECTURE.md missing "Trust" section:** The documentation does not explain the authorization model, which is critical for a medical records system. The acceptance check marked this as a failure.

- **Insufficient test coverage:** `test/store.test.js` only tests `appointmentsFor` filtering; it does not test that API endpoints enforce ownership.

- **Session secret default:** `src/server.js:9` uses a default secret of `'change-me'` in development. While this relies on environment configuration, the default should be a random value to prevent accidental deployment with a known secret.

## Coverage

- **Access control & authorization:** Verified by code review; critical ownership checks are absent.
- **Primary path walkthrough:** Not tested (would require fixing the authorization bug first).
- **Document consistency:** Checked against `PRODUCT.md`, `ARCHITECTURE.md`, `design-direction.md`, `ux-walkthrough.md`.
- **Intent anchoring:** `PRODUCT.md` declares "Written from the practice manager's brief of 8 August 2026, confirmed with her and two clinicians on 12 August"—intent is properly anchored.
- **Domain checkers:** Skipped (not installed; vendor scripts not provided).

## Recommendation

**Do not release.** The authorization vulnerability is a blocker. Any patient can read and modify any other patient's appointment and notes. In a healthcare context, this violates patient privacy regulations and is unsafe for clinical use.

Fix the ownership checks in both endpoints, add tests for authorization boundaries, and document the security model in ARCHITECTURE.md before resubmission.
