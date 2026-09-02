# Release Verdict: NOT READY

**Date:** 2026-09-02  
**Reviewer:** Independent review  
**Target deployment:** Monday, 2026-09-08

## Executive Summary

The room booking tool has **5 blocking issues** and is **not ready for production**. Core functionality is incomplete (no UI, no calendar integration), and authentication is severely broken. Do not deploy Monday.

---

## Critical Blockers

### 1. No Authentication — Any User Can Sign In As Anyone (CRITICAL)
**Location:** `src/server.js:18-20`

The `/api/sign-in` endpoint accepts any `staffId` without validation:
```js
app.post('/api/sign-in', (req, res) => {
  req.session.staffId = req.body.staffId;
  res.json({ ok: true });
});
```

**Risk:** Staff can trivially impersonate colleagues, book rooms under their name, and cancel their bookings. Privacy violation; unusable without a real auth layer.

**Required fix:** Integrate with your staff directory or SSO system. Validate staffId against a known roster. Do not trust client input.

---

### 2. Client-Side Code Missing — UI Does Not Exist (CRITICAL)
**Location:** `public/index.html`

The HTML is empty shell:
```html
<!doctype html><title>Room booking</title><main id="app"></main>
```

The ux-walkthrough describes sign-in, booking, list, cancel, sign-out flows. None of this is implemented. Staff cannot actually use the product.

**Required fix:** Implement the full UI per the walkthrough. Requires React, Vue, plain JS, or similar.

---

### 3. Room Availability Never Checked — Calendar Service Unused (CRITICAL)
**Location:** `src/calendar.js`, unused in `src/bookings.js`

The system reads the building's calendar service (which indicates which rooms are out of service) but never calls it. Bookings are checked only against local data.

**Scenario:** Room Ash is blocked for maintenance on 2026-09-05 (calendar says so). User books Ash for that day via this tool. Now Ash appears available in the tool but unusable in the building. Staff walks to the room and finds a sign.

**Required fix:** Before creating a booking, call `roomsOutOfService(date)` and reject any room that is out of service. This must happen in `src/bookings.js:create()`.

---

### 4. Race Condition in Bookings — Double Bookings Possible in Concurrent Requests (HIGH)
**Location:** `src/bookings.js:23-30`

The create flow is not atomic:
```js
export function create(staffId, booking) {
  const state = load();
  if (state.bookings.some((b) => b.room === booking.room && b.slot === booking.slot)) return null;
  const record = { id: `bk${state.bookings.length + 1}`, staffId, ...booking };
  state.bookings.push(record);
  save(state);
  return record;
}
```

Two concurrent requests can both read the same state before either writes, both pass the duplicate check, and both write new bookings. Result: same room/slot booked twice.

**Required fix:** Use synchronous file operations or a locking mechanism. Or switch to a proper database. Test with concurrent requests.

---

### 5. Booking IDs Are Predictable — Guessable Across Users (MEDIUM)
**Location:** `src/bookings.js:26`

ID is `bk${state.bookings.length + 1}`. Anyone who can guess there are ~10 bookings can try `bk1`, `bk2`, … and attempt to cancel any of them (though the cancellation route does filter by staffId, so impact is limited to privacy leakage).

**Required fix:** Use cryptographically random IDs (e.g., `crypto.randomUUID()`).

---

## Secondary Issues

### 6. Session Secret Not Changed in Production (MEDIUM)
**Location:** `src/server.js:10`

Default: `secret: process.env.SESSION_SECRET ?? 'change-me'`

If SESSION_SECRET is not set, sessions are signed with a hardcoded default. Any attacker knowing the default can forge session tokens.

**Required fix:** Fail at startup if SESSION_SECRET is not set. Never use a default.

---

### 7. Sign-Out Endpoint Is Not Protected (LOW)
**Location:** `src/server.js:40`

```js
app.post('/api/sign-out', (req, res) => req.session.destroy(() => res.json({ ok: true })));
```

No `requireStaff` middleware. An attacker can forge a sign-out request for anyone. Minor impact (session destruction) but inconsistent with the other protected routes.

**Required fix:** Add `requireStaff` middleware or at least check the session exists.

---

## Test Coverage

Tests exist for validate and bookings but:
- No server integration tests
- No calendar service mocking
- No concurrent request tests
- No authentication tests

---

## What Works

- Input validation (room, slot, attendees) is sound
- Booking cancellation correctly filters by staffId
- Slot format (half-hour, 08:00–17:30) is reasonable

---

## Deployment Risk Assessment

| Issue | Severity | Deployment | Likelihood | Impact |
|-------|----------|-----------|------------|---------|
| No auth | Critical | Block | 100% | Unusable, privacy loss |
| No UI | Critical | Block | 100% | Non-functional |
| Calendar unchecked | Critical | Block | High | Wrong availability info |
| Race condition | High | Block | Medium | Double bookings |
| Predictable IDs | Medium | Block | Low | Privacy leak |
| Session secret default | Medium | Block | Medium | Session forgery |
| Sign-out unprotected | Low | Block | Low | Minor DoS |

---

## Recommendation

**Do not deploy.** Estimated effort to resolve:
- Authentication: 2–5 days (depends on integration with staff directory)
- UI: 3–7 days (depends on complexity preference)
- Calendar integration: 1–2 days
- Race condition fix: 1 day
- Predictable IDs + session secret: 1 day
- Testing: 2–3 days

**Earliest safe deployment:** 2026-09-15 (with sustained work).

---

## Verified

- Code review of server, validation, bookings, and calendar modules
- Test suite syntax and coverage (not executed; approval pending)
- Architecture alignment with PRODUCT.md and design docs
- Authentication flow (broken) and session management (weak defaults)
- File-based persistence and concurrency model
- Input validation and authorization boundaries
- Absence of client-side code

**Remaining uncertainty:** Test execution not run due to permission constraints; UI mockup/design tokens exist but implementation missing.
