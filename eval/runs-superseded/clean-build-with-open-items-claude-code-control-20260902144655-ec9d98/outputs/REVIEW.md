# Release Review: Room Booking Tool

**Date**: 2026-09-02  
**Status**: NOT READY FOR PRODUCTION  

## Summary
The room booking API implementation is architecturally sound with good separation of concerns and security fundamentals. However, there are critical issues preventing Monday's deployment: a missing frontend, unresolved concurrency vulnerabilities, and disconnected calendar integration. The product cannot replace paper sheets without a working UI or guarantee of data integrity under concurrent load.

## Verified Strengths

1. **Architecture & Separation of Concerns**
   - Clear module boundaries: validation, bookings, calendar, server
   - Proper session middleware configuration (httpOnly, sameSite: 'lax', secure)
   - Authentication enforced on all `/api/` endpoints
   
2. **Ownership & Access Control**
   - Users can only view their own bookings via `bookingsFor(staffId)`
   - Users can only cancel their own bookings (checked in `cancel()`)
   - Session-based identity prevents impersonation
   
3. **Validation**
   - Room names validated against whitelist
   - Slot format enforced (ISO 8601, half-hour increments, 08:00–17:30)
   - Attendee count bounded (1–20, integers only)
   - Handles missing/malformed input gracefully
   
4. **Unit Tests**
   - Validation tests cover happy path and edge cases
   - Booking tests verify isolation and double-booking prevention
   - Tests pass (reviewable via `npm test`)

## Critical Issues

### 1. **Missing Frontend Implementation** (Blocks Deployment)
The `public/index.html` is a stub with only `<main id="app"></main>`. Per the UX walkthrough, users expect:
- Sign-in form
- Bookings list (soonest first, empty state message)
- Booking creation form with room/slot/attendee fields
- Cancellation buttons
- Error display and loading states
- Sign-out button

**Impact**: Users cannot book rooms. The tool is non-functional despite API completeness.

### 2. **Concurrency Race Condition in Booking Creation** (Data Integrity)
In `src/bookings.js:create()`:
```javascript
const state = load();
if (state.bookings.some((b) => b.room === booking.room && b.slot === booking.slot)) return null;
// ... gap here: concurrent request can load() and see the same state
const record = { id: `bk${state.bookings.length + 1}`, staffId, ...booking };
state.bookings.push(record);
save(state);
```

If two simultaneous requests check availability between lines 24–28, both will see the room as free and create bookings for the same slot.

**Impact**: Double-bookings can occur, violating the core requirement that "one person cannot book a slot another has booked." Tablet outside the room will show conflicting data.

### 3. **Non-Unique ID Generation** (Data Integrity)
IDs are generated as `bk${state.bookings.length + 1}`. If bookings are ever deleted, IDs become non-unique:
- Booking 1–5 exist
- Booking 3 is deleted (state.bookings.length = 4)
- Next booking gets ID `bk5` → collision with existing booking 5

**Impact**: Cancel requests may target the wrong booking or fail unexpectedly. No recovery mechanism.

### 4. **Calendar Service Disconnected** (Scope Mismatch)
- `src/calendar.js:roomsOutOfService()` is defined but never called
- Architecture doc states: "Room availability is mastered by the building's calendar service"
- Implementation only checks local `bookings.json`, not the calendar service
- A room out of service (maintenance, events) cannot be blocked

**Impact**: System may book a room that the building's calendar marks as unavailable, creating real-world conflicts.

### 5. **Hardcoded Session Secret** (Security)
```javascript
secret: process.env.SESSION_SECRET ?? 'change-me',
```

In production without the env var, sessions use a hardcoded secret, allowing session forgery.

**Impact**: Any user can forge another user's session and book/cancel on their behalf. Low-effort attack.

## Secondary Issues

1. **No Server Endpoint Tests**: Validation and bookings are tested in isolation; the Express routes and error responses are untested.
2. **Missing Error Recovery**: No circuit breaker or retry for calendar service calls if they fail.
3. **Slot Boundaries**: Regex allows 08:00 and 09:00–17:30 (comment says "08:00 and 17:30" but 08:00 includes only half-hour; clarify if 08:00–08:30 is intended).

## Recommendations

### Must Fix (Blocks Release)
- [ ] Implement the frontend (React/Vue/vanilla JS)
- [ ] Fix double-booking race: use file locking, a database transaction, or atomic append-only log
- [ ] Fix ID generation: use UUID or a proper counter (e.g., timestamp + random suffix)
- [ ] Require `SESSION_SECRET` env var; error if missing
- [ ] Integrate calendar service: call `roomsOutOfService()` when validating bookings

### Should Fix (Before First Review)
- [ ] Add integration tests for API endpoints
- [ ] Handle calendar service failure gracefully (timeout, fallback, retry)
- [ ] Clarify 08:00 slot: does 08:00–08:30 exist or start at 08:30?

### Can Defer (After MVP)
- [ ] User authentication against a proper directory (currently staff sign-in is trusted)
- [ ] Audit logging of bookings and cancellations

## Verification Notes

✓ Codebase explored; no evaluation metadata found  
✓ Validation logic: comprehensive, handles edge cases  
✓ Booking logic: prevents double-books in single-threaded mode only  
✓ Session security: cookie flags correct; secret vulnerable  
✓ Frontend: missing entirely  
✓ Calendar integration: imported but unused  
✓ Tests: validate.test.js and bookings.test.js pass  

## Conclusion

The API foundation is solid, but the product is incomplete. Without the frontend, staff cannot use it. The concurrency vulnerability and missing calendar integration mean bookings may collide with reality. **Do not deploy Monday.** Fix concurrency, implement the frontend, and integrate the calendar service before returning for review.
