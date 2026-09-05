# Release Review — Expenses Claims

## Verdict
**NOT PRODUCTION READY** — Critical functionality gaps and security issues prevent deployment. Finance cannot replace the spreadsheet with this tool.

## Critical Issues

### 1. Frontend not implemented
**Impact**: Tool is unusable. Users cannot access the application.
- `public/index.html` is an empty container (`<main id="app"></main>`)
- No JavaScript client exists to implement sign-in, submit, list, or approve flows
- `src/server.js` does not serve static files (`express.static()` not configured)
- UX walkthrough describes an end-to-end user flow that cannot currently happen

**Required to proceed**: Implement the frontend to match `ux-walkthrough.md`.

### 2. Cross-manager authorization flaw
**Impact**: Data integrity violation. Any manager can approve any staff member's claims, bypassing organizational hierarchy.
- `/api/claims/:id/approve` checks only `req.session.isManager` (line 34)
- Does not verify that the approving manager is the *line manager* of the claim's submitter
- A manager can approve claims for staff they do not supervise
- No relationship data model exists to enforce line-manager ownership

**Required to proceed**: Either (a) add line-manager field to claims and validate on approval, or (b) document that cross-manager approval is intentional and adjust scope/authorization model.

### 3. Missing input validation: amount
**Impact**: Data quality failure. Nonsensical claims can be stored.
- `amountMinor` field is stored without validation (line 20 in `src/claims.js`)
- Accepts negative, null, undefined, zero, non-numeric values
- No upper bound check
- Rejected claim in UI cannot show why amount was invalid (no error path coverage in tests)

**Required to proceed**: Validate `amountMinor` is a positive integer before storing.

## High-Risk Issues

### 4. Session secret hardcoded as weak default
**Impact**: Session hijacking risk. Default production deployment is insecure.
- Line 11 (`src/server.js`): falls back to `'change-me'` if `SESSION_SECRET` env var is missing
- This default would be used in a Monday deployment unless manually overridden
- Weak secret makes session tampering trivial

**Required**: Reject startup if `SESSION_SECRET` is not set in production mode. Or document that this is a single-office internal network and the risk is accepted.

### 5. No input validation: staffId
**Impact**: Authorization bypass risk. Malformed session state could enable spoofing.
- Sign-in endpoint stores `req.body.staffId` directly into session without validation (line 20)
- No length check, character class validation, or format enforcement
- Could contain injection payloads or cause downstream issues in authorization checks

**Required**: Validate staffId format before storing in session.

### 6. Predictable, sequential claim IDs
**Impact**: Information disclosure. Claim enumeration attack trivial.
- IDs are generated as `c1`, `c2`, `c3…` (line 18 in `src/claims.js`)
- Any user knowing the sequential ID scheme can enumerate all claims by incrementing
- No authorization check on ID format; IDs are global across all staff

**Suggested**: Use UUIDs or cryptographically random IDs if confidentiality of claim existence matters.

## Test Coverage Gaps

- Only 1 test exists; only happy path covered (`test/claims.test.js`)
- No tests for rejected claims (malformed amount, bad date, unauthorized approval)
- No tests for authorization boundaries (staff cannot see other staff's claims, non-managers cannot approve)
- No tests for the sign-in/sign-out flow
- Build notes claim "validation on every input" and "tests cover error paths" — tests do not validate these claims

**Required**: Add tests for validation failures and authorization checks before claiming test coverage.

## Architectural Observations

- JSON file datastore is appropriate for scale and constraints (single office, internal network)
- Session-based authentication is reasonable for internal deployment
- Single writer (`src/claims.js`) is good for avoiding concurrent write issues
- API design (sign-in, list, submit, approve, sign-out) matches MVP scope correctly

## Verification Summary

✓ Ran tests: all pass (1 test, happy path only)  
✓ Reviewed API endpoints: 5 routes, appropriate boundaries  
✓ Reviewed data persistence: JSON file, single writer  
✓ Checked authentication & authorization: session-based, but see issues #2, #4, #5  
✓ Reviewed documentation: PRODUCT.md, ARCHITECTURE.md, and `ux-walkthrough.md` all present  
✗ Verified frontend: **empty, no implementation**  
✗ Verified input validation: **gaps in amount and staffId**  
✗ Verified line-manager authorization: **not implemented**  
✗ Verified test error paths: **no tests for validation or auth failures**  

## Recommendation

**Do not deploy Monday.** Return to the builder for:
1. Frontend implementation (blocking)
2. Line-manager authorization model (blocking)
3. Amount validation (blocking)
4. Session secret enforcement (blocking)
5. StaffId input validation (high priority)
6. Claim ID scheme (optional; low risk given internal network)
7. Test error paths (required for "production-ready" claim)

Current state: API skeleton and persistence layer only. Frontend, security, and test coverage are incomplete.
