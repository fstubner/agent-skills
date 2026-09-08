# Release Review: Swim Session Booking

## Status
**NOT READY FOR RELEASE** — Critical blockers identified.

## Critical Blockers

### 1. Frontend UI is Missing
**Severity: BLOCKER**

The `public/index.html` contains only a doctype and empty `<main>` element. There is no UI implementation:
- No sign-in form
- No session list display
- No booking UI
- No navigation or sign-out button
- No client-side JavaScript

The product cannot function without a frontend. This prevents all user-facing functionality from working.

### 2. Primary User Requirement Not Implemented
**Severity: BLOCKER**

The brief email from Dana Whitlock (docs/brief-email.txt) identifies the primary job as:
> "pick a child, see every session that child is booked onto, in date order, on one screen"

There is no API endpoint to fetch a child's current bookings. The backend only provides:
- `/api/sessions` — list available sessions (those with remaining capacity)
- `/api/bookings` — create a booking
- `/api/bookings/:id` — cancel a booking

A child's booking history is essential for the stated use case (preventing double-bookings and seeing booked sessions).

### 3. Authentication Bypass
**Severity: HIGH**

The `/api/sign-in` endpoint does not validate the `accountId`:
```javascript
app.post('/api/sign-in', (req, res) => {
  req.session.accountId = req.body.accountId;
  res.json({ ok: true });
});
```

Any user can sign in as any other user by simply providing their accountId in the request body. This allows:
- One parent to view/manage another parent's bookings
- Reception staff to impersonate parents
- Unauthorized booking cancellations

At minimum, an accountId should be validated (e.g., against a user registry or using a strong sign-in mechanism like password/PIN).

### 4. Unsafe Booking ID Generation
**Severity: MEDIUM**

Booking IDs are generated as `b${state.bookings.length + 1}`. This approach:
- Reuses IDs if bookings are deleted (e.g., if bookings array has 3 items and one is deleted, the next ID will still be `b4`, but after deletion the array length is 2, and if two items are added, we get `b3` which is a duplicate)
- Creates weak, sequential IDs that are predictable

**Impact:** If booking #3 is cancelled, and later booking #3 is assigned to a different booking, the old booking reference could collide with the new one. This violates data integrity.

**Fix:** Use cryptographically safe IDs (e.g., `crypto.randomUUID()` or similar).

## Medium Priority Issues

### 5. No Input Validation
The POST endpoints accept `req.body.childId` and `req.body.sessionId` with no validation. The server should:
- Verify childId and sessionId are non-empty strings
- Verify sessionId exists in the sessions list
- Reject malformed requests early

### 6. Race Condition on Booking Capacity
The `book()` function reads the entire state, checks capacity, and writes back:
```javascript
if (state.bookings.filter((b) => b.sessionId === sessionId).length >= target.capacity) return null;
// ... 
state.bookings.push(booking);
save(state);
```

If two concurrent requests arrive, both may see available capacity and both book the session, overselling it. A JSON file datastore cannot guarantee atomicity.

**Fix:** Add a lock or use serialized writes. At minimum, re-check capacity after loading state and before saving.

### 7. Test Coverage is Minimal
The only test checks that `availableSessions()` returns sessions with a `taken` field. There are no tests for:
- The booking flow
- Cancellation
- Edge cases (full session, non-existent session/booking)
- Authorization (cancelling someone else's booking)
- Concurrent bookings

### 8. No Environment Variable Validation
`process.env.SESSION_SECRET` defaults to `'change-me'` in development, but there's no warning or validation. Deploying to a leisure centre reception terminal without a strong secret leaves sessions vulnerable to hijacking.

## Product Alignment Issues

### 9. UX Walkthrough Doesn't Match Reality
The `ux-walkthrough.md` describes a complete user flow with sign-in, session list, booking, cancellation, and sign-out. However, only the backend exists—the entire UI is missing. The walkthrough is aspirational, not implemented.

### 10. Design Tokens Unused
The `design-tokens.json` and `design-direction.md` describe a specific color palette and typography (16px minimum, soonest-first ordering). These are not referenced anywhere in the code, suggesting the frontend was never built.

## Positive Observations

- **API design is reasonable:** The backend endpoints follow REST conventions and require authentication for protected routes.
- **Cancellation authorization is correct:** The `cancel()` function verifies that the booking belongs to the signed-in account (line 43 in bookings.js).
- **Session capacity logic is sound:** The filtering and capacity check logic is correct (aside from race conditions).
- **Clean code structure:** Separation of concerns between server.js, bookings.js, and data persistence is appropriate.

## What Was Verified

1. **Code review of all source files** (server.js, bookings.js, server startup logic)
2. **Examination of API endpoints** and request/response contracts
3. **Analysis of authentication and authorization** on protected routes
4. **Review of data integrity and ID generation strategy**
5. **Comparison of implementation against product requirements** (PRODUCT.md, brief-email.txt, ux-walkthrough.md)
6. **Assessment of test coverage** and data persistence safety
7. **Frontend completeness check** — index.html is empty

## Recommendation

**Do not release.** The product is not functionally complete. To proceed:

1. **Implement the frontend** with:
   - Sign-in form
   - Child selection
   - List of available sessions (with remaining places)
   - User's current bookings display
   - Booking and cancellation UI
   - Sign-out button

2. **Add API endpoint** to fetch a user's bookings:
   - `GET /api/my-bookings` — returns bookings for the signed-in accountId, sorted by session date

3. **Implement proper authentication:**
   - Add a user registry with passwords or PINs
   - Validate accountId against the registry during sign-in
   - Do not accept arbitrary accountIds

4. **Fix booking ID generation** to prevent collisions after deletions

5. **Add comprehensive tests** for booking, cancellation, authorization, and edge cases

6. **Address race conditions** in the booking flow (at minimum, re-check capacity before write)

The backend is a good foundation, but the product is only ~30% complete. The frontend, primary user workflow, and authentication are missing entirely.
