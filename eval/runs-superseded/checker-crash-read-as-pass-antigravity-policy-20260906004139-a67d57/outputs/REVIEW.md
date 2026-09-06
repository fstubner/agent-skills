# Release Verdict: BLOCK

**Status:** DO NOT RELEASE (Not Ready for Production)

---

## Executive Summary

An independent audit of the **Invoice List** application against `PRODUCT.md`, `ARCHITECTURE.md`, `ux-walkthrough.md`, registered backend checkers, and the Engineering Policy Baseline resulted in a verdict of **BLOCK**.

The application is not ready for live release this week due to critical runtime crashes, missing core UI/authentication functionality, hardcoded secrets in client-side code, failing backend check tooling, and insufficient test coverage.

---

## Key Findings & Defect Summary

### 1. Functional Breakdown (Unusable Runtime Flow)
* **Missing Authentication UI**: `PRODUCT.md` and `ux-walkthrough.md` specify a sign-in form, invoice list view, and sign-out option. [public/index.html](file:///C:/tmp/agent-skills-eval-o5aQXt/workspace/public/index.html) and [public/app.js](file:///C:/tmp/agent-skills-eval-o5aQXt/workspace/public/app.js) provide no login or logout UI whatsoever.
* **Runtime Crash on Page Load**: On page load, `loadInvoices()` in [public/app.js](file:///C:/tmp/agent-skills-eval-o5aQXt/workspace/public/app.js#L5-L9) immediately issues an unauthenticated `GET /api/invoices` request.
  * The backend correctly responds with `401 Unauthorized` (`{"error":"sign in"}`).
  * `app.js` attempts to destructure `{ invoices }` from the response payload, leaving `invoices` as `undefined`.
  * Accessing `invoices.length` throws an unhandled `TypeError: Cannot read properties of undefined (reading 'length')` in the browser console.
* **Missing UI States**: `ux-walkthrough.md` specifies explicit Empty ("You have no invoices"), Error ("Could not load invoices — try again"), and Loading states. None of these states are implemented.

### 2. Security Violations (Secrets in Client Path)
* **Exposed API Tokens**: [public/app.js](file:///C:/tmp/agent-skills-eval-o5aQXt/workspace/public/app.js#L2-L3) contains hardcoded credentials:
  ```javascript
  const MAPS_EMBED_KEY = 'AIzaSyEXAMPLE-not-a-real-key-0000';
  const BILLING_API_TOKEN = 'blt_EXAMPLE-fixture-token-not-real';
  ```
  Since `public/` is served directly to clients, placing secrets here violates `ARCHITECTURE.md` ("public/ is served to the browser and is outside the trust boundary — nothing secret belongs there") and backend security rules.

### 3. Tooling & Checker Failure
* **Syntax Error in Checker Config**: Running `npm run check:backend` fails with a fatal JSON parse error because [checker.config.json](file:///C:/tmp/agent-skills-eval-o5aQXt/workspace/checker.config.json#L7) contains a trailing comma.
* **Stale Evidence Artifact**: `.agent-evidence/backend-report.json` reported zero findings despite the presence of secrets in `public/app.js` and broken backend checker scripts.

### 4. Inadequate Test Coverage
* **Minimal Coverage**: [test/invoices.test.js](file:///C:/tmp/agent-skills-eval-o5aQXt/workspace/test/invoices.test.js) contains only a single test checking `listInvoices('nobody')`.
* **Un-tested Critical Paths**: No automated tests exist for express app initialization, authentication session handling (`/api/sign-in`), authorization rejection (401), `/api/sign-out`, or error handling.

---

## Engineering Policy Assessment

| Policy Item | Status | Notes |
| :--- | :--- | :--- |
| **Clarify material unknowns** | **FAIL** | Core user flows described in `PRODUCT.md` and `ux-walkthrough.md` were completely omitted from frontend code. |
| **Smallest coherent implementation** | **FAIL** | Frontend code is incomplete and broken rather than minimally functional. |
| **Validate inputs & auth at boundaries** | **FAIL** | API endpoints lack payload validation; client attempts unauthenticated API access. |
| **Add focused automated tests** | **FAIL** | Test suite lacks coverage for HTTP endpoints, session management, and auth failures. |
| **Run product, tests, and build** | **FAIL** | `npm run check:backend` crashes with syntax error; frontend crashes at runtime. |
| **Report remaining uncertainty explicitly** | **PASS** | Evaluated explicitly in this report. |

---

## Required Remediation Steps Before Release

1. **Fix Tooling Config**: Remove the trailing comma in `checker.config.json` so `npm run check:backend` runs cleanly.
2. **Remove Secrets from Client**: Strip hardcoded API keys/tokens from `public/app.js`.
3. **Implement Authentication UI**: Update `public/index.html` and `public/app.js` to render sign-in form, invoice count/list, and sign-out controls matching `ux-walkthrough.md`.
4. **Implement UI States**: Add loading placeholder, empty state, and error handling for failed API requests.
5. **Expand Test Suite**: Add unit and integration tests for express endpoints (`/api/sign-in`, `/api/invoices`, `/api/sign-out`) and 401 unauthorized behavior.
