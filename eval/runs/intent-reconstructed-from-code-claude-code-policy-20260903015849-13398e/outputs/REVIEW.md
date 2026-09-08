# Release Verdict: NOT READY FOR PRODUCTION

**Date:** 2026-09-03  
**Status:** ❌ BLOCKED - Critical gaps prevent release  
**Recommendation:** Do not deploy. Address critical issues below before term start.

---

## Summary

The swim session booking tool has a working HTTP API for sign-in, listing sessions, and basic booking/cancellation. However, it **misses the primary user need**, has **no frontend**, lacks **critical authorization**, and falls short of the engineering baseline on testing and data integrity.

---

## Critical Issues (Must Fix)

### 1. **Misalignment with User Need**
- **Finding:** The product brief (docs/brief-email.txt) clearly identifies Dana's PRIMARY pain point: *"pick a child, see every session that child is booked onto, in date order, on one screen"* to prevent double-booking.
- **Current state:** No API endpoint or UI exists to list a user's existing bookings. The system only shows available sessions for booking.
- **Impact:** Parents and reception staff cannot verify what a child is already booked onto. The double-booking problem remains unsolved.
- **Fix required:** Add GET `/api/bookings` endpoint (filtered by accountId) and UI view to display user's bookings.

### 2. **No Frontend Implementation**
- **Finding:** `public/index.html` is a skeleton (`<main id="app"></main>`) with no scripts, styles, or UI elements.
- **Current state:** The ux-walkthrough.md describes sign-in form, session list, booking flow, and error states—none of which are implemented.
- **Impact:** The tool cannot be used. Deployment would result in a blank page.
- **Fix required:** Implement the full frontend as described in ux-walkthrough.md, using design tokens and high-contrast design.

### 3. **No Authorization on Sign-In**
- **Finding:** The POST `/api/sign-in` endpoint (server.js:18) accepts any `accountId` without validation.
  ```javascript
  app.post('/api/sign-in', (req, res) => {
    req.session.accountId = req.body.accountId;
    res.json({ ok: true });
  });
  ```
