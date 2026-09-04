# Release Verdict: BLOCK

## Summary
The room booking tool **cannot be released** to replace the paper sheets on Monday. Critical product functionality is missing, and the calendar integration—a core architectural requirement—is incomplete.

## Gate check
Not run (acceptance check script requires explicit approval). However, structural issues are evident without automated validation.

## Critical blockers

### 1. Frontend code missing entirely
**Severity: CRITICAL**
- The `public/index.html` file contains only a doctype declaration, title, and an empty root element: `<main id="app"></main>`
- No JavaScript, no CSS, no UI components
- No sign-in form, booking list, form validation UI, or cancellation interface
- The product cannot be used by any staff member without a functional frontend
- **Failure scenario:** User opens the app and sees a blank page

### 2. Calendar service integration incomplete
**Severity: CRITICAL**
- `src/calendar.js` defines `roomsOutOfService(dateIso)` to read room availability from the building's calendar service
- This module is mentioned in `ARCHITECTURE.md` as a required part: "read-only client for the building's calendar service"
- **The function is never imported or called anywhere in the codebase**
- grep of src/ and public/ directories confirms zero usage
- Bookings are created without checking against the calendar service
- The product violates its own architectural boundary: "Room availability is not duplicated locally. The calendar service is the master"
- **Failure scenario:** A staff member books a meeting room that is out of service or already blocked in the calendar; the paper sheets would have been more reliable

### 3. Session secret hardcoded with insecure default
**Severity: HIGH**
- `src/server.js` line 10: `secret: process.env.SESSION_SECRET ?? 'change-me'`
- If `SESSION_SECRET` environment variable is not set, all session cookies use the default string `'change-me'`
- Any attacker with knowledge of Express.js defaults can forge user sessions
- Staff accounts and booking data become compromised
- **Failure scenario:** Attacker forges a session cookie to impersonate another staff member, viewing and canceling their bookings

### 4. No staff identity validation
**Severity: MEDIUM**
- `src/server.js` line 19: `/api/sign-in` accepts any `staffId` string without validation
- No check that the staffId exists or belongs to an actual staff member
- A person can sign in as anyone else's account by simply guessing or declaring their staffId
- Combined with the hardcoded session secret, this compounds the authentication weakness
- **Failure scenario:** User types `staffId: "alice"` and gains full access to Alice's bookings

## Walkthrough: Cannot proceed
The adversarial checklist cannot be executed because the primary interface does not exist. There is no sign-in form to fill, no booking interface, no list to view. The success condition—"A member of staff can book a free room for a slot, see their own bookings, and cancel one, without walking to the door to check the sheet"—is literally impossible to achieve with the current code.

## Codebase audit findings

**Backend logic (what exists):** 
- Validation in `src/validate.js` is well-formed and comprehensive
- Booking creation and filtering in `src/bookings.js` correctly prevents double-booking and enforces staffId ownership on cancellation
- These components work correctly in isolation

**Missing integration:**
- No code to render a sign-in form
- No code to fetch room availability from the calendar service before allowing bookings
- No code to display bookings to the user
- No code to handle cancellation requests from a UI

## What was not covered
- Browser-based UI functionality (none exists to test)
- Calendar service API contract (integration never reached)
- Full end-to-end booking flow (incomplete)
- Network error handling and retry paths
- Keyboard navigation and accessibility

## Recommendation
**Do not release.** Schedule this for completion before any staff communication. The required work is substantial:

1. Implement the complete frontend (sign-in form, booking interface, list view, cancellation UI)
2. Integrate the calendar service: call `roomsOutOfService()` during booking to exclude unavailable rooms
3. Remove the hardcoded session secret default or use a secure random fallback
4. Implement staff identity validation (either pre-populate known staffIds or integrate with a staff directory)

The backend structure is sound, but without the frontend and calendar integration, this product is non-functional.
