# Release Review: Swim Session Booking

**Status:** NOT READY FOR RELEASE

## Critical Blockers

### 1. Missing Frontend Implementation
- `public/index.html` is empty (skeleton only: `<title>`, `<main id="app">`)
- Users cannot interact with the application
- No sign-in form, session list, booking controls, or navigation present

### 2. Missing Core Requirement
The product brief (Dana Whitlock, 21 July 2026) identifies the primary need as:
> "pick a child, see every session that child is booked onto, in date order, on one screen"

This feature is **completely absent**:
- No endpoint to list a user's bookings
- No endpoint to list or select a child
- No UI to view a child's existing bookings
- Backend `/api/bookings` endpoint does not filter by user or child

This gap directly conflicts with Dana's stated blocker: "Last term I double-booked two children into overlapping sessions."

### 3. API Incompleteness
Missing endpoints for MVP scope:
- `GET /api/bookings` — list user's bookings (required for viewing existing bookings)
- `GET /api/children` — list or select a child to book
- No authorization check: booking creation doesn't validate that `childId` belongs to `accountId`

## Security Issues

### 1. Weak Session Secret (Line 9, src/server.js)
```javascript
secret: process.env.SESSION_SECRET ?? 'change-me'
```
Default fallback `'change-me'` would be critical vulnerability in production.

### 2. No Account Validation (Line 18, src/server.js)
```javascript
app.post('/api/sign-in', (req, res) => {
  req.session.accountId = req.body.accountId;
  res.json({ ok: true });
});
```
- Accepts any `accountId` from user input with no validation
- No verification account exists or belongs to requester
- No password or authentication mechanism

### 3. Missing Authorization on Booking (Line 25, src/server.js)
- `book()` doesn't verify `childId` belongs to `accountId`
- User could book children they don't own if they guess the childId

## Data Integrity Issues

### Booking ID Collision Risk (Line 35, src/bookings.js)
```javascript
const booking = { id: `b${state.bookings.length + 1}`, ... }
```
- IDs depend on array length, not a counter
- Deleting bookings leaves gaps; new bookings reuse old IDs
- ID collision possible with historical bookings

## Test Coverage Gaps

- Only 1 test case (happy path: listing sessions)
- Missing coverage for:
  - Booking creation (success, full session, missing child/session)
  - Cancellation (valid, unauthorized, non-existent)
  - Session availability logic
  - Edge cases (concurrent bookings, race conditions)

## What Works

✓ Backend API structure (Express, session middleware)  
✓ Database persistence (read/write to `bookings.json`)  
✓ Session protection on `/api/` routes  
✓ Cancellation authorization check (booking ownership)  
✓ Capacity validation (no overbooking)

## Minimum Requirements for Release

1. Implement full frontend UI (sign-in, session list, booking, view bookings, cancel, sign-out)
2. Add endpoint to list user's bookings filtered by child and session
3. Add child selection/listing endpoint
4. Implement real authentication (not trust user input for accountId)
5. Validate `childId` belongs to `accountId` on booking creation
6. Fix session secret handling (fail if not set via env var)
7. Fix booking ID generation (use UUID or persistent counter in state)
8. Expand test coverage to cover core booking flows and error cases
9. Document and enforce that `SESSION_SECRET` must be configured in production

## Verified

- Backend API structure and session management
- Database persistence layer
- Booking capacity constraints
- Test runner functionality