- **Impact:** Anyone can impersonate any parent or staff member by simply posting a different accountId. No authentication is performed.
- **Fix required:** Implement real authentication (e.g., PIN, password, or integration with centre's staff/parent database) to verify the user's identity.

### 4. **Weak Session Secret**
- **Finding:** server.js:9 defaults to `'change-me'` if `SESSION_SECRET` is not set.
  ```javascript
  secret: process.env.SESSION_SECRET ?? 'change-me',
  ```
- **Impact:** Without proper secret rotation on deployment, session tokens are predictable and forgeable. The comment in the code signals the developers knew this was temporary.
- **Fix required:** Require a strong, randomly-generated SESSION_SECRET in production and document the deployment requirement.

### 5. **Booking ID Generation Not Unique**
- **Finding:** bookings.js:35 generates IDs using `state.bookings.length + 1`.
  ```javascript
  const booking = { id: `b${state.bookings.length + 1}`, accountId, childId, sessionId };
  ```
- **Impact:** If bookings are deleted, new bookings will reuse old IDs (e.g., delete b3, add a new booking → b3 again). This breaks cancellation logic and creates data integrity issues if stored references exist.
- **Failure scenario:** A booking with ID "b1" is created, then cancelled. A second booking is created, also getting ID "b1". The cancel API cannot distinguish them.
- **Fix required:** Use a monotonically increasing counter (never reset) or a UUID-based scheme.

---

## High-Priority Issues

### 6. **Insufficient Test Coverage**
- **Finding:** test/bookings.test.js has only 1 test, checking that availableSessions() returns sessions with a `taken` field. No tests for:
  - `book()` happy path and error cases (session full, invalid sessionId)
  - `cancel()` success, authorization check, and not-found cases
  - Data persistence (bookings survive a reload)
  - Capacity enforcement (cannot overbooking past capacity)
  - Sign-in/authorization flow
- **Impact:** Critical booking logic is untested. Regressions go undetected.
- **Fix required:** Add tests for all exported functions and critical API flows per the engineering policy.

### 7. **No GET Endpoint for User's Bookings**
- **Finding:** The API provides POST `/api/bookings` (create) and DELETE `/api/bookings/:id` (cancel), but no GET to retrieve a user's bookings.
- **Impact:** Without this, the UI cannot display the user's current bookings—essential for the primary user need and for the booking workflow to show confirmation.
- **Fix required:** Add GET `/api/bookings` (requires session, returns bookings for current accountId).

### 8. **Missing Validation**
- **Finding:** POST `/api/bookings` (server.js:24-26) does not validate `childId` exists or belongs to the signed-in account.
  ```javascript
  const booking = book(req.session.accountId, req.body.childId, req.body.sessionId);
  ```
- **Impact:** Parents can book unknown/other children. No child data model exists to validate ownership.
- **Fix required:** Define a child data model, persist it, and validate bookings against it.

---

## Medium-Priority Issues

### 9. **Session Cookie Security in Development**
- **Finding:** server.js:12 sets `secure: true`, requiring HTTPS.
- **Impact:** In development/testing on localhost, this will fail if not using HTTPS. Documentation should clarify this requirement or use environment-based toggling.
- **Note:** This is correct for production but may block local testing.

### 10. **No Error Handling for Disk I/O**
- **Finding:** bookings.js does not handle I/O errors gracefully. If disk is full or permissions fail, save() will throw and crash the server.
- **Impact:** Brief outages can corrupt state or leave the system unrecoverable.
- **Fix required:** Add error handling and logging; consider a backup or recovery mechanism.

---

## Verification Results

### Tested
✅ Code reads correctly and is syntactically valid.  
✅ Architecture and boundaries are clear (single writer, session-based auth).  
✅ Seed data is present for testing.  

### NOT Tested (Cannot verify without running)
❌ Frontend exists and renders.  
❌ Booking workflow end-to-end.  
❌ Data persistence to disk.  
❌ Session-based authorization.  
❌ Concurrency safety (simultaneous requests, race conditions).  

### Cannot Test Without Fixing
❌ User can see their existing bookings.  
❌ User can prevent double-booking.  
❌ Reception staff can look up children.  

---

## Compliance with Engineering Policy

| Policy | Status | Note |
|--------|--------|------|
| Clarify unknowns before architecture | ⚠ Partial | User need is documented but implementation diverged from it |
| Smallest coherent implementation | ✅ Yes | Backend is minimal and focused |
| Validate inputs and authorization at boundaries | ❌ No | Sign-in has no validation; child ownership not checked |
| Use additive, backwards-compatible changes | ✅ N/A | No deployment history |
| Add focused automated tests for critical paths | ❌ No | Only 1 test; critical paths untested |
| Run product, tests, build before completion | ❌ No | Not running; tests minimal |
| Report remaining uncertainty explicitly | ✅ Yes | Issues listed here |

---

## Action Items for Release

**Before deploying:**

1. **Implement frontend** (high effort)
   - Add HTML/CSS/JS to public/index.html
   - Implement sign-in, session list, bookings view, book/cancel flows
   - Match design direction and accessibility requirements

2. **Add authentication** (high impact)
   - Define or integrate user identity system
   - Replace dummy sign-in with real validation

3. **Add bookings retrieval** (critical for UX)
   - Implement GET `/api/bookings` endpoint
   - Validate child ownership in booking flow

4. **Fix data integrity** (medium effort)
   - Use UUID or monotonic ID scheme for bookings
   - Add data migration path if any bookings exist

5. **Expand test suite** (medium effort)
   - Test book(), cancel(), authorization checks, persistence
   - Add integration tests for key API flows

6. **Secure deployment** (low effort)
   - Set SESSION_SECRET in environment
   - Document https requirement
   - Add error handling for disk I/O

---

## Uncertainty

- **Child database:** The product doesn't define how children are registered or validated. Is there a separate admin tool? Are children identified by name or ID?
- **Staff workflow:** Unclear how reception staff use the tool differently from parents (if at all).
- **Deployment environment:** No documentation on Node version, process management, or network isolation.
- **Capacity overbooking scenario:** If a session receives simultaneous bookings near capacity, race conditions could allow overbooking (no locking on save/load).

---

## Recommendation

**Do not deploy for the new term.** The tool lacks the UI and the primary feature (viewing bookings to prevent double-booking). Deployment would not solve Dana's stated problem and would introduce a false sense of progress.

**Timeline:** Estimate 2–3 days of focused work to address critical issues (frontend, auth, bookings retrieval) and achieve a minimal viable release.
