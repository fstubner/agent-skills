# Release Review

**Status:** ❌ **NOT READY FOR PRODUCTION**

**Date:** 2026-09-05  
**Reviewer:** Independent code review

---

## Critical Blockers

### 1. Missing Frontend UI Code
**Severity:** BLOCKER  
The entire client-side application is missing. `public/index.html` contains only an empty shell:
```html
<!doctype html><title>Room booking</title><main id="app"></main>
```

There is no JavaScript to render the sign-in form, booking list, book/cancel functionality, or any UI. The product cannot be used in this state.

**Required:** Complete client-side implementation with:
- Sign-in form
- Booking list (soonest first)
- Room/slot selection and booking form
- Booking cancellation
- Sign-out
- Error and empty states per the walkthrough

### 2. Calendar Service Integration Missing
**Severity:** BLOCKER  
Architecture declares "room availability is mastered by the building's calendar service" and "this product reads it and never writes to it." However:
- `src/calendar.js` is never imported or called by `src/server.js`
- No validation checks if a room is out of service before allowing a booking
- Users can book rooms the calendar service marks unavailable

The POST `/api/bookings` endpoint accepts any valid room/slot pair without checking the calendar. This defeats the entire premise of reading from the calendar service.

**Required:** 
- Import and call `roomsOutOfService()` in the booking validation flow
- Reject bookings for rooms/slots marked out-of-service
- Add tests verifying the behavior

### 3. Session Secure Flag Breaks Development
**Severity:** CRITICAL  
`src/server.js` line 23 sets `secure: true` unconditionally:
```javascript
cookie: { httpOnly: true, sameSite: 'lax', secure: true },
```

This forces cookies over HTTPS only. Development environments (http://localhost:3000) will have no session cookie set, making login impossible. The server must differentiate:

```javascript
cookie: { 
  httpOnly: true, 
  sameSite: 'lax', 
  secure: process.env.NODE_ENV === 'production' 
}
```

---

## Additional Issues

### 4. Missing Static File Serving
The Express app has no route to serve `public/index.html`. Adding a missing line is needed:
```javascript
app.use(express.static('public'));
```

The `<!doctype html>` must be reachable at `/` so clients can load the app shell.

### 5. No Fallback Route for SPA
Single-page applications typically need a fallback route. Consider:
```javascript
app.get('/', (req, res) => res.sendFile(path.join(process.cwd(), 'public/index.html')));
```

This ensures the app shell loads even if a client bookmarks a deep URL.

### 6. Dead Code
`src/calendar.js` is defined but never imported. It should either be removed or integrated into the booking flow (see blocker #2).

---

## Tests
✓ All unit tests pass (9/9)
- Bookings correctly filtered by staff
- Double-booking prevention works
- Isolation: users cannot cancel others' bookings
- Validation: rooms, slots (8:00–17:30, half-hour), attendee counts (1–20)
- Edge case: undefined body handled gracefully

Backend unit tests alone are insufficient for release. **Required:** End-to-end tests verifying the full sign-in → book → cancel → sign-out flow per `ux-walkthrough.md`.

---

## Architecture vs. Implementation

The following claims in `ARCHITECTURE.md` are not met:
- ✓ "Express app: sign-in, list own bookings, book, cancel, sign out" — API endpoints exist
- ✗ "read-only client for the building's calendar service" — imported but unused
- ✓ "single writer of `.data/`" — bookings.js correctly centralizes writes
- ✗ "staff id, so one person cannot read or cancel another's booking" — filters are correct, but no calendar check

---

## Security Observations
- ✓ Staff list is validated against a fixed roster, not trusting request body
- ✓ Session-based access control enforced on /api/* routes
- ✓ httpOnly and sameSite flags present (but secure flag misconfigured)
- ⚠ No CSRF protection visible (express-session default does not include CSRF tokens)
- ✓ Booking deletion filtered by session staff id

---

## Recommendation

**Do not deploy.** The product is missing its entire frontend and core calendar integration. The blockers listed above must be resolved and verified with end-to-end testing before the office manager can replace the paper sheets. Estimate: 2–3 days of development and testing.

