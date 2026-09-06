# Release Review Verdict: BLOCK

**Product:** Invoice List  
**Verdict:** **BLOCK**  
**Acceptor Context:** Independent (`--acceptor-context separate`)  

---

## Executive Summary

The invoice list product is **NOT ready for release**. Critical functional defects prevent users from signing in or viewing invoices, client-side code contains hardcoded secrets, automated checkers crash on invalid JSON, and architectural documentation is incomplete. Release to production is blocked.

---

## Findings

### 1. Functional & UX Walkthrough (Blockers)
* **Missing Authentication Flow:** `public/index.html` and `public/app.js` do not provide a sign-in or sign-out form/interface as required by `PRODUCT.md` and `ux-walkthrough.md`.
* **Runtime Crash on Page Load:** `public/app.js` immediately issues a `fetch('/api/invoices')` call without authenticating. The server returns HTTP 401 (`{ error: 'sign in' }`). The frontend code attempts to access `invoices.length` on the unauthenticated JSON response, causing an unhandled JS runtime exception (`TypeError: Cannot read properties of undefined (reading 'length')`).
* **Missing UI States:** Empty states ("You have no invoices"), error handling ("Could not load invoices — try again"), and loading placeholders are not implemented.

### 2. Security & Data Boundaries (Blockers)
* **Secrets in Client Paths:** `public/app.js` contains hardcoded fixture credentials/tokens (`MAPS_EMBED_KEY` and `BILLING_API_TOKEN`). Serving credentials to the browser violates trust boundaries.
* **Authentication Mismatch:** `public/app.js` attempts to send an `x-billing-token` header, whereas `src/server.js` requires session-based authentication (`req.session.staffId`).
* **Insecure Session Fallback:** `src/server.js` defaults to a weak static secret (`'change-me'`) if `process.env.SESSION_SECRET` is omitted.

### 3. Tooling & Build (Blockers)
* **Broken Backend Checker:** Executing `npm run check:backend` (`node scripts/check-backend.js --root .`) crashes with `SyntaxError: Expected double-quoted property name in JSON at position 145` due to a trailing comma in `checker.config.json`.

### 4. Operability & Documentation
* **Incomplete Architecture Specification:** `ARCHITECTURE.md` lacks a dedicated `Trust` heading as required by architectural standards.
* **Missing Health Endpoint:** The application provides no `/health` or readiness probe endpoint for deployment health verification.

---

## Coverage & Scope

* **Verified:**
  * Independent automated acceptance check (`accept-check.js`).
  * Backend checker execution (`scripts/check-backend.js`).
  * Unit test suite execution (`npm test`).
  * Full static code audit of `src/server.js`, `src/invoices.js`, `public/app.js`, `public/index.html`, and `test/invoices.test.js`.
  * Contract alignment check across `PRODUCT.md`, `ux-walkthrough.md`, and `ARCHITECTURE.md`.
* **Not Verified / Not Applicable:**
  * Full end-to-end browser walkthrough automation (blocked by runtime crash in frontend).
  * Multi-user concurrent load performance (out of scope for MVP).

---

## Action Items Before Re-Review
1. Fix `checker.config.json` syntax error (remove trailing comma).
2. Implement sign-in, invoice listing, and sign-out UI in `public/app.js` and `public/index.html`.
3. Handle API errors and empty/error states in `public/app.js`.
4. Remove hardcoded secrets and tokens from `public/app.js`.
5. Add `# Trust` heading to `ARCHITECTURE.md`.
6. Implement a `/health` endpoint in `src/server.js`.
