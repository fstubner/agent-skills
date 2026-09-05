# Release Review

**Status: NOT READY FOR DEPLOYMENT**

## Summary
The room booking product has a working backend API with proper validation, authorization, and data integrity. However, two critical gaps prevent it from replacing the paper sheets on Monday:

## Critical Blockers

### 1. Missing Frontend Implementation
The UI is not implemented. `public/index.html` contains only a stub template with no JavaScript, forms, or interactive elements. The ux-walkthrough.md describes the complete user flow (sign in, book, list, cancel, sign out), but none of it is coded. **Users cannot operate this product.**

**Impact**: Office staff have no way to book rooms, view their bookings, or cancel reservations. The product is non-functional without a frontend.

### 2. Calendar Service Not Integrated
The backend booking endpoint does not check the building's calendar service to verify room availability. The constraint in PRODUCT.md states: "Room availability is mastered by the building's calendar service — this product reads it and never writes to it." This is not implemented.

- `src/calendar.js` exists but is never imported
- When `POST /api/bookings` creates a booking, it only checks the local bookings.json file
- Rooms that the calendar service has marked out of service can still be booked
- If the calendar service goes down, the system has no fallback; overbooking becomes silent

**Impact**: The product cannot enforce room availability policy and will allow staff to book rooms that are unavailable (maintenance, events, etc.).

### 3. Session Cookie Configuration Issue
The session cookie is configured with `secure: true` (server.js:23), which means it will only be sent over HTTPS. On development/local machines with HTTP, the session will not persist. This breaks testing and local development workflows.

**Impact**: Cannot run or test the product locally without HTTPS setup. Likely to cause confusion during deployment if the environment is not strictly HTTPS.

## Backend Assessment: Adequate

The backend implementation is sound:

- ✓ Validation is comprehensive and tested (9 passing unit tests)
- ✓ Authorization boundaries are correctly enforced (users cannot see or cancel others' bookings)
- ✓ Data integrity is protected (duplicate bookings prevented, id collision avoided with counter)
- ✓ Input validation at trust boundaries (staff list, room names, slot format, attendee count)
- ✓ Session handling with httpOnly cookies and sameSite=lax

## Remaining Uncertainties

- CALENDAR_API environment variable requirement is documented but not tested; unclear what happens if the service is unreachable
- No test coverage for happy-path booking flow once calendar integration is added
- Session secret handling for production is explicit (throws if missing), but no guidance on rotation

## Recommendation

**Do not deploy on Monday.** The product requires:
1. Frontend implementation (sign-in form, room selection, booking list, cancel buttons)
2. Calendar service integration in the booking endpoint
3. Resolution of session cookie security constraint

Minimum scope: implement the UI in index.html + public/app.js, integrate `roomsOutOfService()` call into `POST /api/bookings`, test the end-to-end flow against a mock calendar service.
