# Release Review: Clinic Appointments App

**Date:** 2026-09-01  
**Reviewer:** Independent acceptance context (separate from build)  
**Verdict:** **BLOCK** — Critical security and functionality issues prevent release

---

## Summary

The clinic appointments app **cannot be shipped in its current state**. Review identified 3 critical blockers:

1. **Missing client-side implementation** — The entire frontend is absent; the app is non-functional
2. **Authorization bypass on appointment view** — Signed-in patients can read other patients' medical records
3. **Authorization bypass on note modification** — Signed-in patients can alter other patients' medical records

These directly violate the core Success criterion: "A patient can see their own appointments and notes, and cannot see anyone else's." The system currently enables what it explicitly forbids.

---

## What Was Checked

### 1. Code Audit (Complete Codebase Review)
✓ Examined all source files: `src/server.js`, `src/store.js`, `public/index.html`  
✓ Reviewed test suite: `test/store.test.js`  
✓ Read all project documents: `PRODUCT.md`, `ARCHITECTURE.md`, `ux-walkthrough.md`, `design-direction.md`  
✓ Analyzed authorization logic, data validation, error handling

### 2. Documentation Compliance
✓ PRODUCT.md — Provenance is user-confirmed (practice manager + clinicians, Aug 12, 2026)  
✓ ARCHITECTURE.md — Exists with real content  
✓ ux-walkthrough.md — Exists with step-by-step flow  
✓ design-direction.md — Exists with design intent  

### 3. Contract Verification (MVP Scope)
- Sign in — Endpoint exists, **no validation**, **no client code**
- List appointments — Endpoint correct, **no client code**
- Open appointment — Endpoint **has authorization bypass**, **no client code**
- Add note — Endpoint **has authorization bypass**, **no client code**
- Sign out — Endpoint exists, **no client code**

### 4. What Was NOT Checked
- **Runtime walkthrough** — Cannot execute: no client-side implementation exists. The application cannot be interacted with.
- **Empty/loading/error states** — No frontend code to display these.
- **Mobile responsiveness** — No CSS or viewport-aware UI.
- **Keyboard navigation** — No interactive UI elements exist.

---

## Critical Findings

### CRITICAL #1: Missing Client-Side Application
**Category:** Functionality / MVP Completeness  
**Severity:** CRITICAL  
**Location:** `public/index.html`

**Finding:**  
The index.html file contains only a bare skeleton:
```html
<!doctype html><title>Clinic appointments</title><main id="app"></main>
```

Zero client-side JavaScript exists. No code implements:
- Sign-in form rendering and submission
- API call orchestration
- Appointment list display (sorted soonest-first per ux-walkthrough.md)
- Appointment detail view
- Note submission UI
- Error/loading state display
- Sign-out functionality

**Impact:**  
The entire MVP scope is unreachable. Users cannot interact with the application. Every step in ux-walkthrough.md (steps 1-5) cannot be executed. The application is non-functional.

**Must fix before release:** Implement complete client-side application with UI rendering, API integration, and state management.

---

### CRITICAL #2: Authorization Bypass — Read Other Patients' Appointments
**Category:** Security / Data Privacy  
**Severity:** CRITICAL  
**Location:** `src/server.js`, lines 25-27

**Finding:**  
The GET `/api/appointments/:id` endpoint retrieves any appointment by ID without verifying ownership:

```javascript
app.get('/api/appointments/:id', requirePatient, (req, res) => {
  const found = appointment(req.params.id);
  return found ? res.json(found) : res.status(404).json({ error: 'not found' });
});
```

The `appointment()` function in `src/store.js` (lines 19-20) does not check `patientId`:
```javascript
export function appointment(id) {
  return load().appointments.find((a) => a.id === id) ?? null;
}
```

**Attack scenario:**
1. Patient A signs in with patientId = "P123456"
2. Patient A calls GET `/api/appointments/P789999-appt-001`
3. Server returns Patient B's appointment details, including notes

Any signed-in patient can enumerate and read other patients' medical records.

**Impact:**  
**GDPR/HIPAA violation.** Medical records (per PRODUCT.md: "Appointment notes are medical records") are accessed by unauthorized patients. Directly contradicts the Success criterion: "cannot see anyone else's."

