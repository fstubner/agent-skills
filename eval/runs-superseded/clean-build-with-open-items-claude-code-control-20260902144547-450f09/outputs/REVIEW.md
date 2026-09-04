# Release Review — Room Booking Tool

**Date:** 2 September 2026  
**Status:** ❌ **NOT READY FOR PRODUCTION**

## Summary

The room booking tool has a solid backend API design with proper validation and data isolation, but critical gaps prevent deployment on Monday: the frontend is missing, authentication is unvalidated, the calendar service integration is unused, and concurrency issues expose the risk of double-booking under load.

## Critical Issues

### 1. Missing Frontend Implementation
The `public/index.html` is a bare shell with no JavaScript, styles, or UI. Users cannot sign in, book rooms, view bookings, or cancel bookings. This is a complete blocker.

**Impact:** Tool is unusable. The office manager cannot deploy this.

**Required:** Implement the full client-side application per the ux-walkthrough specification, including sign-in form, bookings list, booking form with room/slot/attendees fields, error handling, and cancel actions.

### 2. Unauthenticated Sign-In
`/api/sign-in` accepts any `staffId` from the request body without validation. Any user can impersonate any other staff member by sending a crafted request.

**Location:** `src/server.js:18-21`

**Impact:** No access control. One person can see and cancel another's bookings. Audit trail is compromised.

**Required:** Integrate with actual staff authentication (LDAP, SSO, or verified staff directory). Do not accept staffId from untrusted user input.

### 3. Unused Calendar Integration
`src/calendar.js` defines `roomsOutOfService()` but it is never called. Bookings can be created for rooms that are out of service, violating the architecture requirement that "room availability is mastered by the building's calendar service."

**Location:** `src/calendar.js` (imported but unused); `src/server.js` post /api/bookings doesn't check availability

**Impact:** Users book rooms that are unavailable (maintenance, closure, etc.). The tool undermines the building calendar, not complements it.

**Required:** Call `roomsOutOfService()` before confirming a booking and reject any booking for a room marked out of service on that date.

### 4. Race Condition in Booking Creation
`src/bookings.js:23–29` loads state, checks if slot is taken, then writes. Between check and write, two concurrent requests can both see the slot as free and both create a booking.

**Impact:** Double-booking is possible under any meaningful load (e.g., multiple staff refreshing at the same time). Defeats the purpose of the tool.

**Required:** Implement atomic file locking (via a library like `proper-lockfile`) or migrate to a database with transaction support. At minimum, re-check after acquiring a lock before writing.

### 5. Insecure Session Secret Default
`src/server.js:10` defaults the session secret to `'change-me'` if `SESSION_SECRET` is not set. This is readable in git history and any static analysis.

**Impact:** Session cookies are predictable. Attackers can forge sessions without needing to authenticate.

**Required:** Require `SESSION_SECRET` to be explicitly set; fail fast with a clear error if not provided. Document that this must be a strong random value, unique per deployment, and never committed to git.

## Minor Issues

### 6. Missing Environment Validation
`CALENDAR_API` is required but not checked at startup. The server starts successfully but crashes only when a booking is first attempted if the variable is missing.

**Location:** `src/calendar.js:5`

**Impact:** Unclear failure mode; production outage on first booking.

**Required:** Validate required environment variables (`CALENDAR_API`, `SESSION_SECRET`) at server startup before binding the port.

### 7. ID Collision Risk
`src/bookings.js:26` generates IDs as `bk${state.bookings.length + 1}`. If bookings are deleted, the array length decreases, and new bookings can reuse deleted IDs, risking silent collision.

**Impact:** Low probability but possible data loss if a cancel triggers a refund or audit job tied to the old ID.

**Required:** Use a monotonic counter (stored separately) or UUIDs. If using UUIDs, validate uniqueness before saving.

## Architecture Compliance

| Requirement | Status | Notes |
|---|---|---|
| Runs on staff laptops and tablet | Blocked | No frontend. Server is sound. |
| Node 18+ | ✓ | Package.json is compatible. |
| Read-only calendar integration | ✗ | Calendar client exists but is never called. |
| One person cannot read/cancel another's booking | Blocked | No authentication layer; anyone can be anyone. |
| JSON file storage for three rooms, few hundred bookings/month | ✓ | Appropriate choice; file I/O is acceptable for scale *if* concurrency is handled. |

## Test Coverage

- `test/validate.test.js`: Comprehensive. All edge cases for input validation pass.
- `test/bookings.test.js`: Tests isolation and double-booking prevention, but they do not exercise concurrent requests (single-threaded test runner does not expose race condition).
- No frontend tests; integration tests would fail immediately (no UI).
- No calendar service integration tests.

## Recommendation

**Do not deploy on Monday.** The tool will not function (no UI) and fails baseline security and reliability requirements (unvalidated auth, race conditions, unused calendar master). Reschedule for at least:

1. **This week:** Implement the frontend; wire up real authentication; fix race conditions with file locking.
2. **Next week:** Integrate calendar service; validate environment at startup; run load tests.
3. **Before go-live:** Change session secret in production; brief office manager on reporting double-bookings or auth issues.

The backend API design is sound and the validation layer is solid—these pieces are production-ready. The frontend and auth layer are entirely missing.
