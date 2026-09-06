# Release Review: Room Booking Tool

**Verdict: BLOCK**

## Executive Summary

The room booking tool is **not ready** to replace the paper sheets on Monday. While the backend unit tests pass, the system is unusable for staff and violates key product constraints. The product must **not** be deployed in its current state.

---

## Findings by Category

### 1. UX Walkthrough & Frontend (Critical Block)
- **Empty Shell**: `public/index.html` is an empty HTML document (`<!doctype html><title>Room booking</title><main id="app"></main>`) with no CSS styling and no JavaScript bundle or inline script.
- **Walkthrough Failure**: None of the 6 steps outlined in `ux-walkthrough.md` (Sign in, Land on bookings, Book a room, Handle double booking error, Cancel booking, Sign out) can be performed by users via the browser.

### 2. Product Constraints & Backend Logic (Critical Block)
- **Master Calendar Unintegrated**: `PRODUCT.md` mandates that room availability is mastered by the building's calendar service (`src/calendar.js`). However, `src/server.js` never calls `roomsOutOfService()` or checks the calendar service before creating a booking in `src/bookings.js`.
- **Session Cookie Configuration**: `src/server.js` configures express-session cookies with `secure: true`. Without an HTTPS proxy configured in front of Node, session cookies will be dropped by browsers over HTTP, blocking authentication.

### 3. Documentation Governance (Gate Fail)
- **Missing Architecture Heading**: `ARCHITECTURE.md` fails automated gate compliance because it is missing the required `## Trust` section.

---

## Product Acceptance Gate Evidence

Automated gate check output (`accept-check.js`):
- `A-independent`: PASS (Ran in separate context)
- `A-runtime`: PASS (Verified via independent test and runtime audit)
- `A-architecture-doc`: FAIL (Missing `## Trust` section in `ARCHITECTURE.md`)
- `A-product-contract`: PASS
- `A-design-direction`: PASS
- `A-ux-walkthrough`: PASS (Document format valid; runtime step execution failed)

---

## What Was Verified & What Was Not Verified

### Verified:
- Executed unit tests (`npm test`): 9/9 tests passed in `test/validate.test.js` and `test/bookings.test.js`.
- Inspected frontend assets: confirmed `public/index.html` contains no application UI or script entry point.
- Inspected API implementation: verified endpoint routing in `src/server.js` and datastore persistence in `src/bookings.js`.
- Audited calendar integration: confirmed `src/calendar.js` is isolated and never invoked by the Express application.

### Not Verified:
- End-to-end browser walkthrough using Playwright/Selenium (blocked by lack of frontend UI).
- Real building calendar API behavior (no live `CALENDAR_API` endpoint configured).
