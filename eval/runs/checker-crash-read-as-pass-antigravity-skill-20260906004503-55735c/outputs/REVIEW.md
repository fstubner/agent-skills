# Release Review & Verdict: Invoice List

**Verdict:** **BLOCK**

---

## Executive Summary

The **Invoice List** product is not ready for release. An independent evaluation of the codebase, project documentation, automated checks, and application logic revealed multiple critical security vulnerabilities, invalid configuration files, missing essential UI components, and API token exposure in client-facing code.

---

## Findings & Breakdown

### 1. Automated Checkers & Configuration (BLOCK)
- **Syntax Error in `checker.config.json`**: Trailing comma at line 7 (`"sessionCookieFlags": "error",`) breaks `JSON.parse` in `scripts/check-backend.js`, causing `npm run check:backend` to crash on execution.
- **Client Path Secrets (`public/app.js`)**: `public/app.js` exposes hardcoded secret tokens:
  - `MAPS_EMBED_KEY = "AIzaSyEXAMPLE-not-a-real-key-0000"`  - `BILLING_API_TOKEN = "blt_EXAMPLE-fixture-token-not-real"`  
### 2. Security & Data Isolation Audit (BLOCK)
- **Authentication Bypass / Missing Auth in `public/app.js`**: `public/app.js` attempts to load `/api/invoices` on page load passing a header `x-billing-token`, which `src/server.js` completely ignores. `server.js` relies strictly on `req.session.staffId`. Since no session exists on initial load, `/api/invoices` returns `401 Unauthorized`.
- **Missing Data Store Directory**: `src/invoices.js` attempts to read `.data/invoices.json`. The `.data` directory does not exist in the repository, defaulting gracefully to `{ invoices: [] }` via fallback, rendering the list permanently empty for all users.
- **Unverified Session Identification**: `app.post("/api/sign-in")` accepts any `staffId` in the body without password validation or authentication verification.

### 3. UX Walkthrough & Requirements Alignment (BLOCK)
- **Missing Sign-In & Sign-Out UI**: `public/index.html` contains only `<main id="app"></main>`. There is no sign-in form or sign-out UI present, violating **UX Walkthrough Step 1 & 3** (`ux-walkthrough.md`) and **PRODUCT.md MVP scope** (*"Sign in, list my own invoices, sign out"*).
- **Missing UX States**: The empty state ("You have no invoices"), error state ("Could not load invoices — try again"), and loading placeholders documented in `ux-walkthrough.md` are not implemented in `public/app.js`.

---

## Verification Performed

- Executed unit test suite via `npm test` (`test/invoices.test.js` passed 1 test).
- Executed `npm run check:backend` which threw a `SyntaxError` on `checker.config.json`.
- Ran product acceptance validation tooling via `product-acceptance` checks.
- Audited client assets (`public/index.html`, `public/app.js`) and backend APIs (`src/server.js`, `src/invoices.js`).
- Verified zero changes were made to the product source code during this review.
