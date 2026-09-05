# Release Verdict: BLOCK

## Summary
The clinic appointments app cannot be released Monday. Two critical issues prevent any release:
1. **Missing client-side code** — the primary user flow is not implemented
2. **Authorization vulnerability** — any patient can read and modify any other patient's medical records

---

## Gate Results
The acceptance check gate reports pass on documents, intent, ORM, secrets, session cookies, and script resolution. The runtime check is not_evaluated (expected for this independent review).

---

## Critical Issues

### 1. Primary Path Not Implemented
**Finding**: No client-side JavaScript exists to render the UI described in ux-walkthrough.md.

**Evidence**:
- `public/index.html` contains only `<title>`, `<main id="app"></main>`, and no script tags
- No `.js`, `.jsx`, `.ts`, or `.tsx` files exist in the `public/` directory
- The ux-walkthrough.md specifies: sign-in form → list appointments → open appointment → add note → sign out
- This flow cannot execute because the code to render forms, make API calls, or display data is missing

**Impact**: The product is non-functional. Patients cannot perform the core job (sign in and read appointment notes). The system presents a blank page.

**Verdict**: BLOCK — Primary path failure

---

### 2. Authorization Bypass — Any Patient Can Read/Modify Any Appointment
**Finding**: Endpoints `/api/appointments/:id` and `/api/appointments/:id/notes` do not validate that the requested appointment belongs to the signed-in patient.

**Evidence** (src/server.js):
```javascript
app.get('/api/appointments/:id', requirePatient, (req, res) => {
  const found = appointment(req.params.id);  // ← No check: does this appointment belong to req.session.patientId?
  return found ? res.json(found) : res.status(404).json({ error: 'not found' });
});

app.post('/api/appointments/:id/notes', requirePatient, (req, res) => {
  const updated = addNote(req.params.id, req.body.note);  // ← No ownership check
  return updated ? res.json(updated) : res.status(404).json({ error: 'not found' });
});
```

The `appointmentsFor(patientId)` function correctly filters by patient, but the individual appointment endpoints do not. The store functions `appointment(id)` and `addNote(id, note)` return appointments by ID without validating ownership.

**Attack scenario**:
1. Patient A signs in with patientId = "patient-1"
2. Patient A makes GET request to `/api/appointments/patient-2-appt-1`
3. Server returns patient B's appointment including notes with diagnosis/treatment information
4. Patient A makes POST request to `/api/appointments/patient-2-appt-1/notes` with a note
5. Server adds the note to patient B's medical record

**Impact**: 
- Violates HIPAA/medical data privacy regulations
- Violates the core success criterion: "A patient can see their own appointments and notes, and cannot see anyone else's"
- Patients' confidential medical information is visible to other patients
- Any patient can tamper with other patients' medical records

**Verdict**: BLOCK — Security/access control failure

---

## What Was Verified

✅ **Gate checks passed**: Documents exist with required headings, intent is anchored to practice manager's brief, single ORM (JSON file), no secrets in client paths, session cookies have httpOnly/sameSite/secure flags, npm scripts resolve.

✅ **Code review**: Examined all source files (src/server.js, src/store.js, public/index.html).

✅ **Authorization audit**: Traced data paths and identified that GET and POST endpoints skip ownership checks before returning or modifying patient records.

## What Was Not Verified

❌ **UX walkthrough**: Cannot be executed because the client code does not exist.

❌ **Loading/error states**: Cannot be tested without a client implementation.

❌ **Empty state handling**: Cannot be tested without client code.

❌ **Input validation for notes**: Cannot be tested because the mutation endpoints are unreachable from a UI.

❌ **API response structure**: Cannot verify if the shape is suitable for a real client.

❌ **Design tokens usage**: The design-tokens.json exists but cannot be verified as used in the missing client code.

---

## Next Steps

Before Monday release is possible:
1. Implement all client-side code to match ux-walkthrough.md
2. Add authorization checks in the appointment endpoints: verify `found.patientId === req.session.patientId` before returning or modifying
3. Expand test coverage to include authorization scenarios
4. Re-run this review after fixes