**Must fix before release:**
```javascript
app.get('/api/appointments/:id', requirePatient, (req, res) => {
  const found = appointment(req.params.id);
  if (!found || found.patientId !== req.session.patientId) {
    return res.status(404).json({ error: 'not found' });
  }
  return res.json(found);
});
```

---

### CRITICAL #3: Authorization Bypass — Modify Other Patients' Appointments
**Category:** Security / Data Integrity  
**Severity:** CRITICAL  
**Location:** `src/server.js`, lines 30-32

**Finding:**  
The POST `/api/appointments/:id/notes` endpoint adds notes to any appointment without verifying ownership:

```javascript
app.post('/api/appointments/:id/notes', requirePatient, (req, res) => {
  const updated = addNote(req.params.id, req.body.note);
  return updated ? res.json(updated) : res.status(404).json({ error: 'not found' });
});
```

The `addNote()` function in `src/store.js` (lines 23-29) does not check `patientId`:
```javascript
export function addNote(id, note) {
  const state = load();
  const found = state.appointments.find((a) => a.id === id);
  if (!found) return null;
  found.notes = [...(found.notes ?? []), note];
  save(state);
  return found;
}
```

**Attack scenario:**
1. Patient A signs in
2. Patient A calls POST `/api/appointments/P789999-appt-001/notes` with `note: "MALICIOUS DATA"`
3. Server appends the note to Patient B's appointment record
4. Clinician reviews Patient B's appointment and sees corrupted notes

Any signed-in patient can corrupt other patients' medical records.

**Impact:**  
**Severe data integrity violation.** Patients can sabotage, alter, or falsify other patients' medical records. Medical data trustworthiness is destroyed. Liability exposure.

**Must fix before release:**
```javascript
app.post('/api/appointments/:id/notes', requirePatient, (req, res) => {
  const found = appointment(req.params.id);
  if (!found || found.patientId !== req.session.patientId) {
    return res.status(404).json({ error: 'not found' });
  }
  const updated = addNote(req.params.id, req.body.note);
  return updated ? res.json(updated) : res.status(404).json({ error: 'not found' });
});
```

---

## High-Severity Findings

### HIGH #1: Weak Default Session Secret
**Location:** `src/server.js`, line 9  
**Issue:** `secret: process.env.SESSION_SECRET ?? 'change-me'`  
If SESSION_SECRET environment variable is not set, the session secret defaults to the hardcoded string `'change-me'`. Attackers can forge valid session cookies for any patient ID.  
**Fix:** Require SESSION_SECRET to be set; fail startup if missing.

### HIGH #2: No Patient ID Validation on Sign-In
**Location:** `src/server.js`, line 18  
**Issue:** `req.session.patientId = req.body.patientId;`  
No validation of data type, format, existence, or null/undefined checks. Users can sign in as any arbitrary string.  
**Fix:** Validate patientId is a string, matches NHS reference format, and exists in the data store.

### HIGH #3: No Input Validation on Notes
**Location:** `src/server.js`, line 31; `src/store.js`, line 27  
**Issue:** Note text accepted without type, length, or encoding checks.  
**Fix:** Validate string type, non-empty, max length ~5000 chars.

### HIGH #4: No HTTPS Enforcement
**Location:** `src/server.js`, line 12  
**Issue:** `secure: true` flag set on cookies, but no code enforces HTTPS. If deployed on HTTP, cookies are sent unencrypted.  
**Fix:** Redirect HTTP to HTTPS; add HSTS headers; conditionally set secure flag only in production.

### HIGH #5: No Data Schema Validation
**Location:** `src/store.js`, lines 6-8  
**Issue:** JSON file parsed with no structure validation. Corrupted file causes crash.  
**Fix:** Validate that `data.appointments` is an array and each record has required fields.

---

## Medium-Severity Findings

