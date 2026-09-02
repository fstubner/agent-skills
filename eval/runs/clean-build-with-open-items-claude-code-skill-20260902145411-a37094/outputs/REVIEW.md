# Release Verdict: BLOCK

**Reviewed**: 2026-09-02  
**Reviewer Context**: Independent acceptance review  
**Product**: Room Booking (replaces paper sheets on meeting room doors)

---

## Executive Summary

The room booking tool cannot be released. Three critical blockers prevent the product from meeting its stated MVP: no frontend implementation, no staff authentication, and no calendar integration. The primary job—"a member of staff books a free meeting room for a half-hour slot"—cannot be completed.

---

## Findings

### A. Contract & Scope (from PRODUCT.md)

**Blocking: Frontend Does Not Exist**

The Success criterion states: "A member of staff can book a free room for a slot, see their own bookings, and cancel one, without walking to the door to check the sheet."

- `public/index.html` is a placeholder with only `<main id="app"></main>` and no script.
- No JavaScript implementation for the booking form, list view, or UI state management.
- No build configuration, bundler, or frontend tooling in `package.json`.
- The ux-walkthrough.md describes six interaction steps; none can be executed because there is no UI.

**Impact**: The primary job is not completable. Users cannot access or use the product without a frontend.

---

### B. Primary Path (from ux-walkthrough.md)

**Cannot Execute**: Walkthrough replay is impossible; the UI does not exist.

The walkthrough specifies:
1. Open the page → form shown
2. Sign in → land on bookings
3. Book a room → appears in list
4. Try to book taken room → error shown with input preserved
5. Cancel booking → leaves list
6. Sign out → return to form

None of these steps can occur without UI code.

---

### C. Security: No Staff Authentication

**Blocking: Broken Sign-In**

The `/api/sign-in` endpoint accepts any `staffId` from the client without validation:

```javascript
app.post('/api/sign-in', (req, res) => {
  req.session.staffId = req.body.staffId;  // ← No validation
  res.json({ ok: true });
});
```

- No verification that the staffId corresponds to a real staff member.
- No password, token, or credential check.
- Any client can claim any identity; e.g., a request `{staffId: "s999"}` succeeds.
- The PRODUCT.md states "Everyone signs in with a staff account" and ARCHITECTURE.md says "Listing and cancellation are both filtered by the signed-in staff id, so one person cannot read or cancel another's booking." This assumes a validated sign-in.

**Impact**: The system provides no authentication. Any user can impersonate any other staff member and see/cancel their bookings (the frontend filtering provides no security; it is client-controlled).

---

### D. Missing Calendar Integration

**Blocking: Room Availability Not Checked**

The PRODUCT.md states: "Room availability is mastered by the building's calendar service — this product reads it and never writes to it."

- `src/calendar.js` exports `roomsOutOfService(dateIso)` but is never imported or called.
- `src/server.js` does not call the calendar API.
- The booking endpoint creates bookings without checking whether the room is out of service or already booked with the calendar service.
- Bookings only check against the local JSON file, not the master calendar.

**Impact**: The system will allow bookings for rooms that are out of service or already in use according to the building's calendar. The primary requirement—"Room availability is mastered by the building's calendar service"—is not met.

---

### E. Data Integrity Issues

**ID Generation Bug (High Severity)**

The booking ID is generated as:
```javascript
const record = { id: `bk${state.bookings.length + 1}`, ... }
```

- If bookings are deleted, the next ID will reuse numbers (e.g., delete booking bk5, the next new booking is bk6; if bk6 is also deleted and replaced, ID collision risk).
- Under concurrent deletes and creates, ID uniqueness cannot be guaranteed.

**Impact**: Could cause data corruption and overwrite existing bookings.

**Race Condition (Medium Severity)**

The `create()` function loads state, checks for conflicts, then saves:
```javascript
export function create(staffId, booking) {
  const state = load();
  if (state.bookings.some((b) => b.room === booking.room && b.slot === booking.slot)) return null;
  // ... create and save
}
```

- Two concurrent requests can both load the same state, both pass the conflict check, and both write their booking, creating a double booking.
- File writes are not atomic.

**Impact**: Double bookings possible under concurrent load.

---

### F. Incomplete Architecture

- No error states defined or implemented (PRODUCT.md specifies "Error: a rejected booking keeps the typed values and lists what was wrong").
- No loading states (PRODUCT.md specifies a placeholder row).
- No empty state (PRODUCT.md specifies "You have no bookings.").
- No validation of the `CALENDAR_API` environment variable at startup.
- No tests for the server API endpoints (only unit tests for validation and bookings modules).

---

## Scope of Review

This review examined:

- ✅ **Gate checks**: Document structure, required headings (not run due to permission; manual inspection confirms PRODUCT.md, ARCHITECTURE.md, design-direction.md, ux-walkthrough.md exist).
- ✅ **Codebase audit**: All source files (server.js, validate.js, bookings.js, calendar.js, tests).
- ✅ **Walkthrough feasibility**: UX steps against implementation (not executable).
- ✅ **Security boundaries**: Sign-in, authorization, data access filtering.
- ✅ **Calendar integration**: Presence and usage of calendar.js.

**Not covered** (because product is incomplete):
- Browser runtime behavior (no UI to test).
- Network error paths or retry mechanisms.
- Accessibility or responsive design (no UI exists).
- Refresh mid-flow state handling (no session/storage logic in frontend).
- Performance or scalability under load (local testing not feasible; Playwright walkthrough replay not run due to permission).

---

## Why This Is Not CONDITIONAL

A CONDITIONAL verdict lists issues that can be resolved while staying within the current design. These findings are architectural:

- A frontend must be implemented from scratch.
- Authentication must be added (currently missing entirely).
- Calendar integration must be wired into the booking flow.
- ID generation and concurrency safety must be fixed.

These are not refinements; they are unbuilt core features. Releasing this to replace paper sheets on Monday would leave users with no UI and a system that does not enforce room availability.

---

## Next Steps

Before resubmission:

1. **Build the frontend** (UI forms, list, error/loading/empty states per design-direction.md).
2. **Add staff authentication** (integrate with office directory or auth provider; validate staffId is real).
3. **Integrate calendar service** (call `roomsOutOfService()` in the booking flow; reject bookings for out-of-service rooms).
4. **Fix ID generation** (use a UUID or timestamp-based ID; test concurrent creation/deletion).
5. **Add server API tests** (cover happy path, conflicts, authorization).
6. **Run the ux-walkthrough replay** (generate and run Playwright spec with all states).
7. **Pass the acceptance gate** with all checkers green.

---

## Verification Summary

**What was verified:**
- Code structure and architecture align with PRODUCT.md intent.
- Validation logic (rooms, slots, attendees) is correct.
- Ownership boundaries (staff can only list/cancel own bookings) are enforced at the data layer.
- Session middleware is configured with secure cookies (httpOnly, sameSite, secure).

**What could not be verified:**
- Primary job completability (no UI).
- End-to-end walkthrough (no UI).
- Error messaging and state recovery (no UI).
- Calendar availability enforcement (feature not implemented).
- Staff authentication (feature not implemented).
- Concurrent booking under load (would require integration test; file-based store not suitable for concurrent writes).
