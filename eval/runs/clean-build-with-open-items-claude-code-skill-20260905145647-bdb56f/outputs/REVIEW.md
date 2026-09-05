# Acceptance Review: Room Booking Tool

**Verdict: BLOCK**

## Summary

The room booking tool cannot fulfill its stated purpose. The backend API is correctly implemented with proper session handling and data validation, but **the entire frontend is missing**. The application is non-functional for end users.

## Gate Verification

Cannot run standard gate check due to missing core infrastructure, but manual code review proceeded independently.

## Walkthrough Against Product.md

**BLOCKED at Step 1:** The walkthrough describes a sign-in form and booking interface. `public/index.html` contains only a bare HTML shell with no form elements, no input fields, no buttons, and no JavaScript client code. The interface required to interact with the API does not exist.

## Critical Finding: Missing Frontend

**File:** `public/index.html`  
**Status:** Non-functional  
**Evidence:** 
- HTML is 65 bytes, containing only `<!doctype html><title>Room booking</title><main id="app"></main>`
- No `<script>` tag
- No form elements
- No input fields for sign-in, room selection, time slots, or attendee count
- No client-side JavaScript to call `/api/sign-in`, `/api/bookings`, or `/api/bookings/:id`

The walkthrough claims users can "sign in", "book a free room", "try to book a booked room", "cancel one of your bookings", and "sign out". None of this is technically possible without a frontend.

## Backend Code Review

The backend API implementation itself is sound:

**server.js**
- Sign-in endpoint validates known staff IDs via allowlist
- Session management uses secure flags (httpOnly, sameSite=lax)
- All API endpoints behind `/api/` require authentication
- Proper filtering of bookings by signed-in staffId
- Correct HTTP status codes (401 for auth, 400 for validation, 409 for conflicts, 404 for not found)

**validate.js**
- Validates room against known list (ash, birch, cedar)
- Validates slot format and working hours (08:00-17:30, half-hour increments)
- Validates attendee count (1-20, integer)
- Handles undefined/null body gracefully

**bookings.js**
- Uses counter-based ID generation to avoid collision on cancellation (good)
- Correctly filters bookings by staffId for authorization
- Double-booking prevention works correctly
- Cancellation requires ownership check

**calendar.js**
- Defined but unused: `roomsOutOfService()` function is exported but never called from the server
- CALENDAR_API environment variable dependency is not integrated into the booking flow
- The architecture document claims "Room availability is not duplicated locally" but the API to fetch it is dead code

## Unverified Aspects

- Session persistence (no DATABASE or persistent storage documented)
- Secure cookie behavior in development (secure=true requires HTTPS)
- Calendar API integration (function defined but not called)
- Edge cases: simultaneous bookings, race conditions on file write
- UX walkthrough cannot be executed (no UI to drive)

## Adversarial Checklist Results

| Item | Status | Finding |
|------|--------|---------|
| Contract: Success condition | BLOCKED | Cannot book without frontend |
| MVP: Book a room | BLOCKED | No booking UI |
| MVP: List own bookings | BLOCKED | No UI to display |
| MVP: Cancel booking | BLOCKED | No UI to trigger |
| Primary path: Sign-in form | BLOCKED | Not implemented |
| Empty state handling | BLOCKED | No UI exists to show it |
| Error message display | BLOCKED | No UI to display them |
| Loading state | BLOCKED | No UI to show it |

## Conclusion

This is a backend-only implementation masquerading as a complete product. The API is well-designed with proper validation, session handling, and authorization checks. However, **without a frontend, staff cannot interact with the system at all**. No sign-in, no booking, no cancellation—nothing is possible.

**The product cannot replace the paper sheets on Monday.** An office manager cannot give this to staff.

Restore the frontend code or this remains blocked.
