# Release Review

**Status**: NOT READY FOR RELEASE

## Summary

The booking tool has a critical-path implementation gap and multiple security and correctness issues that make it unsuitable for production deployment.

## Blocking Issues

### 1. Missing Frontend Implementation (CRITICAL)
- **Location**: `public/index.html`
- **Issue**: The HTML file contains only a doctype, title, and empty `<main id="app"></main>` element. No UI, CSS, or JavaScript is implemented.
- **Impact**: The product cannot be used at all. The UX walkthrough describes a sign-in form, session list, booking interface, and cancellation UI, none of which exist.
- **Required Before Release**: Full frontend implementation with the workflows described in `ux-walkthrough.md`.

### 2. Broken Authentication (CRITICAL)
- **Location**: `src/server.js`, line 18
- **Issue**: The `/api/sign-in` endpoint accepts any `accountId` from the request body without validation: `req.session.accountId = req.body.accountId`. A parent can sign in as any other account without authorization.
- **Impact**: Full account takeover; any user can book onto sessions for any parent's children.
- **Required Fix**: Implement credential validation against a trusted source (e.g., centre registration database, parent credentials, PIN, etc.).

### 3. Hardcoded Session Secret (CRITICAL)
- **Location**: `src/server.js`, line 9
- **Issue**: `process.env.SESSION_SECRET ?? 'change-me'` defaults to the literal string `'change-me'`.
- **Impact**: Sessions are cryptographically weak by default; a facility running this without explicitly setting `SESSION_SECRET` will be compromised.
- **Required Fix**: Remove the default or make the app exit if `SESSION_SECRET` is not set, forcing explicit configuration.

## High-Severity Issues

### 4. Booking ID Collision (HIGH)
- **Location**: `src/bookings.js`, line 35
- **Issue**: IDs are generated as `b${state.bookings.length + 1}`. If bookings are cancelled, the next booking will reuse IDs (e.g., delete booking 5, add booking 6 → same ID).
- **Impact**: Data corruption; cancellations could delete the wrong booking or cause ID confusion in long-term operation.
- **Required Fix**: Use UUID, timestamp-based IDs, or a persistent counter in the state file.

### 5. Missing Input Validation (HIGH)
- **Location**: `src/server.js`, lines 24–25
- **Issue**: `accountId`, `childId`, and `sessionId` are not validated before use. Malformed input could crash the server or corrupt data.
- **Impact**: Denial of service; data corruption.
- **Required Fix**: Validate all inputs:
  - `childId` and `sessionId` must be non-empty strings matching expected format.
  - `accountId` is validated per issue #2.

### 6. Double-Booking via Race Condition (HIGH)
- **Location**: `src/bookings.js`, lines 30–38
- **Issue**: The `book()` function loads state, checks capacity (line 34), then saves (line 37). Between check and save, another request could fill the session.
- **Impact**: Sessions can be overbooked beyond capacity.
- **Required Fix**: Acquire a file lock during load→check→save, or use atomic write-and-verify pattern.

## Medium-Severity Issues

### 7. Incomplete Test Coverage (MEDIUM)
- **Location**: `test/bookings.test.js`
- **Issue**: Only one test for `availableSessions()`. No tests for:
  - `book()` function (normal case, capacity check, return value).
  - `cancel()` function (authorization check, delete confirmation).
  - Authorization boundaries in server routes.
- **Impact**: Cannot verify core booking and cancellation logic; authorization bugs go undetected.
- **Required Fix**: Add tests for book, cancel, and authorization cases (minimum: success path, capacity full, wrong owner cancellation).

### 8. No Input Sanitization on Session Creation (MEDIUM)
- **Location**: `src/bookings.js`, line 22
- **Issue**: If `startsAt` or other fields from the JSON file are malformed, the API will return invalid data. No validation of session structure.
- **Impact**: Client-side crashes due to unexpected data types.
- **Required Fix**: Validate session schema when loading state.

### 9. Unhandled JSON Parse Failures (MEDIUM)
- **Location**: `src/bookings.js`, line 7
- **Issue**: If `.data/bookings.json` is corrupted or truncated, `JSON.parse()` fails silently and the app reinitializes with seed data, losing all bookings.
- **Impact**: Bookings can disappear without warning.
- **Required Fix**: Log errors, or refuse to start if the file exists but is invalid.

## Remaining Uncertainties

1. **Registration of children and parents**: The system assumes `accountId` and `childId` are already known. Where do these come from? How are they issued? (Material unknown per policy baseline.)
2. **Session data source**: Sessions are seeded with hardcoded start times. How are sessions added/removed for real operation?
3. **HTTP-only deployment**: The `secure: true` cookie flag assumes HTTPS, but the architecture document makes no mention of TLS setup. Will the centre's network support HTTPS?

## Verification Completed

- ✅ Code structure review (architecture.md matches implementation).
- ✅ Dependency check (Express and express-session pinned to safe versions).
- ✅ Test execution (1 test passes; coverage is incomplete).
- ✅ Build check (npm start scaffolding works; requires NODE_ENV handling for production).
- ✅ Authentication and authorization logic inspection.
- ✅ Booking logic and race condition analysis.
- ✅ Frontend completeness check (failed).

## Recommendation

**Do not deploy.** Fix issues 1–6 (blocking/critical) and 7–8 (high/medium) before considering release. Clarify uncertainties 1–3 with the leisure centre before finalizing authentication and session management design.

Estimated work to fix blocking issues: 2–3 days (frontend + auth system + race condition handling).
