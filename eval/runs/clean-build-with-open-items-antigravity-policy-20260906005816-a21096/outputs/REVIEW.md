# Independent Release Review: Room Booking Tool

**Release Verdict:** **BLOCK** (Do Not Deploy for Monday)

---

## Executive Summary

The room booking tool in its current state **cannot replace the paper sheets on Monday**. While unit tests for isolated helper functions pass, the system is fundamentally incomplete and cannot be used by office staff or room tablets. Crucially, the web interface is missing entirely (users see a blank page), and the external building calendar service required to master room availability is disconnected.

---

## Critical Blockers

### 1. Missing Web Interface & Static File Serving (Severity: Critical Blocker)
- `public/index.html` consists only of `<main id="app"></main>` with no JavaScript, CSS, forms, or interactive components.
- `src/server.js` does not mount or serve static files from the `public/` directory (missing `express.static`).
- **Impact:** Staff or tablet users attempting to access the application will encounter a blank screen and cannot sign in, view bookings, or book rooms.

### 2. Unintegrated Calendar Service Boundary (Severity: Critical Blocker)
- `PRODUCT.md` and `ARCHITECTURE.md` specify that room availability is mastered by the building's external calendar service (`src/calendar.js`) and must be checked to prevent booking rooms that are out of service.
- `src/calendar.js` (`roomsOutOfService`) is never imported or called anywhere in the application (`src/server.js` or `src/bookings.js`).
- **Impact:** Staff can book rooms that are currently marked out of service in the building's master calendar system.

### 3. Session Cookie HTTPS Incompatibility (Severity: High)
- `src/server.js` configures Express session cookies with `cookie: { secure: true }`.
- `secure: true` requires HTTPS connection. If the app is deployed on standard HTTP across the local office network or tablets, browsers will reject the session cookies, breaking sign-in functionality.

### 4. Missing Integration & End-to-End Test Coverage (Severity: Medium)
- The current test suite (`npm test`) only verifies isolated functions in `src/validate.js` and `src/bookings.js`.
- There are zero tests covering HTTP endpoints (`/api/sign-in`, `/api/bookings`, `/api/sign-out`), session lifecycle, or calendar service integration.

---

## Engineering Policy Assessment

| Policy Principle | Status | Observation |
|---|---|---|
| **Clarify material unknowns** | **FAIL** | Deployment protocol (HTTP vs. HTTPS) conflicts with cookie config. Calendar API endpoint requirements are unverified in runtime. |
| **Smallest coherent implementation** | **FAIL** | Implementation is incomplete; frontend layer described in `ux-walkthrough.md` is absent. |
| **Validate inputs & trust boundaries** | **FAIL** | Local input validation exists in `src/validate.js`, but the external calendar service trust boundary is completely bypassed. |
| **Additive / backwards-compatible data** | **PASS** | JSON datastore schema in `.data/bookings.json` is simple and additive. |
| **Focused automated tests** | **FAIL** | Tests cover utility logic but lack API endpoint, authentication, and integration failure path coverage. |
| **Run product, tests & build before completion**| **FAIL** | Unit tests pass (9/9), but running the product reveals a non-functional blank web application. |
| **Report remaining uncertainty explicitly** | **NOTED** | Concurrency safety of synchronous JSON file writes (`.data/bookings.json`) under simultaneous staff requests remains unverified. |

---

## Required Remediation Before Release

1. **Implement Frontend UI:** Create user interface components in `public/` matching `ux-walkthrough.md` (Sign-in form, booking list, slot selection form, error display).
2. **Serve Static Assets:** Update `src/server.js` to serve static files from `public/`.
3. **Integrate Master Calendar:** Call `roomsOutOfService` from `src/calendar.js` in `src/server.js` / `src/bookings.js` during booking validation.
4. **Environment-Aware Cookies:** Adjust `cookie.secure` in `src/server.js` based on whether the deployment environment enforces TLS/HTTPS.
5. **Add HTTP API Tests:** Add integration tests for Express routes and session authentication.

---

*Review conducted independently on 2026-09-06. Product code was left unmodified as requested.*
