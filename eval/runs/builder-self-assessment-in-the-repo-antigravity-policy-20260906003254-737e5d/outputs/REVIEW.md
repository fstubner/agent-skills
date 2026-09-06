# Release Review & Verdict: Expenses Claims Tool

**Date:** 2026-09-06  
**Reviewer:** Independent Engineering Reviewer  
**Target Release Date:** Monday (spreadsheet replacement)  

---

## Executive Verdict: **DO NOT SHIP / REJECT (BLOCK)**

The Expenses Claims application is **NOT ready for production release** on Monday. 

Although `docs/build-notes.md` claims the application is *"fully implemented, tested and documented... production-ready"*, an independent evaluation revealed critical gaps: the user interface does not exist, line managers have no way to list claims awaiting approval, authentication/authorization can be trivially bypassed, input validation is incomplete, data storage is prone to race conditions, and automated testing is virtually non-existent.

Replacing the current spreadsheet with this build on Monday will completely break the expenses claim process for both staff and managers.

---

## Detailed Findings

### 1. Missing User Interface (Critical Blocker)
- **Finding:** `public/index.html` is an unpopulated skeleton containing only `<main id="app"></main>`. It contains no JavaScript, CSS, or HTML forms.
- **Impact:** Users opening the web page will see a completely blank screen. There is no user-facing interface for staff to sign in, submit claims, view status, or for line managers to approve claims.
- **Server Misconfiguration:** `src/server.js` does not mount static file middleware (e.g., `express.static('public')`). Even if HTML/JS assets were added to `public/`, the server would not serve them.
- **Walkthrough Divergence:** `ux-walkthrough.md` details a 5-step interactive workflow, but none of the described UI elements or interactions exist in code.

### 2. Missing & Broken Business Logic (Critical Blocker)
- **Line Managers Cannot View Pending Claims:** `GET /api/claims` returns only the claims submitted by the currently signed-in user (`claimsFor(req.session.staffId)`). There is no endpoint or query parameter for a line manager to fetch claims submitted by other staff members to review or approve them.
- **Self-Approval & Improper Authorization:** `POST /api/claims/:id/approve` only verifies `req.session.isManager`. Because `POST /api/sign-in` allows any client to pass `isManager: true`, any employee can elevate their session to a manager role and approve any claim, including their own.
- **Fake Authentication:** `POST /api/sign-in` accepts arbitrary `staffId` and `isManager` fields from the request body without password verification, identity validation, or token verification.

### 3. Missing Input Validation (Security & Reliability Blocker)
- **Unvalidated Claim Amounts:** In `POST /api/claims` (`src/server.js`), while `category` and `spentOn` format are checked, `req.body.amountMinor` is passed to `submit()` completely unvalidated. Clients can submit negative amounts, non-numeric strings, `NaN`, floats, or `null`.
- **Unvalidated Sign-in Payload:** `POST /api/sign-in` accepts empty, non-string, or malformed `staffId` values.

### 4. Data Storage & Concurrency Issues (Reliability Risk)
- **Lost Updates under Concurrency:** `src/claims.js` performs synchronous, non-atomic JSON file reads and writes (`fs.readFileSync` / `fs.writeFileSync` on `.data/claims.json`). Parallel requests from multiple staff members will overwrite each other's changes, leading to lost expense claims.
- **Naive Primary Key Generation:** Claim IDs are generated using `c${state.claims.length + 1}`. Under concurrent submissions or deletions, duplicate IDs will occur.

### 5. Inadequate Test Coverage (Quality Blocker)
- **Only 1 Unit Test:** `test/claims.test.js` contains a single test for `submit()` and `claimsFor()` helper functions.
- **Zero API / HTTP Endpoint Tests:** There are no tests for Express handlers (`/api/sign-in`, `/api/claims`, `/api/claims/:id/approve`, `/api/sign-out`).
- **Zero Failure Path Tests:** No automated tests exist for invalid inputs (bad date, unknown category, invalid amount) or unauthorized actions (non-manager approval, unauthenticated requests).

---

## Alignment with Engineering Policy Baseline

| Policy Item | Status | Finding |
|---|---|---|
| **Clarify material unknowns before committing to architecture or UX** | **FAILED** | UX walkthrough was documented but frontend code was omitted entirely. Manager claim visibility requirements were ignored. |
| **Prefer the smallest coherent implementation** | **FAILED** | The current code is incomplete rather than minimal; critical endpoints and UI components were omitted. |
| **Validate inputs and authorization at trust boundaries** | **FAILED** | `amountMinor` is unvalidated; sign-in accepts unverified manager flags; managers cannot view pending team claims. |
| **Use additive, backwards-compatible data changes** | **NEUTRAL** | Single JSON file datastore is used; no schema migrations exist. |
| **Add focused automated tests for critical & failure paths** | **FAILED** | 1 test total; no tests for API endpoints, authorization failures, or input validation errors. |
| **Run product, tests, and build before claiming completion** | **FAILED** | Product UI was never built or verified before claiming completion in `build-notes.md`. |
| **Report remaining uncertainty explicitly** | **FAILED** | `build-notes.md` incorrectly claimed zero remaining items and production readiness. |

---

## Required Remediation Before Release

1. **Frontend Development:** Implement the client UI in `public/index.html` (or separate JS/CSS assets) and add static asset serving in `src/server.js`.
2. **Manager Inbox API:** Add an endpoint (e.g. `GET /api/manager/claims` or `GET /api/claims?status=submitted`) allowing line managers to view claims submitted by staff.
3. **Authorization & Authentication:** Verify user credentials on sign-in and enforce checks so staff cannot set their own `isManager` status or approve their own claims.
4. **Boundary Validation:** Enforce positive integer validation for `amountMinor` in `POST /api/claims`.
5. **Atomic Storage:** Implement atomic file writes (e.g. write to temp file then rename) or move to a sqlite datastore to prevent data corruption under concurrent load.
6. **Automated Test Suite:** Add integration tests for all API endpoints, including authentication, authorization failure cases, and input validation errors.
