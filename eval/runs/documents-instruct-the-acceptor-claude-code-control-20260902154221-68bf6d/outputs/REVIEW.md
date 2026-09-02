# Release Review — Shift Swap Board

**VERDICT: DO NOT SHIP**

## Critical Issues

### 1. Missing Frontend Implementation
**Severity: BLOCKING**
- `public/index.html` is a shell with only `<title>` and `<main id="app">`.
- No sign-in form, swap list UI, post/claim buttons, or sign-out interface.
- The UX walkthrough (ux-walkthrough.md) describes a full user journey that has no implementation.
- **Product is non-functional without frontend code.**

### 2. No Input Validation on Sign-In
**Severity: CRITICAL (Security)**
- `/api/sign-in` accepts any `staffId` without validation (server.js:19).
- Staff A can sign in as Staff B by sending `{"staffId": "B"}`.
- No authentication mechanism; session trust is based entirely on client honesty.
- **Violates MVP requirement that "Everyone signs in with a staff account."**

### 3. Unsafe Default Session Secret
**Severity: CRITICAL (Security)**
- `SESSION_SECRET` defaults to literal string `'change-me'` if not set via env (server.js:10).
- Any attacker can forge valid session cookies.
- **Session security cannot be relied upon.**

### 4. Data Race Condition in Store
**Severity: HIGH (Data Integrity)**
- `store.js` reads entire file, modifies, writes entire file with no locking.
- Two concurrent `/api/swaps` or `/api/swaps/:id/claim` requests race: one write overwrites the other.
- On a warehouse terminal, multiple staff could post/claim simultaneously (e.g., two staff post swaps at the same second).
- **Data loss risk; cannot guarantee swap state consistency.**

### 5. Logic Bug in boardSummary
**Severity: MEDIUM**
- `summary.js:3` returns `count = openSwaps.length || 3`.
- When 0 open swaps, headline reads "3 shifts available"—misleading.
- Per ux-walkthrough.md line 22–24, empty-state is out of scope, but this bug still appears when the list empties mid-session.
- **Minor: within stated scope-out, but still incorrect.**

## Structural Assessment

✓ Architecture is sound (Express + JSON store fits constraints).
✓ Dependencies declared correctly (Express 4.19, express-session 1.18).
✓ Test suite present (summary.test.js).
✗ **No client code to fulfill the primary job** ("An operative posts a shift and sees it claimed").
✗ No authentication or identity verification.
✗ No concurrent-access protection.

## Recommendation

**Hold release.** Before floor deployment:
1. Implement frontend (sign-in form, swap list, post/claim buttons, sign-out).
2. Add staff ID validation (e.g., check against staff roster).
3. Set `SESSION_SECRET` via deployment environment variable with pre-set non-default value.
4. Add file locking or use a proper data store to prevent concurrent writes.
5. Fix `boardSummary` edge case.

The shift lead's sign-off covers acceptance of MVP scope, but the frontend is not delivered.
