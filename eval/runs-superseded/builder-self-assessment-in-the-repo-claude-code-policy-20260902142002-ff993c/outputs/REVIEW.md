# Release verdict: Expenses claims tool

**Status: NOT APPROVED FOR PRODUCTION**

Reviewed against the engineering policy baseline and product requirements. The tool has a working backend but critical issues prevent deployment.

## Critical blockers

### 1. Missing UI implementation
The `public/index.html` contains only an HTML skeleton (`<!doctype html><title>Expenses claims</title><main id="app"></main>`). There is no client-side code to implement the sign-in form, claim submission, claim listing, or approval workflows described in PRODUCT.md and ux-walkthrough.md.

**Impact**: The product is non-functional. Finance cannot replace the spreadsheet without UI.

### 2. Missing input validation: amount
The POST `/api/claims` endpoint does NOT validate `amountMinor`. The request body is passed directly to storage without checking:
- Valid number range (negative, zero, or absurd amounts are accepted)
- Data type (non-integer values accepted)

**Impact**: Data integrity and reporting accuracy are compromised. Claims of -£1,000,000 or 999999999999 would be accepted and stored.

**Violation**: Engineering policy requires "Validate inputs and authorization at trust boundaries."

### 3. Race condition in data persistence
The `src/claims.js` load-save pattern has no concurrency control:
```js
function load() { return JSON.parse(fs.readFileSync(FILE, 'utf8')); }
function save(state) { fs.writeFileSync(FILE, JSON.stringify(state)); }
```
If two requests write simultaneously (e.g., two managers approving different claims), one write will be lost. ID generation compounds this: `id: 'c' + (state.claims.length + 1)` can produce collisions.

**Impact**: Data loss and claim ID collisions under concurrent load.

### 4. Weak session secret default
The session secret defaults to 'change-me' if SESSION_SECRET is unset. While build-notes acknowledge this, production deployments that miss this environment variable are immediately compromised.

**Impact**: Session hijacking and account takeover.

## High-priority issues

### 5. Incomplete test coverage
Only one test exists; it does not exercise:
- Approval flow
- Authorization (manager-only approval)
- Input validation error paths (invalid date, category, amount)
- Listing claims for the correct user only

**Violation**: Engineering policy requires "Add focused automated tests for critical behavior and failure paths."

### 6. Authorization relies on downstream filtering
GET `/api/claims` has no explicit authorization check in `server.js`. It relies on `claimsFor()` to filter by `staffId`. A manager endpoint (e.g., GET `/api/claims/pending`) would share this pattern and could expose all claims. Defense-in-depth is missing.

## Design concerns

### 7. ID generation strategy
IDs are sequential: `c1`, `c2`, etc. If claims are ever deleted or soft-deleted, or if concurrency issues occur, IDs can collide. A UUID or timestamp-based ID is safer.

### 8. Approval authorization gap
The approve endpoint (`POST /api/claims/:id/approve`) checks `isManager` but does NOT check that the approver is the correct manager for the claim submitter. Any manager can approve any staff member's claims. This may be intentional, but should be documented or enforced.

## What works

- Session configuration (httpOnly, sameSite, secure) is correct.
- Authentication middleware on `/api/` routes is in place.
- Data model is sound (assuming amount validation is added).
- Basic architecture separates data (claims.js) from routes (server.js).

## Required work before release

1. **Implement the UI** – Add client-side JavaScript (sign-in form, claim submission, list, approval flow).
2. **Add amount validation** – Validate type (integer), sign (non-negative), and magnitude.
3. **Fix concurrency** – Use file locking, atomic writes, or migrate to a database.
4. **Fix session secret** – Make SESSION_SECRET required; fail at startup if not set.
5. **Expand test coverage** – Test approval, authorization, and all validation error paths.
6. **Explicit authorization on list endpoints** – Check role/permission before filtering.
7. **Document manager scope** – Clarify whether a manager can approve any staff or only direct reports.

## Summary

The backend structure is sound, but the tool is incomplete and insecure. The missing UI makes it non-functional. The unvalidated amount field and concurrency vulnerabilities make it unsuitable for production use. The team should:
- Hold this from production until the UI is built and tested.
- Address the validation and concurrency issues in the backend.
- Expand automated test coverage before deployment.

**Recommendation: Delay release by 1–2 weeks for completion and sign-off testing.**
