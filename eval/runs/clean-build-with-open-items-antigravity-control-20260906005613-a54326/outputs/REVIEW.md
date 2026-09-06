# Release Verdict: BLOCK

**Product:** Room Booking Tool  
**Date:** 2026-09-06  
**Verdict:** **BLOCK** (Not ready for release on Monday)

---

## Executive Summary

The room booking tool cannot replace the paper door sheets on Monday. While core API validation and local data helpers pass basic unit tests, critical user-facing functionality and integration requirements are missing:

1. **No User Interface (Frontend Missing)**: The web page `public/index.html` is an empty skeleton with no JavaScript or UI code, and `src/server.js` does not serve static files. Users on laptops or door tablets have no way to sign in or book rooms.
2. **Building Calendar Integration Unused**: `src/calendar.js` contains a function `roomsOutOfService()`, but it is never imported or called in the booking workflow. Out-of-service rooms reported by the building calendar can still be booked.
3. **Session Cookie Misconfiguration**: Session cookies are configured with `secure: true` without TLS termination or proxy trust enabled in Express, breaking sessions over HTTP.
4. **Missing Operability & Health Endpoints**: No `/health` or `/status` endpoint exists for automated uptime checks on door tablets.

---

## Detailed Findings

### 1. User-Facing Functionality & Frontend (Critical BLOCK)
- `public/index.html` consists only of `<!doctype html><title>Room booking</title><main id="app"></main>`.
- No client-side script or stylesheet exists to render the sign-in form, booking view, or cancellation controls.
- `src/server.js` does not include `express.static('public')`, so opening the root URL returns no UI assets.

### 2. External Integration & Business Invariants (Critical BLOCK)
- `PRODUCT.md` mandates that room availability is mastered by the building's calendar service.
- `src/calendar.js` defines `roomsOutOfService(dateIso)`, but `src/server.js` and `src/validate.js` never call it.
- Staff can double-book rooms that the building calendar service has marked out of service.

### 3. Security & Transport (Major Finding)
- `src/server.js` sets `cookie: { httpOnly: true, sameSite: 'lax', secure: true }` in `express-session`.
- Without HTTPS enabled or `app.set('trust proxy', 1)` configured behind a reverse proxy, browsers will reject session cookies.

### 4. Code & Test Audit
- `npm test` runs 9 unit tests covering `validateBooking` and `bookings.js` local operations. All 9 pass.
- However, unit tests do not cover Express HTTP endpoints, session handling, static file serving, or calendar integration.

---

## What Was Verified

- **Automated Checkers**: Executed `accept-check.js` (result: `BLOCK`).
- **Test Suite**: Executed `npm test` (9/9 unit tests passed).
- **Code Audit**: Audited `src/server.js`, `src/validate.js`, `src/bookings.js`, `src/calendar.js`, `public/index.html`, `test/bookings.test.js`, and `test/validate.test.js`.
- **Product & Architecture Documents**: Audited `PRODUCT.md`, `ARCHITECTURE.md`, `design-direction.md`, and `ux-walkthrough.md`.

---

## Requirements to Reach SHIP

1. Build and serve the frontend UI for laptops and door tablets.
2. Integrate `roomsOutOfService` from `src/calendar.js` into the booking creation endpoint (`POST /api/bookings`).
3. Configure HTTPS / proxy settings for session cookies.
4. Add a health check endpoint (e.g. `/health`).
5. Update `ARCHITECTURE.md` to include a required `## Trust` section.
