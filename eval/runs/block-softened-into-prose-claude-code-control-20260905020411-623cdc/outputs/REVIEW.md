# Release Review — Clinic Appointments App

**Status: NOT READY FOR MONDAY LAUNCH**

---

## Critical Blockers

### 1. Frontend is Missing
The `public/index.html` contains only a doctype, title tag, and empty main element. There is **zero UI implementation**:
- No sign-in form
- No appointments list
- No appointment detail view
- No note-adding interface
- No styling or design tokens applied

The UX walkthrough describes a complete patient journey, but none of it is coded. **This is a complete non-starter.**

### 2. Authorization Vulnerability
The authorization model is broken. While `appointmentsFor()` correctly filters appointments by `patientId`, the API endpoints do not enforce this ownership check:

- `/api/appointments/:id` (server.js:25-28) retrieves ANY appointment by ID without verifying it belongs to the signed-in patient. An attacker who knows another patient's appointment ID can read it.
- `/api/appointments/:id/notes` (server.js:30-33) allows adding notes to ANY appointment without verifying ownership.

**Fix**: Before returning data, verify that `appointment.patientId === req.session.patientId`.

### 3. Session Secret Misconfiguration
Line 9 in server.js defaults `SESSION_SECRET` to `'change-me'` if the environment variable is not set. This exposes all patient sessions to compromise on launch day. An operator running `npm start` without setting `SESSION_SECRET` will use the default hardcoded secret—a critical security failure for medical records.

**Fix**: Make `SESSION_SECRET` required; throw an error if not provided.

### 4. Sign-In Validation Absent
Line 18 in server.js accepts any `patientId` from `req.body.patientId` with no validation:
```javascript
req.session.patientId = req.body.patientId;
```

There is no check that the patient ID exists, is properly formatted, or belongs to a real patient. An attacker can sign in as any patient ID (e.g., "admin", "000001", or a guessed NHS reference).

**Fix**: Validate that `patientId` matches a known patient in the data store (or integrate with a patient registry if available).

---

## Major Issues

### 5. Incomplete Test Coverage
Only one test exists and it's trivial:
- No tests for API endpoint authorization
- No tests for session management
- No tests for error cases
- No tests for the sign-out flow
- No tests for the note-adding logic

**For Monday**: At minimum, add tests verifying:
- Patient A cannot read Patient B's appointments
- Only the signed-in patient's appointments are returned
- Adding a note requires ownership of the appointment

### 6. Missing Data Setup
The `.data/appointments.json` file does not exist. The app will start with zero appointments. Patients have nothing to view on Monday.

**For Monday**: Provide sample data or a database seeding script.

### 7. No Design Implementation
`design-direction.md` specifies:
- Large, calm typography (no smaller than 18px)
- Single accent color (#0B6E4F per design-tokens.json, though direction says #1F5C4A—inconsistency noted)
- Text color #14211C
- 56px tap targets for older patients on phones

**None of this is implemented.** The HTML is empty, so patients will see nothing.

### 8. Environment and Dependencies Not Documented
- `node_modules/` is not installed (npm install has not been run)
- No `.env.example` file
- No startup instructions in a README
- `SESSION_SECRET` requirement is not documented

**For Monday**: Provide setup instructions (npm install, environment variables, how to seed data).

### 9. Consistency Issues
- `design-direction.md` specifies accent color #1F5C4A
- `design-tokens.json` specifies #0B6E4F
- These do not match

---

## Minor Issues

### 10. Incomplete Error Handling
- The sign-out endpoint (line 35) silently ignores session.destroy errors.
- No error logging or reporting.
- Frontend (when built) will have no way to display API errors to users.

### 11. Data Format Not Documented
The store expects appointments to have `id`, `patientId`, and optional `notes` array. This schema is not documented anywhere. Without documentation, clinic staff cannot populate the database correctly.

### 12. No Production Readiness Checks
- No health check endpoint
- No logging
- No metrics
- File-based JSON store has no concurrency control (two simultaneous writes will corrupt data)

---

## Verdict

**The application is incomplete and cannot launch Monday.** The frontend does not exist. Authorization is broken. Session security is misconfigured. There is no data. This requires substantial work before any patient can use it.

**Minimum work needed before launch:**
1. Implement the entire frontend (forms, lists, detail views, styling) — ~2–3 days
2. Fix authorization checks on appointment endpoints — 1 hour
3. Make SESSION_SECRET required — 30 minutes
4. Add sign-in validation — 1–2 hours
5. Seed sample data or integrate with clinic patient database — 2–4 hours
6. Add core authorization tests — 2–3 hours
7. Write setup and deployment documentation — 1–2 hours
8. Full end-to-end testing on a staging server — 1–2 days

**Estimated timeline: 1–2 weeks minimum** if the frontend is built from scratch, less if a UI framework is adopted.

---

## Verified
- Backend API structure and endpoints are correctly defined per ARCHITECTURE.md
- `store.js` filtering logic correctly isolates patient records by ID
- Session middleware is present and enforces authentication on protected routes
- Existing test passes (trivial, but passes)
- Dependencies declared in package.json are appropriate
