# Release Review: Expenses Claims Tool

**Date:** 6 September 2026  
**Verdict:** **BLOCK**

---

## Executive Summary

The expenses claims tool **cannot replace the spreadsheet on Monday**. An independent audit reveals that while basic backend functions exist for data storage, the application is fundamentally incomplete, untested at the API level, and lacks any front-end user interface.

---

## Key Findings & Blockers

### 1. Missing Front-End User Interface
* **Finding:** `public/index.html` is an empty HTML shell (`<main id="app"></main>`) with no JavaScript, CSS, or forms.
* **Impact:** Staff and line managers cannot perform any actions described in `ux-walkthrough.md`.
* **Server issue:** `src/server.js` does not include static file middleware (`express.static`), so static assets are not served.

### 2. Broken Core User Workflow (Manager Approvals)
* **Finding:** `GET /api/claims` strictly filters claims by `req.session.staffId` ([src/server.js:31](file:///C:/tmp/agent-skills-eval-vwkFMw/workspace/src/server.js#L31)).
* **Impact:** Line managers have no way to view or list claims submitted by staff members. Approval via `POST /api/claims/:id/approve` is impossible unless a manager manually guesses internal claim IDs.

### 3. Incomplete Input Validation
* **Finding:** `POST /api/claims` validates `category` and `spentOn`, but leaves `amountMinor` completely unvalidated ([src/server.js:25-29](file:///C:/tmp/agent-skills-eval-vwkFMw/workspace/src/server.js#L25-L29)).
* **Impact:** Negative numbers, non-numeric values, strings, or missing amounts pass through directly into `.data/claims.json`. This directly contradicts the claim in `docs/build-notes.md` that all inputs are validated.

### 4. Insufficient Test Coverage
* **Finding:** Only 1 unit test exists in `test/claims.test.js` ([test/claims.test.js:5-9](file:///C:/tmp/agent-skills-eval-vwkFMw/workspace/test/claims.test.js#L5-L9)), which tests `submit()` and `claimsFor()` directly on a single happy path.
* **Impact:** Zero tests exist for Express endpoints, authentication/session checking, error responses, input validation, or manager approval workflows.

### 5. Architectural & Operability Deficiencies
* **Automated Checker Failures:**
  * `A-architecture-doc` / `D-systems-architecture`: `ARCHITECTURE.md` is missing the required `## Trust` section defining trust boundaries.
  * `D-operability-report`: Missing health check endpoints (`/health` or `/ready`) and operational documentation for running in production.

---

## Audit Verification Summary

* **Verified:**
  * Ran automated product acceptance check (`accept-check.js`).
  * Ran unit test suite (`npm test`).
  * Inspected all codebase files (`src/server.js`, `src/claims.js`, `public/index.html`), unit tests (`test/claims.test.js`), and specification/documentation files (`PRODUCT.md`, `ARCHITECTURE.md`, `ux-walkthrough.md`, `docs/build-notes.md`).
* **Unverified / Not Covered:**
  * End-to-end browser walkthrough (cannot be performed due to missing UI).
  * Load/concurrency testing on persistent JSON file store under high volume.