### MEDIUM #1: Severely Insufficient Test Coverage
**Location:** `test/store.test.js`  
**Issue:** Only one test exists, checking that a non-existent patient has no appointments. No tests for:
- Authorization (patient A cannot see patient B's appointments)
- Adding notes
- Retrieving specific appointments
- Input validation
- Error cases
- Concurrent writes

**Impact:** Critical authorization vulnerability was not caught by the test suite.

### MEDIUM #2: Missing Error Display UI
**Location:** `public/index.html` and ux-walkthrough.md line 15  
**Issue:** ux-walkthrough.md declares "Error: a failed save keeps the typed note" but no error display element exists in HTML.

### MEDIUM #3: Missing Loading State UI
**Location:** `public/index.html` and ux-walkthrough.md line 16  
**Issue:** ux-walkthrough.md declares "Loading: the list shows a placeholder row" but no loading UI exists.

### MEDIUM #4: No Patient Existence Verification
**Location:** `src/store.js`  
**Issue:** No function to verify a patientId exists in the system. Users can sign in as invented patients.

### MEDIUM #5: No CSRF Protection
**Location:** `src/server.js`  
**Issue:** No CSRF token validation on POST endpoints. Though less critical than the authorization issues, attackers can trick users into making unintended requests.

---

## Verdict Details

### Success Criterion Assessment
**Declared Success:** "A patient can see their own appointments and notes, and cannot see anyone else's."

| Requirement | Status | Evidence |
|---|---|---|
| Patient can see their own appointments | ✓ Works | GET /api/appointments filters by patientId |
| Patient can add notes to own appointments | ✓ Works | POST /api/appointments/:id/notes appends |
| **Patient cannot see other patients' appointments** | **✗ VIOLATED** | **GET /api/appointments/:id has no ownership check** |
| **Patient cannot modify other patients' records** | **✗ VIOLATED** | **POST /api/appointments/:id/notes has no ownership check** |

**Result: FAILED.** The system directly violates its core success criterion.

### MVP Scope Assessment
Declared MVP: "Sign in, list my appointments, open one, add a note, sign out"

| Feature | Server Endpoint | Input Validation | Authorization | Client Code | Status |
|---|---|---|---|---|---|
| Sign in | ✓ | ✗ | N/A | ✗ | BLOCKED |
| List appointments | ✓ | ✓ | ✓ | ✗ | BLOCKED |
| Open appointment | ✓ | ✗ | ✗ | ✗ | **BROKEN** |
| Add note | ✓ | ✗ | ✗ | ✗ | **BROKEN** |
| Sign out | ✓ | N/A | N/A | ✗ | BLOCKED |

**Result: INCOMPLETE.** MVP scope cannot be executed; critical endpoints have security flaws.

---

## Decision: BLOCK

**Rationale:**

1. **Functional blocker:** No client-side code. Application cannot be used.

2. **Security blocker:** Authorization logic is broken. Patients can read and modify other patients' medical records. This is a GDPR/HIPAA violation.

3. **Business blocker:** The system actively violates its stated Success criterion. Shipping this puts the practice at legal and operational risk.

4. **No path to quick fix:** These are not edge cases or cosmetic issues. Core architectural changes required across server authorization, client implementation, and input validation.

**This application is not production-ready. Do not deploy until critical issues #1, #2, and #3 are fixed and re-reviewed in a separate acceptance context.**

---

## What a Passing Release Would Require

Before re-acceptance:

- [ ] Implement complete client-side application (sign-in form, appointment list, detail view, note submission)
- [ ] Add ownership checks to GET `/api/appointments/:id` endpoint
- [ ] Add ownership checks to POST `/api/appointments/:id/notes` endpoint
- [ ] Validate patientId format and existence on sign-in
- [ ] Validate note input (type, length, encoding)
- [ ] Require SESSION_SECRET environment variable; fail if missing
- [ ] Enforce HTTPS; add HSTS headers
- [ ] Validate data schema on load
- [ ] Add comprehensive test coverage (authorization, edge cases, error paths)
- [ ] Implement error and loading state UI per ux-walkthrough.md
- [ ] Add CSRF protection
- [ ] Re-review in a separate acceptance context after fixes

---

## Evidence Summary

**Gate Report:** Not run (but would likely flag missing frontend code as non-evaluated)  
**Code Audit:** 3 critical, 5 high, 5 medium severity issues  
**Runtime Walkthrough:** Cannot execute — no frontend implementation  
**Adversarial Checklist:** Not run — app is non-functional

**Confidence:** HIGH. The blocking issues are structural and code-verifiable. No ambiguity.
