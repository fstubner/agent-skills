# Release Review: Room Booking Tool

**Date:** 2026-09-02  
**Verdict:** ❌ NOT READY FOR PRODUCTION

---

## Summary

The room booking tool has a functioning backend API with proper session management and authorization, but is missing critical components required for production deployment. The product cannot fulfill its intended purpose—replacing paper sheets on Monday—without these implementations.

---

## Critical Blockers

### 1. Missing User Interface (Blocker)
The `public/index.html` contains only a document skeleton with no UI implementation:
- No JavaScript to call the API endpoints
- No HTML elements for sign-in, booking form, or bookings list
- No CSS or styling
- Design tokens are defined in `design-tokens.json` but not used anywhere

The UX walkthrough (ux-walkthrough.md) specifies required user flows and design requirements, but none of it is implemented. Staff cannot book rooms without a UI.

### 2. Missing Calendar Service Integration (Blocker)
The architecture states: "Room availability is mastered by the building's calendar service — this product reads it and never writes to it."

However:
- `src/calendar.js` exists with an async function `roomsOutOfService()` but is never imported or called
- The booking API (`POST /api/bookings`) does not check room availability against the calendar before confirming a booking
- This violates the single source of truth for availability and could allow bookings that conflict with out-of-service periods

The `create()` function in `src/bookings.js` only checks for duplicate bookings in local storage; it has no visibility into building calendar events.

---

## Security & Trust Boundary Issues

### 3. No Staff ID Validation
The `/api/sign-in` endpoint accepts any `staffId` from the request body without validation:
```javascript
app.post('/api/sign-in', (req, res) => {
  req.session.staffId = req.body.staffId;
  res.json({ ok: true });
});
```

This allows anyone to impersonate any staff member. The sign-in should validate against an actual staff directory or allowlist.

### 4. Weak Default Session Secret
Line 10 in `src/server.js`: `secret: process.env.SESSION_SECRET ?? 'change-me'`

The hardcoded default is insecure. While the code requires setting `SESSION_SECRET` via environment variable for production, this is a footgun during development and deployment.

---

## Design Discrepancies

### 5. Color Token Mismatch
- `design-direction.md` specifies accent color `#1B6B54` and text color `#12211C`
- `design-tokens.json` defines accent as `#0B6E4F` and text as `#14302A`

These conflicts must be resolved before UI implementation.

---

## What Works

✅ **Backend API structure** — Express endpoints are properly organized  
✅ **Session management** — Secure cookie configuration (httpOnly, sameSite, secure)  
✅ **Authorization** — Users can only view and cancel their own bookings  
✅ **Request validation** — Booking fields validated for room, slot, and attendee count  
✅ **Data persistence** — JSON file storage works; recovery handles missing files  
✅ **Unit tests** — Cover happy path and key edge cases (double booking, unauthorized cancel)

---

## Remediation Required

### Before Production Deployment

1. **Implement the UI** (high effort)
   - Create `public/app.js` with client-side logic for sign-in, bookings list, booking form, cancellation
   - Create `public/style.css` with design tokens applied
   - Ensure design meets specifications in `design-direction.md` (16–18px minimum text, 56px tap targets, accent color used correctly)

2. **Integrate calendar service** (medium effort)
   - Import and call `roomsOutOfService()` in the booking creation logic
   - Reject bookings for rooms that are out of service on the requested date
   - Handle calendar API errors gracefully

3. **Add staff ID validation** (low effort)
   - Validate `staffId` format and/or check against an allowlist
   - Return 401 for invalid staff IDs
   - Document the expected staff ID format

4. **Resolve design token colors** (low effort)
   - Confirm correct colors with the office manager
   - Update `design-tokens.json` to match the agreed specification

5. **Set secure defaults** (low effort)
   - Remove the `'change-me'` default; require `SESSION_SECRET` to be set
   - Or use a random default on startup with a warning

### Testing Before Rollout

- Full walkthrough test per `ux-walkthrough.md`
- Verify calendar availability blocks bookings correctly
- Load testing: confirm JSON storage scales adequately for "a few hundred bookings a month" across three rooms
- UI accessibility review (text size, contrast, tap targets on tablet)

---

## Recommendation

**Do not deploy Monday.** The product lacks the UI entirely and does not read from the authoritative calendar source. Implementation is needed before it can replace the paper sheets. Estimated timeline: 2–3 days for UI, calendar integration, and validation.

Coordinate with the office manager on the new rollout date once work begins.
