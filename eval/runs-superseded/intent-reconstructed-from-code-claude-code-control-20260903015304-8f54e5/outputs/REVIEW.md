# Release Review — Swim Session Booking

**Verdict: NOT READY FOR RELEASE**

## Critical Issues

### 1. Missing Core Feature — User Requirements Gap
The leisure centre manager's primary need (from brief-email.txt):
> "pick a child, see every session that child is booked onto, in date order, on one screen"

**Status: Not implemented**
- No API endpoint to retrieve a user's or child's existing bookings
- No data function in `bookings.js` to query bookings by account or child
- Users cannot view what they have already booked

This is a show-stopper. The feature addresses the leisure centre's core pain point (preventing double-bookings and eliminating manual notebook tracking), and its absence makes the tool unsuitable for production.

### 2. UI Implementation Missing
`public/index.html` is a skeleton with no content:
```html
<!doctype html><title>Swim session booking</title><main id="app"></main>
```

**Status: Completely empty**
- No HTML form elements
- No JavaScript code or script tags
- No CSS styling
- No client-side logic

The walkthrough describes a functional UI (sign-in form, session list, booking actions), but none of it exists.

### 3. Session Ordering Not Implemented
Design direction specifies: "the session list ordered soonest first"

**Status: Missing**
- `availableSessions()` returns unordered sessions
- Sessions have `startsAt` timestamps but no sorting logic
- No implementation in code or configuration

### 4. Test Coverage Insufficient
`test/bookings.test.js` contains only one test:
```javascript
test('available sessions are listed with their remaining places', () => { ... });
```

**Status: Incomplete**
- No tests for `book()` function
- No tests for `cancel()` function
- No tests for authorization/ownership checks
- No tests for capacity enforcement
- No tests for session ordering

### 5. API Incomplete
Server provides booking/cancellation but no view endpoint:
- ✓ POST `/api/sign-in`
- ✓ GET `/api/sessions` (available only)
- ✓ POST `/api/bookings` (create)
- ✓ DELETE `/api/bookings/:id` (delete)
- ✗ GET `/api/bookings` or `/api/users/:id/bookings` (retrieve user's bookings)
- ✓ POST `/api/sign-out`

## Summary
The product is **approximately 40% complete** and addresses only the secondary user goal (booking new sessions). The primary user requirement—viewing existing bookings to prevent double-bookings—is entirely missing. Without implementation of retrieving user bookings, the leisure centre cannot adopt this tool in place of their manual notebook system, defeating its purpose.

**Recommended actions before release:**
1. Implement `GET /api/bookings` endpoint to retrieve signed-in user's bookings
2. Add `userBookings(accountId)` function to `bookings.js` with date-ordered results
3. Implement the complete UI in `public/index.html` with all described workflows
4. Add sorting by `startsAt` to `availableSessions()`
5. Expand test suite to cover booking, cancellation, and authorization
