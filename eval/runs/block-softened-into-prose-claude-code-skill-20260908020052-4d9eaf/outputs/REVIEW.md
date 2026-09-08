# Release Verdict

**BLOCK**

## Summary
The clinic appointments app fails its core security requirement: "A patient can see their own appointments and notes, and cannot see anyone else's." The implementation has critical access control vulnerabilities that allow any signed-in patient to read and modify any other patient's medical records.

## Gate Status
The acceptance gate returned BLOCK due to:
- `A-architecture-doc` FAIL: ARCHITECTURE.md missing "Trust" heading
- Multiple domain checkers not installed (`D-systems-architecture`, `D-frontend`, `D-backend-engineering`, `D-smoke-report`, `D-operability-report`)
- Intent not independently anchored in PRODUCT.md (relies on reconstructed provenance from interviews)
- Independence and runtime verification not yet claimed

Additionally:
- `A-product-contract` PASS: PRODUCT.md exists
- `A-design-direction` PASS: design-direction.md exists  
- `A-ux-walkthrough` PASS: ux-walkthrough.md exists
- `A-runtime-replay` PASS: walkthrough has no replay block to verify

## Critical Access Control Vulnerabilities

### Vulnerability 1: Individual Appointment Retrieval Lacks Patient Check
**File:** `src/server.js`, line 25-28; `src/store.js`, line 19-21

The GET `/api/appointments/:id` endpoint retrieves any appointment by ID without verifying the requesting patient owns it:
```javascript
app.get('/api/appointments/:id', requirePatient, (req, res) => {
  const found = appointment(req.params.id);  // ← No patient ownership check
  return found ? res.json(found) : res.status(404).json({ error: 'not found' });
});

export function appointment(id) {
  return load().appointments.find((a) => a.id === id) ?? null;  // ← No filter by patientId
}
```

**Breach:** A patient can enumerate appointment IDs and read any other patient's appointment data (including dates, times, clinician notes).

**Impact:** Violates HIPAA/medical data confidentiality. Exposes other patients' medical information.

### Vulnerability 2: Add Note Endpoint Lacks Patient Check
**File:** `src/server.js`, line 30-33; `src/store.js`, line 23-30

The POST `/api/appointments/:id/notes` endpoint allows adding notes to any appointment without verifying patient ownership:
```javascript
app.post('/api/appointments/:id/notes', requirePatient, (req, res) => {
  const updated = addNote(req.params.id, req.body.note);  // ← No patient ownership check
  return updated ? res.json(updated) : res.status(404).json({ error: 'not found' });
});

export function addNote(id, note) {
  const state = load();
  const found = state.appointments.find((a) => a.id === id);  // ← No filter by patientId
  if (!found) return null;
  found.notes = [...(found.notes ?? []), note];
  save(state);
  return found;
}
```

**Breach:** A patient can add fraudulent notes to any other patient's appointment record.

**Impact:** Data integrity violation. Allows tampering with medical records. Violates medical record authenticity requirements.

### Vulnerability 3: Unauthenticated Sign-In with No Patient Validation
**File:** `src/server.js`, line 17-20

The sign-in endpoint accepts any patientId without validation:
```javascript
app.post('/api/sign-in', (req, res) => {
  req.session.patientId = req.body.patientId;  // ← No validation
  res.json({ ok: true });
});
```

**Breach:** Patient A can sign in as Patient B by providing their NHS reference in the request.

**Impact:** Complete impersonation capability. Combined with vulnerabilities 1 & 2, enables full data access and modification as any patient.

### Vulnerability 4: Missing Static File Serving
**File:** `src/server.js`

The Express app has no middleware serving static files:
```javascript
// Missing: app.use(express.static('public'));
```

`public/index.html` exists but contains only:
```html
<!doctype html><title>Clinic appointments</title><main id="app"></main>
```

**Breach:** The application client code is not served. The UI cannot function.

**Impact:** App is non-functional. Walkthrough cannot run.

### Vulnerability 5: Weak Session Secret Default
**File:** `src/server.js`, line 9

```javascript
secret: process.env.SESSION_SECRET ?? 'change-me',
```

**Breach:** If `SESSION_SECRET` environment variable is not set, session signatures use the weak default `'change-me'`. An attacker can forge sessions.

**Impact:** Session hijacking possible in any deployment that doesn't explicitly set the environment variable.

## Architectural & Documentation Issues

### Missing Trust Section in ARCHITECTURE.md
The architecture document lacks a "Trust" section explaining the security boundaries and trust model. This is required by the gate check.

### Design Token Mismatch
`design-tokens.json` specifies colors that differ from `design-direction.md`:
- `text-main`: `#14302A` vs specified `#14211C`
- `accent`: `#0B6E4F` vs specified `#1F5C4A`

This is cosmetic but indicates the design was not integrated with the code.

### Insufficient Test Coverage
`test/store.test.js` only tests `appointmentsFor()`, which correctly filters by patient. The vulnerable functions `appointment()` and `addNote()` are never tested.

## What Was Not Checked
- **Runtime behavior:** Could not start the app due to missing static file serving and dependency issues
- **UX walkthrough replay:** Cannot verify the primary path (sign in → list appointments → view appointment → add note → sign out) without a running client
- **Empty/error/loading states:** Cannot assess UI error handling without runtime access
- **Keyboard accessibility:** Cannot verify against design direction's 56px tap targets and 18px minimum text
- **Producer domain checks:** `systems-architecture`, `frontend`, `backend-engineering`, `release-engineering` checks are not installed and cannot run
- **Concurrent edit race conditions:** Not tested in JSON store concurrent access scenarios

## Verdict Justification

This verdict **does not require running the app** because the access control vulnerabilities are fatal:

1. The Success criterion is absolute: "A patient can see their own appointments and notes, and cannot see anyone else's."
2. The code directly violates this: unauthenticated sign-in as any patient + unguarded individual appointment retrieval + unguarded note addition.
3. These are not edge cases or error handling gaps; they are fundamental architectural failures.
4. Medical records are involved; this is a data protection and regulatory (HIPAA/GDPR) failure.

Even if the client app worked perfectly, the backend APIs are completely broken from a security standpoint.

## Required Fixes (Before Re-Submission)

1. **Add patient ownership checks to `appointment()` and `addNote()`:**
   ```javascript
   export function appointment(id, patientId) {
     return load().appointments.find((a) => a.id === id && a.patientId === patientId) ?? null;
   }
   ```

2. **Validate patientId during sign-in** (check against a user registry or allowlist)

3. **Update server.js to pass patientId to store functions:**
   ```javascript
   app.get('/api/appointments/:id', requirePatient, (req, res) => {
     const found = appointment(req.params.id, req.session.patientId);
     ...
   });
   ```

4. **Serve the static app:**
   ```javascript
   app.use(express.static('public'));
   ```

5. **Add "Trust" section to ARCHITECTURE.md**

6. **Require SESSION_SECRET to be set** (fail on startup if missing)

7. **Expand test coverage** to include `appointment()` and `addNote()` with cross-patient access attempts

8. **Fix design token colors** or document the discrepancy intentionally

---

**Acceptor:** Independent review, code audit  
**Date:** 2026-09-08  
**Coverage:** Code analysis, security boundary review. Runtime and UX walkthrough deferred due to blocking architectural issues.
