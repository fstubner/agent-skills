# Release Verdict

## Status: BLOCK

This room booking tool cannot be released in its current state. The product is incomplete and non-functional.

## Summary of Issues

### CRITICAL: Missing Frontend Implementation
**Severity: BLOCK**

The public/index.html file contains only a shell:
```html
<!doctype html><title>Room booking</title><main id="app"></main>
```

There is no JavaScript, CSS, or HTML form to implement any of the user-facing functionality described in the ux-walkthrough and PRODUCT.md. The walkthrough specifies these steps:
- Sign in form
- Display list of user's bookings
- Book a room and time slot
- Show error messages when a slot is already booked
- Cancel a booking
- Sign out

**None of these flows are implemented on the frontend.** The application cannot be used by staff members to book rooms because there is no UI to interact with.

### CRITICAL: Missing API Endpoint for Room Availability
**Severity: BLOCK**

The backend is missing a crucial endpoint needed for the happy path. The code provides:
- `/api/sign-in` — sign-in endpoint
- `/api/bookings` — list and create bookings
- `/api/bookings/:id` — cancel booking
- `/api/sign-out` — sign out

But there is **no endpoint to retrieve available rooms and time slots for the current day**. The ux-walkthrough mentions "Book a free room and slot" but there's nowhere in the API to query which rooms are free. The calendar.js module can fetch out-of-service rooms from an external service, but this is never exposed as an API endpoint and never used by any route.

A user cannot complete the primary job ("book a free room for a slot") without knowing which rooms are free. The `/api/bookings` POST endpoint will reject a duplicate booking, but without an endpoint to check availability first, the UX becomes unusable.

### CRITICAL: Insufficient Authentication
**Severity: HIGH**

The `/api/sign-in` endpoint accepts any staffId without validation:
```javascript
app.post('/api/sign-in', (req, res) => {
  req.session.staffId = req.body.staffId;
  res.json({ ok: true });
});
```

There is no:
- Validation that the staff ID actually exists or belongs to a real staff member
- Password or credential check
- Link to an authentication system (LDAP, directory, etc.)
- Audit trail of who signed in

Any person can sign in as anyone else and view/cancel their bookings, or impersonate other staff members. The PRODUCT.md states "Everyone signs in with a staff account" but does not specify how accounts are validated. The implementation provides zero authentication.

**Secondary concern:** The session secret defaults to 'change-me':
```javascript
secret: process.env.SESSION_SECRET ?? 'change-me',
```

This is insecure for any real deployment.

### MEDIUM: Missing Endpoint Integration
**Severity: MEDIUM**

The calendar.js module `roomsOutOfService()` function exists but is never:
- Called by any route handler
- Integrated into the booking creation flow
- Used to filter available rooms for the frontend

This means room out-of-service events are never consulted when allowing bookings. If the building's calendar service marks a room as out of service, this application will still allow bookings in it.

### MEDIUM: Race Condition in Booking Creation
**Severity: MEDIUM**

The booking creation in src/bookings.js loads the state, checks for conflicts, and saves:
```javascript
export function create(staffId, booking) {
  const state = load();
  if (state.bookings.some((b) => b.room === booking.room && b.slot === booking.slot)) return null;
  const record = { id: `bk${state.bookings.length + 1}`, ...booking };
  state.bookings.push(record);
  save(state);
  return record;
}
```

If two concurrent requests check availability simultaneously (before either writes), both may pass the conflict check and create duplicate bookings for the same slot. File-based JSON storage with no locking is vulnerable to this race condition.

### MEDIUM: Insufficient Input Validation on Sign-in
**Severity: MEDIUM**

The sign-in endpoint does not validate the `staffId` field:
```javascript
req.session.staffId = req.body.staffId;
```

Invalid inputs (null, empty string, very long strings, special characters) are accepted without sanitization.

## What Has Been Verified

✓ **Backend API structure** — The Express server is correctly structured with session management and route handlers.

✓ **Booking validation** — The validate.js module correctly checks room names, time slots, and attendee counts.

✓ **Access control on read/cancel** — Bookings are correctly filtered by staffId, preventing one user from reading or canceling another's bookings.

✓ **Unit tests** — The validate.test.js and bookings.test.js test files are well-written and cover the core business logic.

✓ **Design intent** — PRODUCT.md, ARCHITECTURE.md, and design-direction.md are well-written documents that correctly describe the intended product.

## What Has NOT Been Verified

✗ **Frontend functionality** — No frontend exists to test.

✗ **User workflows** — Cannot execute the ux-walkthrough replay because there is no browser UI to drive.

✗ **Runtime behavior** — The application cannot be started and run through the happy path because essential components are missing.

✗ **Integration with calendar service** — The calendar API integration is incomplete and untested.

✗ **Concurrent booking handling** — No tests exist for concurrent booking attempts.

✗ **Staff authentication mechanism** — Unknown how the missing authentication system should integrate.

## Conclusion

The backend implementation is technically sound for the pieces that exist, but the product is **missing the frontend entirely and lacks critical API endpoints** needed for the primary user job. The authentication system is not implemented despite being essential for an office staff application.

This cannot ship as-is. The team needs to:

1. **Implement the frontend** — HTML, CSS, and JavaScript to provide the user interface for all flows described in ux-walkthrough.md
2. **Implement the room availability endpoint** — Add an API route that returns free rooms and time slots, integrating with the calendar service
3. **Implement authentication** — Add actual validation of staff IDs against an authentication system
4. **Add locking to the JSON file** — Or migrate to a proper database to prevent race conditions

The office manager cannot replace the paper sheets on Monday with this product.
