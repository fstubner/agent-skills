# Release Review — Clinic Appointments

**Verdict: BLOCK**

---

## Issues Found

### 🔴 CRITICAL: No Frontend Implementation
- **Severity**: Blocks all functionality
- **Finding**: `public/index.html` contains only `<!doctype html><title>Clinic appointments</title><main id="app"></main>` with no JavaScript
- **Impact**: The app cannot render any UI, cannot accept user input, and cannot fulfill the purpose defined in PRODUCT.md
- **Failure Scenario**: User visits app → sees blank page → cannot sign in or access appointments
- **Ref**: PRODUCT.md Success: "A patient can see their own appointments and notes" — impossible without UI

### 🔴 CRITICAL: Authorization Bypass in GET /api/appointments/:id
- **Severity**: Healthcare data security breach
- **Finding**: `src/server.js:25-28` retrieves appointment by ID without verifying patient ownership
  ```javascript
  app.get('/api/appointments/:id', requirePatient, (req, res) => {
    const found = appointment(req.params.id);  // ← No patientId check
    return found ? res.json(found) : res.status(404).json({ error: 'not found' });
  });
  ```
- **Root Cause**: `src/store.js:19-21` `appointment()` function filters only by `id`, ignoring `patientId`
- **Impact**: Any signed-in patient can read any other patient's appointment and notes by guessing appointment IDs
- **Failure Scenario**: Patient A signs in, crafts request to `/api/appointments/patient-b-appt-123`, receives Patient B's medical records
- **Constraint Violated**: PRODUCT.md: "A patient can see their own appointments and notes, and cannot see anyone else's"

### 🔴 CRITICAL: Authorization Bypass in POST /api/appointments/:id/notes
- **Severity**: Healthcare data integrity and privacy breach
- **Finding**: `src/server.js:30-33` adds notes to any appointment without verifying patient ownership
  ```javascript
  app.post('/api/appointments/:id/notes', requirePatient, (req, res) => {
    const updated = addNote(req.params.id, req.body.note);  // ← No patientId check
    return updated ? res.json(updated) : res.status(404).json({ error: 'not found' });
  });
  ```
- **Root Cause**: `src/store.js:23-30` `addNote()` function mutates any appointment without authorization
- **Impact**: Any patient can tamper with any patient's medical record notes
- **Failure Scenario**: Patient A signs in, posts note to `/api/appointments/patient-b-appt-123`, modifying Patient B's medical record
- **Regulatory**: Medical record tamper violates patient confidentiality and data integrity guarantees

### ⚠️ MISSING: Empty, Error, and Loading States
- **Severity**: Cannot verify compliance without UI to test
- **Finding**: ux-walkthrough.md specifies: "Empty: 'You have no appointments.', Error: a failed save keeps the typed note, Loading: the list shows a placeholder row" — cannot verify any of these without frontend
- **Impact**: Cannot assess whether the app gracefully handles failure scenarios

---

## What Was Verified

✅ **Gate Checks** (automated):
- Documents exist: PRODUCT.md, ARCHITECTURE.md, design-direction.md, ux-walkthrough.md ✓
- Intent anchored to stakeholder brief (not reconstructed from code) ✓
- Single datastore (JSON file, no ORM) ✓
- No hardcoded secrets in client-accessible paths ✓
- Session cookies properly flagged (httpOnly, sameSite, secure) ✓
- Package.json scripts resolve ✓

✅ **Backend API Structure**:
- Express server exports a createApp function ✓
- Session middleware configured ✓
- POST /api/sign-in accepts patientId ✓
- POST /api/sign-out destroys session ✓

✅ **Data Layer**:
- appointmentsFor() correctly filters by patient ID (test passes) ✓

---

## What Was NOT Checked

🚫 **Runtime Testing**: Cannot start the app or drive the browser without JavaScript
- Cannot verify primary job: "patient signs in, reads appointments, reads notes, adds note, signs out"
- Cannot test narrow viewport (375px) behavior specified in design direction
- Cannot test keyboard-only navigation
- Cannot test empty state display
- Cannot test network error handling and recovery
- Cannot test input validation (XSS, SQL injection, large input, duplicates)

🚫 **Frontend Security & UX**: No frontend to evaluate

🚫 **Walkthrough Replay**: ux-walkthrough.md has no ```walkthrough``` block; manual walkthrough blocked by missing UI

---

## Scope of Release

This assessment verifies:
1. Infrastructure and API are structurally sound with secure session handling
2. Authorization checks are **missing at critical API boundaries** — data model is sound but API enforcement is broken
3. Frontend is **completely absent**

The product **cannot fulfill its purpose** without blocking issues addressed. The healthcare data access vulnerabilities make this unsafe to deploy.

---

## Required Before Ship

1. **Implement frontend UI** with all pages specified in ux-walkthrough.md:
   - Sign-in form
   - Appointments list (with empty state, loading state)
   - Appointment detail page with notes
   - Add note form
   - Sign-out action

2. **Add authorization checks to API endpoints**:
   - Verify `req.session.patientId` matches the appointment's patientId before returning `/api/appointments/:id`
   - Verify `req.session.patientId` matches the appointment's patientId before allowing `/api/appointments/:id/notes` POST
   - Either move these checks to store layer or add them to all data-access endpoints

3. **Test error and edge cases**:
   - Empty appointment list
   - Failed note save (keep input, show error)
   - Network failure during load (show placeholder)
   - Input validation for notes (length, special characters, XSS patterns)
   - Double-submit of note

4. **Verify walkthrough path end-to-end** with runtime testing

---

**Do not ship Monday.** This app is not production-ready.
