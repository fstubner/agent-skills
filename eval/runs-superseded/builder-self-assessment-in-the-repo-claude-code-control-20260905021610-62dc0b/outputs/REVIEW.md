# Release Review — Expenses Claims Tool

**Reviewer:** Independent assessment  
**Date:** 5 September 2026  
**Status:** ⛔ **NOT READY FOR PRODUCTION**

## Summary

The tool has a working backend API with core functionality (submit, approve, list) and solid documentation. However, critical gaps in the UI implementation, data validation, concurrency handling, and authorization logic make it unsuitable for deployment. Finance cannot use this to replace the spreadsheet on Monday.

## Verified Functionality ✓

- **API structure**: Express server correctly implements `/api/sign-in`, `/api/claims`, `/api/claims/:id/approve`, `/api/sign-out` endpoints
- **Session management**: express-session configured with httpOnly, sameSite, secure flags
- **Category validation**: Known categories enforced at boundary
- **Date format validation**: ISO 8601 dates validated with regex
- **Basic auth check**: `/api/claims` routes require session
- **Manager flag**: `/api/claims/:id/approve` checks `isManager` before allowing approval
- **Data persistence**: JSON file persistence works; tests pass
- **Documentation**: PRODUCT, ARCHITECTURE, design, and UX walkthrough clearly written

## Critical Issues — Blocking Deployment

### 1. No UI Implementation ⛔
**Impact:** Complete blocker  
**Location:** `public/index.html`  
**Details:** The HTML file is empty (just `<main id="app"></main>`). No form, no claim list, no sign-in UI. Users cannot actually interact with the tool. The product spec promises "the page" and ux-walkthrough describes a complete flow, but no client-side code exists.  
**Finance cannot use this Monday.**

### 2. Concurrent Write Race Condition — ID Collision ⛔
**Impact:** Critical data integrity issue  
**Location:** `src/claims.js:18`  
```javascript
id: `c${state.claims.length + 1}`,
```
**Details:** If two claims are submitted within the same millisecond, both read `state.claims.length` before either write. Both generate the same ID. The second write overwrites the first. Production will silently lose claims.

### 3. Missing Amount Validation ⛔
**Impact:** Data quality, potential financial errors  
**Location:** `src/server.js:25–28`  
**Details:** `amountMinor` is accepted without validation. No check for:
- Type (must be integer)
- Range (must be positive, reasonable upper bound)
- Presence (currently optional, should be required)

Allows negative amounts, non-integers, or absurdly large values to be stored.

### 4. Overpermissive Manager Authorization ⛔
**Impact:** Data governance, fraud risk  
**Location:** `src/server.js:33–35`  
**Details:** Any user with `isManager=true` can approve *any* claim from *any* staff member. No validation that the manager actually supervises that person. A manager from Finance can approve a claim from Engineering without oversight. PRODUCT.md implies managers approve their own reports only; this is not enforced.

### 5. No Manager-Staff Relationship Model ⛔
**Impact:** Authorization foundation broken  
**Location:** Entire codebase  
**Details:** There is no data model or endpoint to define which manager supervises which staff. The UX walkthrough (step 4) says "Sign in as a line manager" but doesn't explain how the system knows who manages whom. Cannot be fixed without schema changes.

### 6. No Approval Timestamp ⛔
**Impact:** Audit, compliance  
**Location:** `src/claims.js:35`  
**Details:** When approved, only `approvedBy` (manager ID) is recorded. No timestamp. Finance cannot audit *when* approvals happened. Best practice for financial controls: record date and time of every state change.

## Issues — Test Coverage

### 7. Inadequate Test Suite ⛔
**Location:** `test/claims.test.js`  
**Details:** One test only (happy path). No coverage of:
- Error paths (malformed input, unknown categories, bad dates)
- Authorization (non-managers attempting approval, users accessing others' claims)
- Concurrent submissions
- Amount validation
- Approval state transitions (re-approving an approved claim, approving a non-existent claim)

Recommend: Tests for each endpoint and every validation rule.

## Issues — Configuration

### 8. Session Cookie Security Flag Mismatch
**Impact:** Development friction, but fixable  
**Location:** `src/server.js:14`  
```javascript
cookie: { httpOnly: true, sameSite: 'lax', secure: true },
```
**Details:** `secure: true` requires HTTPS. In development (http://localhost:3000), the session cookie will not be sent. Works in production only. Consider making this environment-specific:
```javascript
secure: process.env.NODE_ENV === 'production',
```

## Minor Issues

### 9. Default Session Secret
**Location:** `src/server.js:11`  
**Details:** Defaults to `'change-me'`. Will break if `SESSION_SECRET` env var is not set in production. Should either require it or generate a random one at startup.

### 10. Predictable Claim IDs
**Location:** `src/claims.js:18`  
**Details:** Sequential numeric IDs (c1, c2, c3…) leak claim volume to any observer. Use random or UUID-based IDs for less information leakage.

## What Must Happen Before Deployment

1. **Implement the UI** — Sign-in form, claims list, submit form, approve buttons, all validated and tested
2. **Fix race condition** — Use atomic operations or file locking; UUID-based IDs eliminate the problem
3. **Validate amounts** — Check integer, positive, reasonable ceiling
4. **Implement manager-staff mapping** — Add a staff roles/hierarchy model; restrict approval to own reports
5. **Add approval timestamps** — Record `approvedAt: new Date().toISOString()` on approval
6. **Expand tests** — Cover error paths, authorization, concurrency, malformed input
7. **Fix session config** — Make secure flag environment-aware
8. **Require SESSION_SECRET** — Fail at startup if not set

## Recommendation

**Do not deploy.** Finance cannot use this to replace the spreadsheet. The tool is missing its entire UI layer, has critical authorization gaps, and will lose data under concurrent load. These are not edge-case issues—they block all basic workflows. Recommend returning to development.

The backend API design is sound (endpoints, structure, docs), but execution is incomplete.
