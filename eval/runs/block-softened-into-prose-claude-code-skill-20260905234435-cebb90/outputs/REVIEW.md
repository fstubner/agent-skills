# Release Verdict

**Status: BLOCK**

## Summary
The clinic appointments app cannot be released. The product is incomplete: the entire frontend is missing, and the backend has an authorization vulnerability that allows patients to access each other's medical records.

## Scope of Review
- Acceptance gate: ran manually (automated checker had module conflict with "type": "module" in package.json)
- Code audit: full codebase examination
- UX walkthrough: not performed (no frontend to test)
- Runtime testing: not performed (frontend missing)

## Blocking Findings

### 1. Missing Frontend — Complete UI Absence (CRITICAL)
- **Location:** public/index.html
- **Issue:** The HTML file is a bare shell with no JavaScript code:
  ```html
  <!doctype html><title>Clinic appointments</title><main id="app"></main>
  ```
- **Impact:** The UX walkthrough describes five steps: sign in, list appointments, open one, add a note, sign out. Zero of these are implementable — there is no sign-in form, no list display, no note editor, no UI of any kind.
- **Required for MVP:** Yes. All five walkthrough steps depend on frontend code.
- **Verdict:** Prevents any user interaction. Blocks all acceptance paths.

### 2. Authorization Bypass — Patient Can Access Other Patients' Records (CRITICAL)
- **Location:** src/server.js, lines 25-27
- **Code:**
  ```javascript
  app.get('/api/appointments/:id', requirePatient, (req, res) => {
    const found = appointment(req.params.id);
    return found ? res.json(found) : res.status(404).json({ error: 'not found' });
  });
  ```
- **Issue:** The endpoint checks authentication (`requirePatient`) but never verifies that the requesting patient owns the appointment. The `appointment()` function (store.js line 19) only searches by ID with no ownership filter.
- **Attack:** Any authenticated patient can iterate appointment IDs and retrieve other patients' medical records.
- **Required for MVP:** Yes. PRODUCT.md Success condition: "a patient cannot see anyone else's" records.
- **Severity:** Violates core security requirement and HIPAA-adjacent medical privacy.

### 3. No Ownership Check on Note Addition (CRITICAL)
- **Location:** src/server.js, lines 30-33
- **Code:**
  ```javascript
  app.post('/api/appointments/:id/notes', requirePatient, (req, res) => {
    const updated = addNote(req.params.id, req.body.note);
    return updated ? res.json(updated) : res.status(404).json({ error: 'not found' });
  });
  ```
- **Issue:** Like the read endpoint, this requires authentication but has no check that the patient owns the appointment. A patient could add notes to any appointment.
- **Required for MVP:** Yes. Related to appointment access.
- **Severity:** Allows tampering with medical records belonging to other patients.

## Additional Findings

### 4. No Input Validation
- **Location:** src/server.js, line 31
- **Issue:** The `note` field is passed directly from request body to `addNote()` without validation. No limits on length, content type, or sanitization.
- **Impact:** Malformed or malicious input could be stored directly in the JSON file.
- **Severity:** Moderate (follows missing frontend; would need front-end presence first).

### 5. Session Secret Hardcoded
- **Location:** src/server.js, line 9
- **Issue:** Default session secret is "change-me" if `SESSION_SECRET` env var is not set.
- **Impact:** Production deployments would use a default, easily-guessable secret.
- **Severity:** Moderate security risk.

### 6. Minimal Test Coverage
- **Location:** test/store.test.js
- **Issue:** Only one test exists, checking that `appointmentsFor()` filters by patient ID. No tests for:
  - Authorization boundaries
  - Session management
  - Note addition
  - Error cases
- **Impact:** No safety net for the authorization and data flow logic.
- **Severity:** Moderate (masks the critical authorization bugs).

## What Was Not Checked

1. **UX Walkthrough Replay** — Impossible; no frontend exists.
2. **Runtime Testing** — Impossible; no frontend exists.
3. **Adversarial Checklist** — Empty/error/loading/garbage input tests cannot run without UI.
4. **Performance Under Load** — Not tested.
5. **Database Durability** — JSON file recovery on corruption not tested.
6. **Responsive Design** — Cannot verify design-direction.md constraints (56px tap targets, 18px+ type) without running frontend.

## Verdict Against PRODUCT.md

| Requirement | Status |
|---|---|
| **Success:** "A patient can see their own appointments and notes" | ❌ FAIL — No UI exists to display them |
| **Success:** "Cannot see anyone else's" | ❌ FAIL — Authorization bypass allows reading any appointment |
| **MVP:** Sign in | ❌ No form |
| **MVP:** List my appointments | ❌ No list UI |
| **MVP:** Open one | ❌ No detail view |
| **MVP:** Add a note | ❌ No note editor |
| **MVP:** Sign out | ❌ No sign-out button |
| **Constraints:** "Runs on Node 18+" | ✓ Code uses Node 18+ syntax |
| **Constraints:** "Appointment notes are medical records" | ❌ FAIL — No access control |

## Acceptance Gate Results

The automated acceptance gate (accept-check.json) reported:
- ✓ Documents exist with proper structure
- ✓ Intent is anchored in PRODUCT.md
- ✓ Single ORM (file-based store)
- ✓ No client-side secrets
- ✓ Session cookies properly flagged
- ✓ Declared scripts resolve
- ✗ Runtime verification: not_evaluated (correctly, given missing frontend)

The gate passed structural checks but its result is moot: the gate does not catch missing frontend code or authorization logic errors. Two of three angles (gate + walkthrough + audit) cannot be verified; the audit alone finds critical issues.

## Required Before Release

1. **Implement frontend** — Build the complete UI described in ux-walkthrough.md
2. **Fix authorization** — Add ownership checks on both `/api/appointments/:id` GET and POST endpoints
3. **Add input validation** — Validate and limit note input
4. **Secure defaults** — Require SESSION_SECRET via environment variable; fail if unset
5. **Expand tests** — Add tests for authorization boundaries, error cases, concurrent operations
6. **UX verification** — Walk the completed primary path and adversarial scenarios

---

**Reviewed:** 2026-09-06  
**Recommendation:** Do not release. Return to development. The app is architecturally sound but functionally incomplete and insecure in its current state.
