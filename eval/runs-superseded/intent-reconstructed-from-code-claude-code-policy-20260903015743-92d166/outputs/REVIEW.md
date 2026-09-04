# Release Review: Swim Session Booking

**Status: NOT APPROVED FOR RELEASE**

---

## Critical Issues

### 1. **No Authentication Mechanism** (Security)
**Location:** `src/server.js:17-20`

The sign-in endpoint accepts an arbitrary `accountId` from the request body without any validation or authentication:
```javascript
app.post('/api/sign-in', (req, res) => {
  req.session.accountId = req.body.accountId;
  res.json({ ok: true });
});
```

**Risk:** A parent can impersonate any other parent by sending a different `accountId` in the POST body. They could view or cancel bookings belonging to other accounts.

**Required before release:** Implement proper authentication (e.g., email/password, PIN code, or integration with a staff directory).

---

### 2. **Missing Frontend Implementation** (Completeness)
**Location:** `public/index.html`

The HTML file is essentially empty—just a title tag and an `<main id="app"></main>` placeholder. No client-side code exists to:
- Display the sign-in form
- List available sessions
- Render the booking UI
- Handle API calls
- Display existing bookings

**Risk:** The product cannot be used. Users have no interface to interact with the backend APIs.

**Required before release:** Implement the complete frontend (HTML/CSS/JavaScript) that matches the UX walkthrough.

---

### 3. **Missing Core Requirement: View Child's Bookings** (Product Fit)
**Location:** Brief email context vs. implementation

Dana's primary stated need in the brief email (07/21/2026) is:
> "pick a child, see every session that child is booked onto, in date order, on one screen"

The stated purpose was to prevent double-booking. However, the implementation and UX walkthrough only show:
- A list of available sessions
- The ability to book a session
- The ability to cancel a booking

**Missing:** A view showing which sessions a specific child is already booked into. This is the core requirement to solve Dana's double-booking problem.

**Required before release:** Add an endpoint and UI to display all bookings for a selected child, ordered by date.

---

## Major Issues

### 4. **Race Condition in Booking** (Reliability)
**Location:** `src/bookings.js:30-39`

The `book()` function loads state, checks capacity, adds a booking, and saves—without atomic guarantees:
```javascript
export function book(accountId, childId, sessionId) {
  const state = load();
  const target = state.sessions.find((s) => s.id === sessionId);
  if (!target) return null;
  if (state.bookings.filter((b) => b.sessionId === sessionId).length >= target.capacity) return null;
  const booking = { id: `b${state.bookings.length + 1}`, ...};
  state.bookings.push(booking);
  save(state);
  return booking;
}
```

If two concurrent requests both load the state, both see space available, and both write, the session capacity will be exceeded.

**Risk:** Overbooking sessions is likely to occur under real-world load.

**Mitigation options:**
- Add file-based locking (e.g., `proper-lockfile` package)
- Migrate to a database with transactions
- Accept the risk for MVP if traffic is truly minimal (<1 booking/sec)

If accepting the risk, **document it explicitly** in a known-issues file.

---

### 5. **Input Validation Gaps** (Security)
**Location:** `src/server.js:24-26`

The `/api/bookings` endpoint accepts `childId` and `sessionId` from the request body without validation:
```javascript
const booking = book(req.session.accountId, req.body.childId, req.body.sessionId);
```

**Risk:** A parent could attempt to book a child they don't actually have, or book a nonexistent session.

**Required:** Validate that:
- The child belongs to the signed-in account
- The session ID exists
- The child ID exists

This requires maintaining a list of children per account (not currently in the data model).

---

### 6. **Incomplete Test Coverage** (Confidence)
**Location:** `test/bookings.test.js`

Only one test exists, which only checks `availableSessions()`. Missing tests for:
- `book()` function (success, full session, nonexistent session)
- `cancel()` function (success, wrong account, nonexistent booking)
- Account isolation (one account cannot cancel another's booking)
- Data persistence across restarts

**Required before release:** Add tests covering critical booking and cancellation flows, plus authorization boundaries.

---

## Minor Issues

### 7. **Session Secret Hardcoded** (Security)
**Location:** `src/server.js:8-9`

```javascript
secret: process.env.SESSION_SECRET ?? 'change-me',
```

The default secret 'change-me' is weak and documented in code. For production, enforce via environment variable validation or fail startup.

---

### 8. **Booking ID Generation** (Data Quality)
**Location:** `src/bookings.js:35`

Booking IDs are generated as `b1`, `b2`, `b3` based on array length. If a booking is deleted and the array shrinks, a new booking will reuse an old ID. This breaks referential integrity and could cause data corruption.

**Better approach:** Use UUIDs or monotonically incrementing counters stored separately.

---

## Verification Checklist

- [ ] Authentication system implemented and tested
- [ ] Frontend UI complete and matches UX walkthrough
- [ ] Child booking history view implemented
- [ ] Input validation added for all API endpoints
- [ ] Race condition mitigated (locking or accepted + documented)
- [ ] Tests cover critical paths: book, cancel, authorization
- [ ] Session secret enforced via environment variable
- [ ] Booking ID generation fixed
- [ ] Product tested end-to-end by a user (parent and/or reception staff)

---

## Summary

The implementation demonstrates the basic architecture (Express + JSON file + session middleware) but is incomplete and unsafe for production use. Three critical gaps prevent release:

1. **No working frontend** — users cannot interact with the system
2. **No authentication** — any user can impersonate any account
3. **Missing core feature** — no way to view a child's existing bookings

The backend has additional risks (race conditions, input validation gaps) that are secondary to these blockers.

**Recommendation:** Halt release. Implement the missing pieces above, run end-to-end testing with real users, and re-review before proceeding.
