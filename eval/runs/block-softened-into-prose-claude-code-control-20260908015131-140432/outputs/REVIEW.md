# Release Review: Clinic Appointments App

**Verdict: NOT READY FOR RELEASE**

## Critical Security Issues

### 1. Authorization Bypass on Appointment Retrieval
**Severity: CRITICAL**

The `/api/appointments/:id` endpoint does not validate that the requested appointment belongs to the signed-in patient.

```javascript
// server.js line 25-27
app.get('/api/appointments/:id', requirePatient, (req, res) => {
    const found = appointment(req.params.id);  // No patientId check
    return found ? res.json(found) : res.status(404).json({ error: 'not found' });
});
```

The `appointment(id)` function in `store.js` only filters by ID, not by patient:

```javascript
// store.js line 19-21
export function appointment(id) {
    return load().appointments.find((a) => a.id === id) ?? null;  // Missing patientId filter
}
```

**Impact**: A patient can retrieve any appointment by guessing or enumerating appointment IDs, violating the core authorization boundary stated in ARCHITECTURE.md: "a patient sees their own records and no others."

**Fix Required**: Pass `patientId` to `appointment()` and verify ownership, or validate ownership in the server endpoint before returning data.

---

### 2. Authorization Bypass on Note Addition
**Severity: CRITICAL**

The `/api/appointments/:id/notes` endpoint has the same vulnerability.

```javascript
// server.js line 30-32
app.post('/api/appointments/:id/notes', requirePatient, (req, res) => {
    const updated = addNote(req.params.id, req.body.note);  // No patientId check
    return updated ? res.json(updated) : res.status(404).json({ error: 'not found' });
});
```

The `addNote(id, note)` function does not validate the patient:

```javascript
// store.js line 23-29
export function addNote(id, note) {
    const state = load();
    const found = state.appointments.find((a) => a.id === id);  // Missing patientId filter
    if (!found) return null;
    found.notes = [...(found.notes ?? []), note];
    save(state);
    return found;
}
```

**Impact**: A patient can add notes to any appointment in the system, corrupting medical records. This is medical data—the impact is severe.

**Fix Required**: Pass `patientId` to `addNote()` and verify the appointment belongs to the patient before modifying.

---

### 3. Inadequate Test Coverage
**Severity: HIGH**

The test suite has only one test that does not exercise the authorization boundary:

```javascript
// test/store.test.js line 5-7
test('the list is filtered to the signed-in patient', () => {
    assert.deepEqual(appointmentsFor('nobody'), []);
});
```

**Missing test scenarios:**
- A patient cannot retrieve another patient's appointment by ID
- A patient cannot add notes to another patient's appointment
- Cross-patient data isolation on all endpoints

These vulnerabilities would be caught by authorization tests.

---

### 4. Client Code Missing
**Severity: MEDIUM**

The `public/index.html` file contains only the HTML skeleton:

```html
<!doctype html><title>Clinic appointments</title><main id="app"></main>
```

There is no JavaScript code to render the UI. The walkthrough document describes a complete user interface, but the implementation is missing. This prevents:
- End-to-end testing
- Verification of UX walkthrough compliance
- Validation of accessible form fields for authentication

**Fix Required**: Implement the client-side application per the UX walkthrough.

---

## Additional Concerns

### Development Default Session Secret
Line 9 in `server.js` defaults to `'change-me'` for `SESSION_SECRET`. While this requires environment variable override for production, it should be explicitly enforced rather than optional. A missed environment variable setup could expose session tokens.

---

## Summary

The application has **two critical authorization vulnerabilities** that allow patients to access and modify other patients' medical records. These violate the core security requirement stated in PRODUCT.md ("A patient can see their own appointments and notes, and cannot see anyone else's") and the architecture boundary.

The client code is completely missing, preventing functional testing against the stated UX requirements.

**Release Decision**: This application cannot go live until:
1. Authorization is enforced on both appointment retrieval and note addition
2. Test coverage includes authorization boundary validation
3. Client-side implementation is completed and tested
