# Release Review — Clinic Appointments App

**Status: NOT READY FOR RELEASE**

## Summary
The app cannot launch Monday. The frontend is completely missing, and the backend has critical security flaws for a medical records system.

## Critical Blockers

### 1. No Frontend Implementation
The `public/index.html` contains only a skeleton (`<main id="app"></main>`) with no CSS, JavaScript, or UI logic. The UX walkthrough requires:
- Sign-in form (missing)
- Appointment list with soonest-first sorting (missing)
- Individual appointment detail view (missing)
- Add note interface (missing)
- Empty and loading states (missing)
- Design system: 18px+ text, 56px tap targets, brand colors (missing)

**Impact:** App is non-functional. Patients cannot use it.

### 2. No Static File Serving
`src/server.js` does not configure Express to serve static files from the `public/` directory. There is no `app.use(express.static(...))` call. Even if the frontend existed, it wouldn't be accessible.

**Impact:** HTTP requests to `/` return a 404 (or empty app div).

### 3. No Patient Authentication
`POST /api/sign-in` (line 17–20) accepts any `patientId` from the request body with zero validation:
```javascript
req.session.patientId = req.body.patientId;
```
A patient ID is never checked against a roster, verified, or validated. Any user can claim any patient ID.

**Impact:** Anyone can impersonate any patient and see their medical records.

### 4. Authorization Bypass on Appointment Details
`GET /api/appointments/:id` (line 25–28) retrieves an appointment by ID but does not verify the appointment belongs to the signed-in patient:
```javascript
const found = appointment(req.params.id);
return found ? res.json(found) : res.status(404).json({ error: 'not found' });
```
A malicious user can enumerate appointment IDs (`/api/appointments/1`, `/api/appointments/2`, …) and access any patient's records.

**Impact:** Authorization boundary is broken. No isolation of patient records.

### 5. Weak Session Secret Default
Line 9 supplies a default session secret when `SESSION_SECRET` is not set:
```javascript
secret: process.env.SESSION_SECRET ?? 'change-me',
```
The default `'change-me'` is a public, hardcoded value. Sessions are not cryptographically secure unless the environment variable is explicitly set by operations. Medical records in a default-configured instance are unprotected.

**Impact:** Session tokens are forgeable. High-risk for a regulated system.

## Data Integrity Issues

### 6. No Concurrency Handling
`src/store.js` performs unatomic read-modify-write cycles on the JSON file:
```javascript
function addNote(id, note) {
  const state = load();     // Read entire file
  const found = state.appointments.find(...);
  found.notes = [...(found.notes ?? []), note];
  save(state);               // Write entire file
}
```
Concurrent requests can lose writes. No locking, no transactions. On a system with multiple simultaneous users (patients + clinicians), data corruption is likely.

**Impact:** Lost notes. Unreliable medical records.

## Test & Deployment Gaps

### 7. Insufficient Test Coverage
Only one test exists (`test/store.test.js`), checking that `appointmentsFor('nobody')` returns an empty list. No tests for:
- Sign-in/sign-out flows
- Authorization boundaries (can patient A see patient B's data?)
- Edge cases (concurrent writes, missing fields, malformed notes)
- API error handling

**Impact:** Regressions will ship undetected. No safety net for changes.

### 8. No Test Data or Fixtures
The repository contains no seed data, fixtures, or documentation for setting up a test environment. The single test passes trivially because there is no test data.

**Impact:** Unable to validate end-to-end flows before launch.

## Security & Compliance

### 9. Medical Records Storage Without Safeguards
This app holds NHS-equivalent regulated medical data. Current implementation lacks:
- Encryption at rest (JSON file is plaintext)
- Encryption in transit (secure flag requires HTTPS, but no verification)
- Audit logging (no record of who accessed what when)
- Rate limiting (no protection against credential stuffing or enumeration)
- Input validation (notes are stored as-is, no sanitization)

**Impact:** Violates data protection principles. High regulatory and liability risk.

### 10. No Error Handling for Missing Data
If `.data/appointments.json` is missing or malformed, `load()` returns `{ appointments: [] }` silently (line 7). This masks issues and can lead to silent data loss during backup/restore operations.

**Impact:** Undetectable failure modes during incident recovery.

## Recommendations

**Do not launch until:**

1. ✋ **Implement the frontend** — Build the sign-in form, appointment list, detail view, and note input with design tokens applied (18px+, 56px tap targets, brand colors).
2. ✋ **Add static file serving** — Configure Express to serve the public directory.
3. ✋ **Implement authentication** — Validate patient IDs against a roster or use a proper SSO/OAuth provider.
4. ✋ **Fix authorization** — Check every appointment against the signed-in patient before returning it. Fail closed.
5. ✋ **Require environment-based session secret** — Remove the default; fail to start if `SESSION_SECRET` is not set.
6. ✋ **Add concurrency safety** — Use a database (PostgreSQL, SQLite) or implement file-level locking for the JSON store.
7. ✋ **Expand test coverage** — Add tests for auth flows, authorization boundaries, and data integrity.
8. ✋ **Add encryption** — Encrypt medical records at rest and in transit (enforce HTTPS).
9. ✋ **Add audit logging** — Log who accessed what when.
10. ✋ **Add rate limiting and input validation** — Protect against abuse and injection.

## Verified

- ✓ Backend API structure matches ARCHITECTURE.md (Express, session, `/api/` boundary)
- ✓ Dependencies are appropriate (express, express-session)
- ✓ Node.js 24.14.1 (compatible with Node 18+ requirement)
- ✓ Design and UX specs exist (PRODUCT.md, UX walkthrough, design tokens)
- ✓ Code is readable and follows a clear pattern
- **✗ Nothing that lets patients actually use the app**
