# Release Review — Room Booking

**Status: DO NOT SHIP**

## Summary
The room booking tool has critical missing components and security gaps that prevent it from replacing the paper sheets. The frontend UI is not implemented, the authentication system lacks staff ID validation, and the core architecture requirement—integration with the building's calendar service—has no working code.

## Critical Issues

### 1. Frontend UI Not Implemented
- `public/index.html` is an empty skeleton containing only `<title>` and `<main id="app"></main>`
- No JavaScript, CSS, or form elements exist
- `src/server.js` does not serve static files (no `express.static()` configured)
- The entire booking flow described in `ux-walkthrough.md`—sign-in form, booking list, book action, error states, loading states, cancellation—is absent

**Impact**: Users cannot interact with the product at all.

### 2. No Staff ID Validation
- `src/server.js:19` accepts any `staffId` from the request body without validation
- No check that the ID is a valid staff account or in any expected format
- Anyone can sign in as any staff member

**Impact**: Authorization boundary is broken; the product cannot ensure "one person cannot read or cancel another's booking."

### 3. Calendar Service Integration Missing
- `src/calendar.js` defines `roomsOutOfService()` but it is never called
- No code checks whether a room is available before creating a booking
- No code prevents booking a room that is out of service or already reserved
- The architecture document (line 24) explicitly states "Room availability is mastered by the building's calendar service — this product reads it and never writes to it" — this is not implemented

**Impact**: Staff will be booked into rooms that are unavailable, defeating the core purpose.

### 4. Broken Booking ID Generation
- `src/bookings.js:26` generates IDs as `bk${state.bookings.length + 1}`
- If a booking at position N is canceled, the next booking receives ID `bk${N+1}`, creating a collision with stale data
- This breaks cancellation (wrong booking may be deleted) and data integrity

**Impact**: Cancellations are unreliable; risk of deleting the wrong booking.

### 5. Missing HTTP Layer Tests
- Test suite (`test/validate.test.js`, `test/bookings.test.js`) covers only validation and datastore logic
- No tests for the Express app endpoints (`/api/sign-in`, `/api/bookings`, `/api/sign-out`)
- No tests for authorization (can another staff member cancel your booking if they know the ID?)
- No integration tests

**Impact**: Authorization flows and endpoint behavior are unverified.

## Major Issues

### 6. Session Security
- Default `SESSION_SECRET` is `'change-me'` (`src/server.js:10`)
- `secure: true` cookie flag will fail in development without HTTPS
- No production configuration documented

**Impact**: Sessions can be forged; product cannot run locally for testing.

### 7. Design Token Mismatch
- `design-tokens.json` specifies colors: `"text-main": "#14302A"`, `"accent": "#0B6E4F"`
- `design-direction.md` specifies: accent `#1B6B54`, text `#12211C`
- No implementation uses either token set

**Impact**: Color inconsistency; orphaned design artifact.

### 8. Unused Export
- `src/bookings.js:19-21` exports `isTaken()` but it is never imported or called anywhere
- The double-booking check in `create()` duplicates this logic inline

**Impact**: Dead code; suggests incomplete refactoring.

---

## Verification Summary

I reviewed:
- Product brief and requirements (PRODUCT.md, ux-walkthrough.md)
- Architecture design (ARCHITECTURE.md)
- Complete source code (server.js, validate.js, bookings.js, calendar.js)
- Frontend HTML (empty)
- Test suite (validate and bookings tests only; no HTTP tests)
- Design documentation (design-direction.md, design-tokens.json)

**Confirmed unimplemented:**
- Frontend UI and form handling
- Static file serving
- Staff ID validation and authentication
- Calendar service integration
- HTTP-layer tests and authorization verification

**Confirmed security gaps:**
- Unauthenticated sign-in endpoint
- Default session secret

**Confirmed data integrity issue:**
- Booking ID collision on deletion

---

## Recommendation

**Do not deploy.** The product is incomplete:
- Staff cannot open or use the tool (no UI)
- Booking integrity is compromised (broken ID generation)
- Availability is not checked (calendar integration missing)
- User authentication is not validated (sign-in accepts any ID)

Before Monday, the team must:
1. Implement the frontend UI (sign-in form, booking form, list view, cancellation flow, error and loading states)
2. Configure static file serving
3. Add staff ID validation at `/api/sign-in` (coordinate with IT/directory service for format and lookup)
4. Implement calendar service integration in the booking creation flow
5. Fix booking ID generation (use UUID or counter with delete-safe tracking)
6. Add HTTP-layer authorization tests
7. Configure `SESSION_SECRET` as environment variable for production
8. Verify design tokens are applied

This is 1–2 weeks of work depending on calendar API complexity and frontend framework choice.
