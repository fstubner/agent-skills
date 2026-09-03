# Acceptance Review: Swim Session Booking Tool

**Verdict: BLOCK**

## Executive Summary

The swim session booking tool is incomplete and cannot fulfill its stated purpose. The frontend is missing entirely, and the backend API lacks critical functionality to meet the user's actual needs as documented in the project brief.

## Critical Blockers

### 1. Missing Frontend Implementation (BLOCK)

**Finding**: The frontend is not implemented. `public/index.html` contains only a stub:
```html
<!doctype html><title>Swim session booking</title><main id="app"></main>
```

**Impact**: The entire user interface described in `ux-walkthrough.md` (sign-in form, session list, booking button, etc.) does not exist. The application has no way for users to interact with it.

**Evidence**: File inspection shows zero client-side JavaScript. The walkthrough describes 5 steps including "Open the page. The sign-in form is shown" but no sign-in form exists.

---

### 2. Missing API Endpoint for User Bookings (BLOCK)

**Finding**: The backend provides no way to retrieve a user's current or past bookings.

**Available endpoints**:
- `POST /api/sign-in` - sign in
- `GET /api/sessions` - list **available** sessions only
- `POST /api/bookings` - make a booking
- `DELETE /api/bookings/:id` - cancel a booking (requires knowing booking ID)
- `POST /api/sign-out` - sign out

**Missing**:
- `GET /api/bookings` or similar to retrieve user's bookings

**Impact**: Users cannot see what sessions their child is already booked onto. This directly contradicts the user's stated primary need from `docs/brief-email.txt`:

> "pick a child, see every session that child is booked onto, in date order, on one screen"

**Evidence**: Code inspection of `src/server.js` shows no endpoint to retrieve bookings. The `availableSessions()` function in `bookings.js` filters out full sessions and provides no retrieval of existing bookings.

---

### 3. Mismatch Between Stated Product and User Need (BLOCK)

**Finding**: The documented product (in `PRODUCT.md`) diverges from the user's stated need.

**User's stated priority** (from Dana Whitlock's brief):
1. Primary: See what a child is booked onto, prevent double-booking
2. Secondary: Being able to book from the same screen

**Product as documented**:
- Success: "A parent can book a child onto an available session and see that the booking was taken"
- No mention of viewing existing bookings

**Impact**: The product as built cannot solve Dana's primary problem (preventing double-bookings by viewing a child's bookings).

**Note on Provenance**: `PRODUCT.md` is marked "reconstructed-from-code" meaning it was read from the implementation rather than derived from user requirements. This creates a circular validation where the documented product simply reflects incomplete code, rather than validating that the code meets actual needs.

---

## Additional Findings

### Session Secret Default (Security)
- `src/server.js` line 9: `secret: process.env.SESSION_SECRET ?? 'change-me'`
- The default session secret is hardcoded and trivial
- **Severity**: Security risk for production use
- **Mitigation**: Requires environment variable to be set before deployment

### Incomplete Test Coverage
- `test/bookings.test.js` contains only one test checking that sessions have a `taken` property
- No tests for: booking creation, cancellation, session full condition, or API endpoints
- **Severity**: Cannot verify behavior matches intent

### Missing Error Boundary
- Backend returns HTTP 409 for full session with `{ error: 'session full' }` but there is no frontend to display this message
- Backend returns HTTP 404 for cancellation of non-existent booking but no frontend handles this

### No Booking Retrieval Implementation
- The datastore (`bookings.js`) has no function to retrieve bookings for a specific user
- Building this is prerequisite to any working UI

---

## What Was Verified

✓ Backend Express server initializes with proper session configuration  
✓ Sign-in endpoint accepts account IDs  
✓ Booking creation checks capacity (returns null when full)  
✓ Cancellation checks account ownership  
✓ Package.json and main entry point are correctly configured  

## What Was Not Verified (Cannot Be Until Frontend Exists)

✗ Sign-in flow works end-to-end  
✗ Session list displays  
✗ Booking button responds to user interaction  
✗ Bookings actually get created when user submits  
✗ Cancellation works from UI  
✗ Viewing existing bookings works (function doesn't exist)  
✗ Empty/error/loading states render  
✗ Keyboard accessibility  
✗ Mobile viewport support  
✗ Error messages display to user  

---

## Release Readiness

**This product is not ready for release before the new term.**

**To proceed, the following must be implemented:**

1. **Frontend application** - Complete implementation of sign-in form, session list view, and booking/cancellation UI
2. **User bookings API** - New endpoint to retrieve current bookings for authenticated user (required for Dana's primary use case)
3. **Test coverage** - Tests for critical paths including booking, cancellation, and permission checks
4. **Environment configuration** - Session secret must be configured via environment variable (never commit default)
5. **User validation** - Walkthrough must be validated against actual user workflow (not reconstructed from code)

**Acceptance tier**: Hand to build team for implementation completion, then return for final acceptance when both frontend and user booking retrieval are implemented.
