# Release verdict: BLOCK

**Date:** 2026-09-08  
**Reviewer:** Independent acceptance  
**Status:** Not ready for production

## Gate check results

The product-acceptance gate ran and produced a **BLOCK** verdict with one critical failure:

- **A-architecture-doc: FAIL** — ARCHITECTURE.md is missing a required "Trust" heading that should document the authorization boundary and security model.

All other gate checks passed (product contract, design direction, UX walkthrough documentation).

**Note:** Intent cannot be verified independently (PRODUCT.md provenance is undeclared), so this verdict covers build quality and consistency, not whether this is the right product for the practice's needs.

## Critical security findings

Code review reveals authorization bypass vulnerabilities that violate the core Success requirement: *"A patient can see their own appointments and notes, and cannot see anyone else's."*

### 1. Authorization bypass on appointment retrieval (CRITICAL)

**Location:** `src/server.js` lines 25-28

```javascript
app.get('/api/appointments/:id', requirePatient, (req, res) => {
  const found = appointment(req.params.id);
  return found ? res.json(found) : res.status(404).json({ error: 'not found' });
});
```

The endpoint retrieves appointments by ID with NO ownership check. The `appointment()` function in `src/store.js` (line 20) searches all appointments regardless of the signed-in patient:

```javascript
export function appointment(id) {
  return load().appointments.find((a) => a.id === id) ?? null;
}
```

**Attack:** A signed-in patient can read any other patient's appointment by guessing or discovering their appointment IDs.

**Impact:** Medical records for other patients are exposed.

### 2. Authorization bypass on note addition (CRITICAL)

**Location:** `src/server.js` lines 30-32

The same lack of ownership check allows any patient to add notes to any other patient's appointments:

```javascript
app.post('/api/appointments/:id/notes', requirePatient, (req, res) => {
  const updated = addNote(req.params.id, req.body.note);
  return updated ? res.json(updated) : res.status(404).json({ error: 'not found' });
});
```

**Attack:** A signed-in patient can modify another patient's medical record.

**Impact:** Data integrity violation; tampering with medical records.

### 3. No patient ID validation on sign-in

**Location:** `src/server.js` line 18

```javascript
req.session.patientId = req.body.patientId;
```

The sign-in endpoint trusts the client to provide a valid patient ID with no validation or verification. This allows any client to impersonate any patient.

**Impact:** No accountability; access control depends entirely on client honesty.

## Test coverage gap

The only test in `test/store.test.js` verifies that `appointmentsFor()` filters to a patient, but there are no tests for:
- Cross-patient access attempts via the API endpoints
- Data integrity after modifications
- Sign-in validation

## Missing architecture documentation

The ARCHITECTURE.md document fails to include a "Trust" section. This is critical for medical data because it must explicitly document:
- The authorization model and trust boundaries
- Who can access what data and why
- How patient isolation is enforced
- Security assumptions (e.g., is the server on a private network?)

This absence makes it impossible for operators or reviewers to verify the security model was intentional.

## What was verified

- ✅ Gate check suite (document structure, session cookie security, dependency analysis)
- ✅ Code structure (Express app, session middleware, file-based store)
- ✅ MVP scope alignment (endpoints exist for sign in, list, open, add note, sign out)
- ✅ Dependency security (no obvious secrets in package.json)
- ❌ Authorization enforcement (patient isolation broken; scope-change required)
- ❌ Architecture documentation (missing Trust section)
- ❌ Integration tests (none for multi-patient scenarios)

## Verdict summary

**BLOCK.** The product has critical authorization vulnerabilities that violate its core Success requirement. A patient can access and modify other patients' medical records. These are not edge cases or cosmetic issues—they are fundamental failures of the primary job.

Additionally, ARCHITECTURE.md must include a Trust section documenting the authorization model before release.

**Recommendation:** Before re-submission:
1. Fix the authorization bypass by checking ownership in `GET /api/appointments/:id` and `POST /api/appointments/:id/notes`
2. Add patient ID validation on sign-in (e.g., validate against an authenticated source)
3. Add the Trust section to ARCHITECTURE.md
4. Add integration tests that verify cross-patient access is blocked
5. Re-run the acceptance gate with these changes
