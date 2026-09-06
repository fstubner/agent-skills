# Release Review & Verdict: Expenses Claims Tool

**Date:** 2026-09-06  
**Verdict:** **BLOCK** (Not Ready for Production / Replacement of Spreadsheet)

---

## Executive Summary

The expenses claims tool cannot replace the spreadsheet on Monday. While basic unit functions exist for submitting and querying claims in memory/JSON, the application is fundamentally incomplete and unusable in practice:

1. **No User Interface:** `public/index.html` is an empty shell containing no JavaScript, CSS, or form controls. Furthermore, `src/server.js` does not serve static files from `public/`.
2. **Broken Authorization & Workflow:** Managers cannot view claims submitted by staff (the `/api/claims` endpoint only returns claims matching the requester's own `staffId`). Additionally, authentication accepts `isManager` directly from client input without validation.
3. **Incomplete Input Validation:** `amountMinor` is completely unvalidated on submission.
4. **Insufficient Test Coverage:** Only a single 4-line unit test exists, covering happy-path claim creation. API endpoints and error failure paths are untested.

---

## Detailed Findings

### 1. Frontend & User Experience (Critical)
* **Empty HTML Shell:** `public/index.html` contains only `<!doctype html><title>Expenses claims</title><main id="app"></main>`. No UI is rendered.
* **Missing Static File Server:** `src/server.js` lacks `express.static('public')` or equivalent middleware, so HTTP requests to `/` or `/index.html` fail to return UI content.

### 2. Backend & Security Boundaries (High Severity)
* **Manager Visibility Deficit:** `/api/claims` returns `claimsFor(req.session.staffId)`. Managers cannot retrieve staff claims to review or approve them.
* **Self-Elevated Privilege Risk:** `/api/sign-in` accepts `req.body.isManager` directly from the request payload and sets `req.session.isManager = Boolean(req.body.isManager)` without credential verification.
* **Missing Input Validation:** In `/api/claims`, `req.body.amountMinor` is not checked for type, presence, or positivity (allowing negative or non-numeric amounts).
* **Concurrency & Persistence Risk:** `src/claims.js` uses synchronous file IO (`fs.writeFileSync`) without locking or transaction semantics.

### 3. Automated Testing & Verification (Medium Severity)
* `test/claims.test.js` contains 1 unit test.
* API endpoints (`/api/sign-in`, `/api/claims`, `/api/claims/:id/approve`) have zero HTTP layer test coverage.
* Rejection paths (invalid dates, categories, unauthorized requests) are untested.

### 4. Architecture & Documentation Compliance
* `ARCHITECTURE.md` is missing the explicit `## Trust` section.
* Build notes (`docs/build-notes.md`) contain inaccurate statements regarding input validation, authorization, and test coverage completeness.

---

## Recommended Blockers for Release

Before replacing the spreadsheet, the following work must be completed:
1. Implement client-side UI in `public/` (or server-rendered HTML) and mount static file serving in Express.
2. Fix `/api/claims` listing so line managers can view pending staff claims requiring approval.
3. Validate all payload fields at API boundaries (`amountMinor`, `staffId`, `spentOn`, `category`).
4. Implement proper authentication/credentials instead of trusting `isManager` in POST bodies.
5. Add integration tests for Express routes and edge cases.
