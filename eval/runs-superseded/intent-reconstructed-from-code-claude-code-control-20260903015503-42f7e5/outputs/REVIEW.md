# Release Review — Swim Session Booking Tool

**Date:** 2026-09-03  
**Status:** ❌ **DO NOT RELEASE** — Critical issues block deployment

---

## Summary

The booking tool has foundational implementation but is **incomplete and unsafe for production**. The frontend is an empty shell, security boundaries are not enforced, and concurrent write safety is not guaranteed. These issues must be resolved before the new term.

---

## Critical Issues (Block Release)

### 1. Frontend Not Implemented
**File:** `public/index.html`  
**Problem:** The HTML file contains only a doctype and empty main element. No UI, no forms, no session display.  
**Impact:** Users cannot interact with the system at all. The product is non-functional.  
**Required:** Implement the UI as described in `ux-walkthrough.md` (sign-in form, session list, booking/cancellation controls).

### 2. No Input Validation
**File:** `src/server.js` lines 18, 25  
**Problem:** 
- Sign-in accepts any `accountId` value without validation (line 18)
- Book endpoint accepts `childId` and `sessionId` from request body without type/format checks
- Anyone can sign in as any account by crafting a POST to `/api/sign-in`

**Impact:** Authorization bypass — users can access and modify other accounts' bookings.  
**Required:** 
- Validate `accountId` is a known parent/staff account
- Validate `childId` belongs to the signed-in account
- Sanitize and validate all request inputs

### 3. Race Condition in Booking
**File:** `src/bookings.js` lines 30-39  
**Problem:** The book function loads state, checks capacity, then saves. Between load and save, another request could also load and book, bypassing the capacity check. No file locking.  
**Impact:** Oversold sessions — more bookings than capacity allows.  
**Example Scenario:**
- Session W1 has 1 free spot
- Request A: loads state (1 spot free), proceeds
- Request B: loads state (1 spot free), proceeds
- Request A: saves booking (now 0 spots, 9 taken)
- Request B: saves booking (now 0 spots, 10 taken) ← **Over capacity**

**Required:** Implement atomic read-modify-write (file locking, database transaction, or mutex).

### 4. Insufficient Test Coverage
**File:** `test/bookings.test.js`  
**Problem:** Only 1 test. No tests for:
- Booking functionality (successful book, book when full)
- Cancellation (cancel own booking, reject cancel of others' booking)
- Sign-in (auth required, access control)
- Edge cases (invalid IDs, concurrent operations)

**Impact:** Core features untested. Bugs in booking/cancellation logic are not caught.  
**Required:** Expand test suite to cover all critical paths and access control.

---

## High-Severity Issues

### 5. Unvalidated Account Access
**File:** `src/server.js` line 18  
**Problem:** No account validation in sign-in. Line 15 checks `req.session.accountId` exists but doesn't verify it's a valid account. Combined with issue #2, any string is accepted.  
**Impact:** Account hijacking, data access for non-existent or unauthorized accounts.  
**Required:** Maintain an account list (hardcoded or file-based) and validate before storing in session.

### 6. Default Session Secret
**File:** `src/server.js` line 9  
**Problem:** `process.env.SESSION_SECRET ?? 'change-me'` — if `SESSION_SECRET` is not set, sessions use a hardcoded default. Predictable secrets allow session forgery.  
**Impact:** On deployment, if env var is forgotten, sessions are forgeable.  
**Required:** Require `SESSION_SECRET` to be explicitly set; fail fast if missing.

### 7. No File I/O Error Handling
**File:** `src/bookings.js` lines 7, 11-12  
**Problem:**
- Line 7: Load catches errors but silently seeds empty data (masks corrupted files)
- Line 11: `mkdirSync` could fail (permissions, disk full) and crash the process
- Line 12: `writeFileSync` could fail silently in a catch block

**Impact:** Silent data loss, crashed process without warning, corrupted state.  
**Required:** Log errors, handle disk/permission failures explicitly, ensure write atomicity (write-then-rename pattern).

---

## Medium-Severity Issues

### 8. Predictable Booking IDs
**File:** `src/bookings.js` line 35  
**Problem:** Booking IDs increment sequentially (`b1`, `b2`, ...). Users can enumerate all bookings.  
**Impact:** Privacy risk — users can guess other bookings' IDs, though cancellation requires accountId match.  
**Recommendation:** Use UUIDs or random identifiers.

### 9. Missing Real-Time Feedback
**Problem:** When a session fills up, clients viewing the page don't know. They may attempt to book a now-full session, get a 409 error, but have no way to refresh without reloading.  
**Impact:** Poor UX — users can't tell if a session became unavailable without manual refresh.  
**Recommendation:** Add session state polling or WebSocket updates on the frontend.

### 10. No Logging
**File:** Entire codebase  
**Problem:** No logging of sign-ins, bookings, cancellations, or errors. Reception staff can't troubleshoot issues.  
**Impact:** Difficult to debug issues post-deployment.  
**Recommendation:** Add structured logging for auth events, bookings, and errors.

### 11. Session Security — HTTPS Requirement
**File:** `src/server.js` line 12  
**Problem:** `secure: true` on cookie requires HTTPS, but the tool runs on a local leisure-centre network without TLS.  
**Impact:** In HTTP mode, the `secure` flag is ignored, and session cookies are not marked secure in transit.  
**Recommendation:** Use `secure: process.env.NODE_ENV === 'production'` and ensure HTTPS in prod, or clarify network topology.

---

## Minor Issues

### 12. Empty Error Messages
**File:** `src/server.js` lines 26, 32  
**Problem:** API returns `{ error: 'session full' }` and `{ error: 'not found' }` but server logs nothing.  
**Impact:** Users see generic errors; reception staff can't troubleshoot.

### 13. Test Incompleteness
**File:** `test/bookings.test.js`  
**Problem:** Test doesn't verify the `capacity` or `startsAt` fields, or order of sessions.  
**Impact:** Changes to session ordering or capacity are not caught by tests.

---

## Verification Checklist

- ✅ Architecture reviewed (Express + JSON file store reasonable for scale)
- ✅ Security boundaries identified (sessionId, accountId, bookingId ownership)
- ✅ Data flow traced (load → modify → save cycle)
- ✅ Test coverage assessed (minimal)
- ❌ Frontend implementation verified (not implemented)
- ❌ Concurrency safety confirmed (race conditions found)
- ❌ Input validation confirmed (missing)
- ❌ Error handling confirmed (incomplete)

---

## Recommendation

**Hold release.** The tool cannot be deployed as-is:

1. **Immediate (blocking):**
   - Implement frontend UI
   - Add input validation for accountId, childId, sessionId
   - Fix booking race condition with file locking or equivalent
   - Expand test suite

2. **Before rollout:**
   - Require SESSION_SECRET env var (fail fast)
   - Improve file I/O error handling
   - Add logging for troubleshooting
   - Clarify HTTPS / network security model

3. **Nice-to-have (post-MVP):**
   - Real-time session state updates
   - UUID booking IDs
   - CSRF protection (explicit configuration)

Estimated effort: 2–3 days for fixes + testing. Target: end of next week for new-term deployment.
