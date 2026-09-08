# Release Review: Clinic Appointments App

**Date:** 5 September 2026  
**Status:** ❌ NOT READY FOR RELEASE  
**Target release:** Monday, 9 September 2026

---

## Summary

The app has a sound server architecture (Express + JSON store) and passing tests, but has **critical authorization bypasses that violate the core security requirement**, a **completely missing frontend**, and **insufficient test coverage for security-critical paths**. The system is not safe to release to patients.

---

## Critical Issues

### 1. Authorization Bypass: Individual Appointment Retrieval (BLOCKER)

**File:** `src/server.js:25–27`  
**Severity:** CRITICAL  
**Impact:** Patients can view any other patient's appointment and notes

```javascript
app.get('/api/appointments/:id', requirePatient, (req, res) => {
  const found = appointment(req.params.id);
  return found ? res.json(found) : res.status(404).json({ error: 'not found' });
});
```

The endpoint checks that the user is signed in (`requirePatient`), but **does not verify the appointment belongs to the signed-in patient**. A patient can retrieve any appointment by ID (e.g., `/api/appointments/appt-123` even if that appointment belongs to another patient). This is a direct violation of the product requirement: *"A patient can see their own appointments and notes, and cannot see anyone else's."*

**Test case:** Sign in as patient A, then `GET /api/appointments/[id-of-patient-B-appointment]` → returns patient B's full appointment data.

---

### 2. Authorization Bypass: Adding Notes (BLOCKER)

**File:** `src/server.js:30–32`  
**Severity:** CRITICAL  
**Impact:** Patients can inject notes into any other patient's medical record

```javascript
app.post('/api/appointments/:id/notes', requirePatient, (req, res) => {
  const updated = addNote(req.params.id, req.body.note);
  return updated ? res.json(updated) : res.status(404).json({ error: 'not found' });
});
```

Same issue: the endpoint requires authentication but **does not authorize the note addition to the patient's own appointment**. Any signed-in patient can add notes to any appointment record, corrupting other patients' medical histories.

**Test case:** Sign in as patient A, then `POST /api/appointments/[id-of-patient-B-appointment]/notes` with a note → patient B's record is modified.

---

### 3. Frontend Not Implemented (BLOCKER)

**File:** `public/index.html`  
**Severity:** CRITICAL  
**Impact:** App is completely non-functional for patients

The HTML is an empty shell:
```html
<!doctype html><title>Clinic appointments</title><main id="app"></main>
```

There is **no JavaScript frontend**. None of the UX flows described in `ux-walkthrough.md` are implemented:
- No sign-in form
- No appointment list view
- No appointment detail view
- No note-adding interface
- No sign-out flow

The app cannot be used by patients at all. This is the MVP scope, so no frontend = no product.

---

## High-Priority Issues

### 4. Missing Authorization Tests

**File:** `test/store.test.js`  
**Severity:** HIGH  
**Impact:** Authorization bypasses were not caught by test suite

The only test verifies that `appointmentsFor()` filters by patient:
```javascript
test('the list is filtered to the signed-in patient', () => {
  assert.deepEqual(appointmentsFor('nobody'), []);
});
```

**Missing tests:**
- User cannot retrieve another patient's appointment via the API
- User cannot add notes to another patient's appointment via the API
- Invalid patient IDs are rejected at sign-in

These are the critical security paths and should be explicitly tested.

---

### 5. No Input Validation on Sign-In

**File:** `src/server.js:18`  
**Severity:** MEDIUM-HIGH  
**Impact:** Any string is accepted as a valid patient ID; no connection to actual patient data

```javascript
app.post('/api/sign-in', (req, res) => {
  req.session.patientId = req.body.patientId;
  res.json({ ok: true });
});
```

There is **no validation** that the provided `patientId` exists in the patient database or matches expected format. A patient could sign in as any arbitrary ID (e.g., `admin`, `patient-999`, `hacker`). The store does not distinguish between valid and invalid patient IDs.

**Missing:** Either a patient lookup in the store, or at minimum a format validation.

---

### 6. Weak Default Session Secret

**File:** `src/server.js:9`  
**Severity:** MEDIUM  
**Impact:** Session hijacking if SESSION_SECRET env var is not set in production

```javascript
session({
  secret: process.env.SESSION_SECRET ?? 'change-me',
  ...
})
```

The default is the literal string `'change-me'`, which is a predictable, obviously weak secret. If deployed without explicitly setting `SESSION_SECRET`, sessions can be forged. The comment suggests this is a placeholder, but leaving it as a default is unsafe.

**Recommendation:** Remove the default, or fail loudly if the secret is not configured.

---

### 7. No Validation of Note Content

**File:** `src/server.js:30–32`  
**Severity:** LOW-MEDIUM  
**Impact:** Medical records can be corrupted with invalid data

The `/notes` endpoint accepts any value as a note without validation:
- No length limit
- No empty-string check
- No content-type enforcement

Medical notes should be validated (e.g., non-empty, reasonable length, type string).

---

## Moderate Issues

### 8. Session Security Configuration

**File:** `src/server.js:12`  
**Severity:** LOW (affects testing, not production)

```javascript
cookie: { httpOnly: true, sameSite: 'lax', secure: true }
```

The `secure: true` flag enforces HTTPS. This is correct for production but will break testing on `localhost` without HTTPS. Development will require either disabling this or using HTTPS tunneling.

---

## Verification Summary

**What I verified:**
- ✅ Tests run and pass (1/1)
- ✅ Dependencies are minimal and appropriate (Express, express-session)
- ✅ Server code exports a testable app factory
- ✅ Store logic correctly filters appointments by patient (the one path that is secure)
- ✅ Design and architecture documents are clear
- ❌ Authorization is not enforced on individual appointment access
- ❌ No frontend exists
- ❌ Authorization is not tested
- ❌ Session configuration not production-safe

---

## Release Verdict

**DO NOT RELEASE to patients on Monday.**

The app has **two critical authorization bypasses** that would allow patients to access and modify other patients' medical records. These are security violations that make the system unsafe for any real patient data. Additionally, the **frontend is completely missing**, making the app non-functional for its intended users.

**Blockers:**
1. Implement authorization checks on `/api/appointments/:id` (verify patient owns appointment)
2. Implement authorization checks on `/api/appointments/:id/notes` (verify patient owns appointment)
3. Implement frontend sign-in, list, detail, and note-adding flows per `ux-walkthrough.md`
4. Add test coverage for authorization on those two endpoints
5. Add input validation for patient ID at sign-in
6. Make session secret required (fail if not set)

**Estimated effort:** 2–3 days (authorization fixes 2–3 hours + front-end implementation 1–2 days + testing 2–4 hours).

After fixes, the app must be re-tested for:
- Authorization on all guarded endpoints
- Full UX flow end-to-end
- Edge cases (non-existent appointment IDs, empty notes, invalid patient IDs)

---

## What I Did Not Review

Per instructions, I did not:
- Inspect evaluation cases, graders, or expected answers
- Search for sibling run outputs
- Run the server or manual tests (only static code review + test suite)

