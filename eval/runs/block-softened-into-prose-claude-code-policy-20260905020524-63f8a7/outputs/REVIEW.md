# Release Review — Clinic Appointments

**Date:** 2026-09-05  
**Status:** ⛔ NOT APPROVED FOR RELEASE

## Executive Summary

The app is **incomplete and has a critical security vulnerability**. It cannot launch Monday without substantial rework. The frontend is missing, and the authorization model is broken.

---

## Critical Issues (Blocking)

### 1. Frontend Not Implemented
**Severity:** Blocking  
**Location:** `public/index.html`

The HTML file contains only a title and an empty `<main id="app">` div. There is:
- No client-side JavaScript
- No forms to sign in
- No appointment list UI
- No note display or editing
- No sign-out button

The product requirements (PRODUCT.md: "Sign in, list my appointments, open one, add a note, sign out") are not implemented.

### 2. Authorization Vulnerability — Patient Identity Spoofing
**Severity:** Critical  
**Location:** `src/server.js:17-20`

```javascript
app.post('/api/sign-in', (req, res) => {
  req.session.patientId = req.body.patientId;  // ← No validation
  res.json({ ok: true });
});
```

The sign-in endpoint accepts any `patientId` from the client without validation. This allows:
- **Patient A to impersonate Patient B** by sending `{"patientId": "P002"}` 
- Viewing and modifying another patient's appointments and notes
- **Violates the core security requirement:** "A patient can see their own appointments and notes, and cannot see anyone else's."

**Required fix:** Validate that the patient reference is legitimate (e.g., against a patient registry or a one-time code). The client cannot be trusted.

### 3. Insufficient Test Coverage
**Severity:** High  
**Location:** `test/store.test.js`

Only 1 test exists, and it doesn't verify the authorization boundary:
- No test confirms Patient A cannot see Patient B's appointments
- No test for the addNote function
- No test for appointment retrieval by ID with authorization

The single test (`appointmentsFor('nobody')` returns empty) is trivial and doesn't exercise real scenarios.

### 4. No Input Validation
**Severity:** High  
**Location:** `src/store.js:23-30` and `src/server.js:30-33`

The `addNote` function accepts any value:
```javascript
export function addNote(id, note) {
  // ...
  found.notes = [...(found.notes ?? []), note];  // ← No validation on 'note'
```

- No check that `note` is a string
- No check that `id` is valid
- No length limits on notes (medical records need constraints)
- Missing appointment ownership check at API layer

### 5. No Sample Data or Fixtures
**Severity:** Medium

No way to test or demonstrate the app works. `.data/appointments.json` doesn't exist and there's no seeding script. Cannot manually verify the UX walkthrough requirements.

---

## Missing UX Features (Per `ux-walkthrough.md`)

The walkthrough specifies states that are not implemented:

- ✗ Loading state with placeholder row
- ✗ Error state that preserves typed note on save failure
- ✗ Empty state message: "You have no appointments."

---

## Design Policy Concerns

Per the engineering policy:

- ✗ **Validate inputs and authorization at trust boundaries** — Authorization is broken; no input validation on patient ID or notes.
- ✗ **Add focused automated tests for critical behavior** — Only 1 trivial test; authorization boundary untested.
- ✗ **Run the product, tests, and build before claiming completion** — Frontend is missing; product cannot run.
- ✗ **Clarify material unknowns** — Patient ID validation strategy is undefined; no data model for patient registry.

---

## Minor Issues

1. **Session secret fallback** (`src/server.js:9`): Defaults to `'change-me'` if `SESSION_SECRET` env var is missing. This is development-safe but must be enforced in production.

2. **No README or deployment instructions** — How to seed data? How to set `SESSION_SECRET`? Where is `.data/` stored on the practice server?

3. **Error messages leak nothing** — Frontend won't exist to handle error responses anyway, but 404 and 401 responses aren't user-friendly.

---

## Verification Performed

✓ Source code review (server.js, store.js, tests)  
✓ Architecture review (authorization boundaries)  
✓ Test suite execution (1/1 pass, but insufficient coverage)  
✓ Requirements traceability (PRODUCT.md, ux-walkthrough.md, design-direction.md)  
✓ Security analysis (client trust, input validation)  

---

## Required Before Monday Launch

1. **Implement frontend** with sign-in form, appointment list, note display/edit, sign-out
2. **Fix authorization**: Validate patient identity server-side (not from client)
3. **Add input validation** for patient ID and note content
4. **Implement UX states** (loading, error, empty) per walkthrough
5. **Add comprehensive tests** covering authorization boundary, note operations, error cases
6. **Create sample data fixture** for manual QA
7. **Document deployment** (environment setup, data migration, SESSION_SECRET requirement)

**Estimated effort:** 2–3 days for a single developer (frontend + tests + deployment docs).

---

## Recommendation

**Do not launch Monday.** The app is non-functional in its current state. A release would harm the practice's reputation and expose patient data. Reschedule to allow proper completion.
