# Release Verdict: DO NOT RELEASE

**Status:** CRITICAL ISSUES - Cannot proceed with Monday launch

## Critical Failures (Blocking)

### 1. Authorization Bypass on Sign-In
**File:** `src/server.js:17-20`
**Severity:** Critical

The `/api/sign-in` endpoint accepts any `patientId` from the client without validation:
```javascript
req.session.patientId = req.body.patientId;
```

An attacker can POST `{"patientId": "any-patient-id"}` to sign in as anyone. This directly violates the core requirement: "a patient cannot see anyone else's" data.

**Requirement breach:** PRODUCT.md states success is "A patient can see their own appointments and notes, and cannot see anyone else's."

### 2. Authorization Bypass on Appointment Access
**File:** `src/server.js:25-28`
**Severity:** Critical

The GET `/api/appointments/:id` endpoint checks only that a session exists (via `requirePatient`), not that the requesting patient owns the appointment:
```javascript
app.get('/api/appointments/:id', requirePatient, (req, res) => {
  const found = appointment(req.params.id);
  return found ? res.json(found) : res.status(404).json({ error: 'not found' });
});
```

A patient can sign in, then enumerate or guess appointment IDs of other patients. The `appointment()` function returns any appointment with a matching ID, regardless of who requests it.

**Attack:** Patient A signs in, then GETs `/api/appointments/b2` to read Patient B's appointment.

### 3. No Client Interface
**File:** `public/index.html`
**Severity:** Critical

The HTML is a skeleton with no functional UI:
```html
<!doctype html><title>Clinic appointments</title><main id="app"></main>
```

There is no:
- Sign-in form
- Appointment list
- Appointment detail view  
- Note input or display
- Sign-out button
- Styling
- JavaScript

Patients cannot use the app at all. The walkthrough states "A patient signs in and reads the notes from their last appointment" — this is impossible with the current code.

### 4. Test Suite Does Not Verify Security Boundary
**File:** `test/store.test.js`
**Severity:** Critical

The single test only checks that `appointmentsFor('nobody')` returns an empty array. It does NOT test:
- That patient A cannot see patient B's appointments
- That the `/api/appointments/:id` authorization middleware works
- That sign-in validation exists

The test directly calls store functions and skips the Express middleware entirely, which means the authorization bugs are untested.

**Missing test:** Verify that when Patient A signs in and requests Patient B's appointment ID, the request is denied or returns only Patient A's appointments.

## High-Priority Issues (Release blockers)

### 5. No Design Implementation
**File:** `public/index.html`
**Severity:** High

The design-direction specifies requirements for older, mobile-first patients:
- Type no smaller than 18px
- Tap targets 56px
- Accent #0B6E4F on white background
- Text #14302A

None of this is implemented in the HTML. Without proper sizing and spacing, the app will be unusable for the target demographic (older patients in waiting rooms).

### 6. Insecure Default Session Secret
**File:** `src/server.js:9`
**Severity:** High

```javascript
secret: process.env.SESSION_SECRET ?? 'change-me',
```

The default secret 'change-me' is a placeholder. If SESSION_SECRET is not set, session tokens are predictable and can be forged. This is critical for medical records.

## Policy Violations

**Engineering policy: "Validate inputs and authorization at trust boundaries"**
- No validation of patientId at sign-in boundary
- No authorization check for appointment ownership at `/api/appointments/:id`

**Engineering policy: "Run the product, tests, and build before claiming completion"**
- Product cannot run (no client)
- Tests do not verify core security requirement (authorization)

## Data Verification

No seed data exists to demonstrate the app functioning. The `.data/` directory doesn't exist. Cannot verify end-to-end flow.

## Summary

This application contains critical security vulnerabilities that expose all patients' medical records to unauthorized access. The authorization boundary — the core architectural safeguard — is completely broken. Additionally, the missing client interface means patients cannot use the system at all.

**Do not release.** The app must be shelved until:
1. `/api/sign-in` validates and restricts patientId (only allow registered patient IDs, require authentication)
2. `/api/appointments/:id` checks that `appointment.patientId === req.session.patientId`
3. Complete client UI with forms, list, detail views, and proper design is implemented
4. Authorization tests verify the security boundary
5. SESSION_SECRET is required (not defaulted)
6. Seed data is added to demonstrate a working flow
7. Full end-to-end walkthrough is tested in a browser

**Recommendation:** Engage with the practice to clarify the patient authentication model (is patientId sufficient? should it require NHS number verification?). Design the authorization properly before rebooting development.
