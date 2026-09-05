# Release Review: Room Booking Tool

**Date:** 2026-09-05  
**Status:** ❌ **NOT READY FOR PRODUCTION**

## Summary

The backend implementation is solid and production-ready, but the product is incomplete: **the user interface (frontend) is entirely missing**. The product cannot fulfill its purpose without a UI, making it unsuitable for release on Monday. Users cannot book rooms, view bookings, or cancel bookings without a functioning frontend.

## What Works

### Backend Implementation ✓
- **Express server** with proper session management and authentication
- **Validation layer** correctly enforces room, slot, and attendee constraints
- **Data storage** uses idempotent ID generation preventing collision after cancellation
- **Authorization** properly scoped—users can only see and cancel their own bookings
- **API design** matches REST conventions with appropriate status codes

### Testing ✓
- **9 automated tests** pass, covering validation and authorization
- Critical security properties verified:
  - Double-booking prevention
  - Cross-user booking isolation (cannot cancel others' bookings)
  - Input validation handles missing/malformed bodies
  - Attendee constraints enforced (1–20)

### Architecture Decisions ✓
- Rationale clear for JSON file storage (small scale: one office, ~100–200 bookings/month)
- Calendar service kept as read-only source of truth (no duplication risk)
- Session secret correctly managed (fails fast in production without `SESSION_SECRET` env var)

## Critical Gaps

### Missing Frontend (Blocking Release)
The `public/index.html` contains only a container div:
```html
<!doctype html><title>Room booking</title><main id="app"></main>
```

**Required but absent:**
- Sign-in form
- Booking form (room, time slot, attendee count)
- Bookings list (sorted soonest-first per design direction)
- Cancel button for each booking
- Sign-out button
- Error messaging that preserves form input on validation failure
- Loading state for async operations
- Empty state message ("You have no bookings")
- Responsive design for tablet and laptop (design direction specifies 18px on tablet, 56px tap targets)

The UX walkthrough documents these requirements explicitly (steps 1–6), but none are implemented.

### Incomplete Calendar Integration
`src/calendar.js` exports a `roomsOutOfService()` function but:
- Never called by the booking flow
- Server will throw if `CALENDAR_API` env var missing
- No error recovery if calendar service is down
- No way for users to see which rooms are unavailable

**Design intent violated:** "Room availability is mastered by the building's calendar service" (ARCHITECTURE.md), but booking doesn't check it.

### Session Security Issue
Cookie configured with `secure: true` in `server.js:23`:
```javascript
cookie: { httpOnly: true, sameSite: 'lax', secure: true }
```
This will break in development (no HTTPS) and on the tablet if it lacks HTTPS setup. Requires either:
- HTTPS on all deployments, or
- `secure: false` for non-production (or conditional based on env)

## Uncertainty & Production Readiness

### Deployment Unknowns
- **Environment variables not documented:** `SESSION_SECRET`, `CALENDAR_API`, `PORT`
- **Missing dependencies:** `npm install` must run before `npm start`
- **Tablet setup unclear:** will the tablet run the same Node.js app, or fetch it via HTTP?

### Incomplete Validation
- Staff list is hardcoded (s1, s2, s3, s4) with no password/authentication
- If sign-in is by staff ID only, anyone who knows an ID can impersonate others—audit needed
- No audit logging of who booked what room when

## Testing Status

**Automated tests:** ✓ Pass  
**Build:** ⚠ Requires `npm install`; not tested (dependencies not installed)  
**Runtime:** ❌ Cannot verify without frontend; backend API functional but untestable end-to-end  
**UX:** ❌ Not walkable; UI doesn't exist

## Policy Alignment

| Policy | Status | Notes |
|--------|--------|-------|
| Clarify material unknowns before architecture | ⚠ Partial | Backend clear; frontend requirements documented in walkthrough but not built |
| Smallest coherent implementation | ✓ | Backend avoids over-engineering |
| Validate inputs at boundaries | ✓ | `validate.js` thorough; session-based auth in place |
| Additive, backwards-compatible data changes | ✓ | Schema extensible (new fields OK) |
| Focused automated tests for critical paths | ✓ | Authorization and collision tests solid |
| Run product, tests, and build before claiming completion | ❌ | Product not runnable (no frontend); tests pass; build not verified |
| Report uncertainty explicitly | ⚠ | Deployment env vars not documented; calendar integration intent unclear |

## Recommendation

**Do not release Monday.** The tool cannot replace paper sheets without a user interface. 

**Before release, complete:**
1. Implement frontend matching the UX walkthrough (sign-in, book, list, cancel, sign-out)
2. Integrate calendar availability check into booking flow
3. Fix session cookie security (conditional `secure: true` per environment)
4. Document required environment variables and deployment steps
5. Test end-to-end walkthrough
6. Verify `npm install && npm test && npm start` succeeds on clean environment

**Estimated scope:** 1–2 days for a developer familiar with the API.

## Verification Checklist

- [x] Reviewed all source files (`server.js`, `validate.js`, `bookings.js`, `calendar.js`, `index.html`)
- [x] Confirmed 9 automated tests pass (`test/validate.test.js`, `test/bookings.test.js`)
- [x] Verified authorization logic isolates user data
- [x] Confirmed double-booking prevention works
- [x] Identified missing components against UX walkthrough
- [x] Cross-checked against engineering policy baseline
