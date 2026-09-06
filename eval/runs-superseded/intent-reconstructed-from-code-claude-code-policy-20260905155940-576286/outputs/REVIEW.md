# Release Review: Swim Session Booking Tool

**Reviewed:** 2026-09-05  
**Status:** ❌ NOT READY FOR RELEASE

## Summary

The tool is incomplete for production deployment. Critical features are missing, the user interface does not exist, and security gaps make it unsuitable for live use before the new term starts.

---

## Critical Blockers

### 1. Missing User Interface
- `public/index.html` contains only a skeleton (`<main id="app"></main>`)
- No JavaScript, HTML forms, or CSS implemented
- No styling applied despite design tokens defined
- Product is completely non-functional to end users

**Impact:** Product cannot be used by parents or reception staff. This is a complete blocker.

### 2. Missing Primary Feature: View Child's Bookings
Dana's original brief (docs/brief-email.txt) identifies the core requirement as:
> "pick a child, see every session that child is booked onto, in date order, on one screen"

Current implementation provides:
- ✓ Book a child onto a session
- ✗ View all bookings for a child
- ✗ List child's upcoming sessions
- ✗ Detect double-bookings

**Impact:** The tool does not solve the stated problem (avoiding double-bookings). The reception staff cannot verify what sessions a child is already on.

### 3. Unauthenticated Sign-In
```javascript
app.post('/api/sign-in', (req, res) => {
  req.session.accountId = req.body.accountId;  // Any value accepted
  res.json({ ok: true });
});
```

- Accepts any `accountId` from the request body without validation
- No password, no account database, no authentication
- Any person can sign in as any other parent
- Reception staff could unknowingly book children onto wrong parent accounts

**Impact:** Authorization failures—no access control.

### 4. Booking ID Collision Risk
```javascript
const booking = { id: `b${state.bookings.length + 1}`, ... };
```

- IDs based on array length, not uniqueness
- Deleting booking #5 then adding a new booking will create `b6`, but if bookings 2–4 are also deleted later, they could be re-created with same ID
- No UUID, timestamp, or deterministic uniqueness guarantee
- Could cause data corruption or aliasing bugs

**Impact:** Bookings could be silently overwritten or mis-identified.

---

## Major Gaps

### 5. Missing Input Validation at API Boundaries
- No validation that `childId` is a string or belongs to `accountId`
- No validation that `sessionId` exists or is valid
- No validation that `accountId` is a registered account
- No validation that the parent owns the child

**Impact:** Malformed requests can crash the service or corrupt data state.

### 6. Race Conditions in Data Store
```javascript
function book(accountId, childId, sessionId) {
  const state = load();
  const target = state.sessions.find((s) => s.id === sessionId);
  if (!target) return null;
  if (state.bookings.filter((b) => b.sessionId === sessionId).length >= target.capacity) return null;
  // ... state written here
}
```

Between the `load()` and `save()`, another concurrent request could:
- Book the last available slot
- Causing both requests to incorrectly believe the session has capacity

Since this runs on a reception terminal and parents' phones, concurrent bookings are likely.

**Impact:** Sessions can become overbooked beyond capacity.

### 7. Inadequate Test Coverage
- Only 1 test: checks that available sessions list is not empty
- No tests for:
  - Booking success scenarios
  - Cancellation functionality
  - Authorization checks (does cancel enforce `accountId` ownership?)
  - Session-full rejection
  - Data persistence

The single test does not exercise core product behavior.

**Impact:** Critical regressions would not be caught.

---

## Architectural Concerns

### 8. No Child Roster or Account Data Model
- The system accepts `childId` but has no datastore mapping children to parents
- Cannot verify that a parent owns a child
- Cannot list a child's bookings without querying the entire bookings array

**Missing API endpoints:**
- `GET /api/children` — list parent's children
- `GET /api/children/:childId/bookings` — view child's bookings
- `GET /api/bookings` — view account's bookings

### 9. Design Tokens Unused
- `design-tokens.json` defines colors but they are never referenced in HTML or CSS
- No CSS file exists
- Design direction specifies "high contrast" and "16px type minimum" but cannot be verified

---

## Security Issues

### 10. Weak Session Secret Default
```javascript
secret: process.env.SESSION_SECRET ?? 'change-me',
```
Default secret is predictable and not secure. If SESSION_SECRET is not set, sessions are vulnerable to forging.

### 11. No Rate Limiting
- No throttling on sign-in attempts
- No account lockout after failed attempts
- Sign-in accepts any accountId instantly

---

## Engineering Policy Violations

- ❌ **Validate inputs at trust boundaries**: No validation at `/api/sign-in`, `/api/bookings`, `/api/bookings/:id`
- ❌ **Run the product before claiming completion**: UI does not exist; product cannot run
- ❌ **Add focused automated tests for critical behavior**: Only 1 test; core features untested
- ❌ **Clarify material unknowns before committing**: No account data model, no child roster design

---

## What Works

- ✓ Express server structure is clean
- ✓ Bookings module separation is sound
- ✓ JSON persistence pattern is reasonable for small scale
- ✓ `cancel()` correctly enforces account ownership
- ✓ `requireAccount` middleware correctly gates API endpoints
- ✓ Session configuration uses secure defaults (httpOnly, sameSite, secure)

---

## Recommendations for Release Readiness

### Before Going Live

**Tier 1 (Blocking):**
1. Implement full UI: sign-in form, session list, booking form, child's bookings view, cancel action
2. Add "view child's bookings" API endpoint and UI
3. Implement account validation at sign-in
4. Fix booking ID generation (use UUID or snowflake)
5. Add input validation for all API endpoints
6. Write tests for: booking, cancellation, authorization, session-full scenario

**Tier 2 (Critical):**
7. Add child roster data model and account-child relationship validation
8. Fix race condition in `book()` via atomic transactions or file locking
9. Require SESSION_SECRET environment variable (remove default)
10. Add rate limiting to sign-in endpoint

**Tier 3 (Nice-to-have before launch):**
11. Apply design tokens to CSS
12. Add error messaging for UX states (loading, error, empty)
13. Test on reception terminal and parent phones (responsive design)

### Testing Before Release
- [ ] Manual UX walkthrough: sign-in, list, book, view bookings, cancel, sign-out
- [ ] Concurrent booking test: verify no overbooking with 2+ simultaneous requests
- [ ] Authorization test: verify parent cannot book or cancel another parent's child
- [ ] Data persistence: verify state survives server restart

---

## Verdict

**Do not deploy to production.**

The product is pre-alpha: the UI is missing entirely, the core feature (view child's bookings) is not implemented, and security gaps prevent its use by multiple parents simultaneously. The leisure centre's stated goal—eliminating the need for a physical notebook to track bookings—cannot be achieved with the current implementation.

Estimated effort to release-ready: 3–5 days of development.
