# Release Review Verdict: BLOCK

**Product:** Expenses Claims Tool  
**Date:** 2026-09-06  
**Auditor:** Independent Release Acceptance Gate  

---

## Executive Summary

The proposed release of the Expenses Claims Tool to replace the finance spreadsheet on Monday is **BLOCKED**. 

While basic backend claim creation functions pass isolated unit tests, the application is incomplete, non-functional for end users, and poses critical security and data-integrity risks.

---

## Gate Check Results

Automated gate check (`accept-check.js`) verdict: **BLOCK**

- `A-architecture-doc`: **FAIL** — `ARCHITECTURE.md` is missing the required `## Trust` section.
- `D-systems-architecture`: **FAIL** — Architecture check blocked on missing trust boundaries.
- `D-operability-report`: **FAIL** — Missing health endpoints and operations documentation.
- `A-intent-anchored`: **NOT EVALUATED** — `PRODUCT.md` provenance is undeclared.

---

## UX Walkthrough Findings

Replay against `ux-walkthrough.md`: **FAILED**

1. **Missing Frontend UI:** `public/index.html` is a 68-byte placeholder (`<main id="app"></main>`) containing no JavaScript, CSS, forms, or API integration.
2. **Missing Static File Serving:** `src/server.js` does not mount static middleware (`express.static('public')`), meaning the client shell is not served by Express.
3. **Unusable Critical Path:** Staff cannot sign in, submit claims, or view claim history via a web browser; line managers cannot view or approve claims via a web browser.

---

## Security & Engineering Audit Findings

### Critical Vulnerabilities & Security Defects
1. **Authentication Bypass & Impersonation:** `POST /api/sign-in` accepts any client-provided `staffId` and `isManager` boolean without passwords, credentials, or directory checks. Any user can sign in as any employee or manager.
2. **Authorization Boundary Failure:** `POST /api/claims/:id/approve` relies on `req.session.isManager` without checking if the manager is authorized to approve claims for that specific employee.
3. **Session Cookie Misconfiguration:** `cookie.secure: true` is hardcoded in `src/server.js`. On internal HTTP deployments without TLS/HTTPS, browsers will silently reject session cookies, blocking all user sessions.

### Input Validation & Data Integrity Defects
1. **Unvalidated Amount Field:** `POST /api/claims` does not validate `req.body.amountMinor`. Negative values, non-numbers, NaN, or extreme values are accepted and persisted.
2. **Weak Date Validation:** `spentOn` uses regex `/^\d{4}-\d{2}-\d{2}$/`, allowing invalid calendar dates like `2026-99-99` or `2026-02-31`.
3. **Data Persistence Race Conditions:** `src/claims.js` uses direct `fs.writeFileSync` on a single JSON file without file locking or atomic replacement, leading to potential data corruption under concurrent requests.
4. **ID Generation Collisions:** Claim IDs are generated using `c${claims.length + 1}`, which is subject to collisions under concurrent submissions.

---

## Verification Summary & Scope

### What Was Verified
- Executed unit tests (`npm test` / `test/claims.test.js`).
- Executed full automated acceptance gate (`accept-check.js`).
- Inspected all source code (`src/server.js`, `src/claims.js`), web assets (`public/index.html`), configuration (`package.json`), and project documentation (`PRODUCT.md`, `ARCHITECTURE.md`, `ux-walkthrough.md`, `docs/build-notes.md`).
- Conducted walkthrough evaluation of frontend and backend integration.

### What Was Not Checked
- Staging/production deployment environments or live network traffic (blocked due to missing UI and security blockers).
- Real-world database performance under load (using JSON file store).

---

## Final Recommendation

Do **not** replace the finance spreadsheet on Monday. The application requires frontend implementation, authentication mechanism, input validation, and architectural compliance before it can be re-evaluated for release.
