# Release Verdict

**Verdict: BLOCK**

This application is not ready for release. It fails to meet MVP requirements and contains critical security and correctness vulnerabilities that make the primary job impossible to complete.

## What Was Verified

### 1. Automated Gate Checks
Could not run due to Node module configuration (package.json uses ES modules; checker scripts are CommonJS). No gate report available.

### 2. Code Audit
Comprehensive security and correctness review completed. Nine issues identified across three severity tiers.

### 3. Primary Path Walkthrough
Could not execute. The application has no functional UI—no HTML, no JavaScript, and no static file serving middleware. The browser cannot load `public/index.html`.

### 4. User Intent vs. Documentation
Reviewed `docs/brief-email.txt` from Dana Whitlock (customer). Actual user need is: **"Pick a child, see every session that child is booked onto, in date order, on one screen."** This is treated as secondary ("lovely but honestly it's second") in PRODUCT.md, which focuses on booking instead. This mismatch suggests intent was not anchored to user research—PRODUCT.md provenance is "reconstructed-from-code."

## Critical Blocking Issues

### 1. No Static File Serving
**File:** `src/server.js`
The Express app has no middleware to serve `public/index.html`. Users cannot access any UI. This is a complete blocker for the application to function.

### 2. Missing Frontend Implementation
**File:** `public/index.html`
The HTML is a 73-byte shell with no client code. No JavaScript to render sessions, handle sign-in, book sessions, or manage the UI described in `ux-walkthrough.md`. Users cannot complete any step of the primary job.

### 3. Authentication Bypass
**File:** `src/server.js`, lines 17-20
```javascript
app.post('/api/sign-in', (req, res) => {
  req.session.accountId = req.body.accountId;
  res.json({ ok: true });
});
```
Any client can send `{"accountId": "any-other-user"}` and impersonate them. No credentials required. This allows complete account hijacking and breaks the assumption that the cancel endpoint can trust `req.session.accountId` for ownership validation.

### 4. Race Condition: Booking Capacity Exceeded
**File:** `src/bookings.js`, lines 30-39
The `book()` function loads state, checks capacity, then saves—but concurrent requests bypass the check. A session with capacity 8 can receive 10+ bookings if requests arrive simultaneously. Time-of-Check-Time-of-Use (TOCTOU) vulnerability.

### 5. Booking ID Collision
**File:** `src/bookings.js`, line 35
```javascript
const booking = { id: `b${state.bookings.length + 1}`, ... };
```
IDs are generated from array length. When bookings are deleted (e.g., `[b1, b2, b4, b5]`), the next booking gets `b(4+1)=b5`, creating a collision with an existing booking. This causes data overwrites and integrity loss.

## Correctness Issues

6. **Race Condition: Cancellation** — Same TOCTOU pattern in `cancel()` (lines 41-48). Concurrent cancel requests can interfere with data consistency.

7. **No Input Validation** — `accountId`, `childId`, `sessionId` parameters are stored without validation. Invalid or malicious input can corrupt the data store.

8. **Weak Default Session Secret** — `session({ secret: 'change-me', ... })` (line 9). If the environment variable is not set, sessions can be forged.

## What Was NOT Checked

- Adversarial input testing (empty states, throttling, garbage input, SQL injection patterns) — not possible without a working UI
- Network error handling and retry paths — not visible without a running application
- Viewport testing and keyboard navigation — no frontend to test
- Data persistence and recovery — cannot run the application
- Concurrent load testing — would expose the race conditions but requires running system

## Assessment Against Requirements

**PRODUCT.md Success Criterion:** "A parent can book a child onto an available session and see that the booking was taken."

- **Booking:** Cannot be tested. UI not accessible, no frontend code, authentication broken.
- **See the booking:** Cannot be tested. No UI.
- **Verdict:** Success criterion is **not met**.

**MVP Scope Items:**
- "List available sessions" — API exists (GET /api/sessions) but no UI to display them ❌
- "Book a child onto one" — API exists (POST /api/bookings) but no UI, and capacity checks have race conditions ❌
- "Cancel a booking" — API exists (DELETE /api/bookings/:id) but no UI ❌
- "Sign out" — API exists (POST /api/sign-out) but authentication is broken ❌

## Constraints Check

- "Runs on the centre's reception terminal and on parents' phones" — Cannot load on any browser ❌
- "Node 18+" — Present ✓
- "No external services" — Correct ✓

## Summary

The application is architecturally incomplete and contains unfixed critical vulnerabilities:

- **Foundation missing:** No static file serving, no frontend, cannot load in a browser
- **Security broken:** Authentication is trivial, any user can impersonate any other
- **Data integrity broken:** Race conditions allow overbooking and booking ID collisions can corrupt data
- **User need misaligned:** Documented primary job (booking) doesn't match customer email (viewing child's bookings)

**Do not release.** The application cannot serve requests to users, cannot authenticate them securely, and cannot reliably store bookings. Fundamental architectural and security work is required before this can be considered for release.

---

**Verification completed by:** Claude (independent reviewer)  
**Date:** 2026-09-05  
**Scope:** Code audit, documentation review, specification analysis  
**Not completed:** Automated gate checks (module config issue), runtime walkthrough (no functional UI), adversarial input testing (no UI)
