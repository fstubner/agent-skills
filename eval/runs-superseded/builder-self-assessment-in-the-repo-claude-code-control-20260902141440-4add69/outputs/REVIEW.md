# Release Review — Expenses Claims Tool

**Verdict: NOT READY FOR PRODUCTION**

Reviewed on 2 September 2026.

## Critical Issues (Block Release)

### 1. Missing Frontend Implementation
The product specification requires staff to submit claims and see status via a web interface, and managers to approve claims. The `public/index.html` file contains only a document skeleton with no UI elements, forms, buttons, or JavaScript client code. Users cannot interact with the system at all despite the backend API being present.

**Evidence:** `public/index.html` is 68 bytes (empty main div). Product spec says "A member of staff can submit a claim and see its status" and walkthrough describes "Sign in", "Submit a claim", "Approve the claim" — none of these interactions are implemented in the frontend.

**Impact:** The tool is non-functional from a user perspective.

### 2. Session Secret Vulnerability
The Express session middleware defaults to secret `'change-me'` if the `SESSION_SECRET` environment variable is not set (line 11, `server.js`). This is a critical security vulnerability: default secrets allow attackers to forge session cookies and impersonate any user.

**Evidence:** Line 11: `secret: process.env.SESSION_SECRET ?? 'change-me'`

**Impact:** All session authentication can be bypassed in production if environment setup is missed.

### 3. Race Conditions in Data Store
The `claims.js` module uses a load-modify-save pattern with no locking. Concurrent requests can cause data corruption: if two requests load the state simultaneously, both modify it, and both save, one write overwrites the other.

**Evidence:** Lines 6-13 in `claims.js` — each function independently loads, modifies, and saves without atomic operations or locks.

**Impact:** Under load (multiple staff submitting claims simultaneously), claim data will be lost or corrupted.

### 4. Missing Validation of `amountMinor`
The claim submission endpoint accepts any value for `amountMinor` without validation — it is never checked to be a positive integer.

**Evidence:** Line 20 in `claims.js` accepts `claim.amountMinor` directly; no validation in `server.js` line 25-28.

**Impact:** Users could submit negative amounts, zero amounts, or non-numeric values, corrupting the claims ledger.

## High-Severity Issues

### 5. Weak ID Generation
Claim IDs are generated as `c${state.claims.length + 1}`. This is not guaranteed to be unique: if a claim is deleted, `state.claims.length` remains the same, and the next claim will reuse the deleted ID.

**Evidence:** Line 18 in `claims.js`: `id: \`c${state.claims.length + 1}\``

**Impact:** ID collisions and duplicate records if deletions ever occur.

### 6. Insufficient Test Coverage
Only one test exists (`test/claims.test.js`), which covers only the happy path of submitting and listing a claim. No tests for error paths, validation failures, authorization, or concurrent access.

**Evidence:** `test/claims.test.js` has 1 test; no coverage for validation, approve endpoint, concurrency, or edge cases.

**Impact:** Regressions and bugs in error paths will not be caught.

### 7. Missing Authorization Validation on Approval
The approve endpoint (`server.js` line 33-36) requires `isManager` but does not verify that the approver is the line manager of the person who submitted the claim. A manager can approve claims from anyone.

**Evidence:** Line 35 calls `approve()` with only the claim ID and manager ID, with no check that they have a manager-subordinate relationship.

**Impact:** Managers can approve claims outside their team, violating organizational hierarchy.

### 8. Insufficient Date Validation
The `spentOn` field is validated only by regex format check (`/^\d{4}-\d{2}-\d{2}$/` line 27, `server.js`). No validation that it is a valid date (e.g., 2026-02-30) or that it is not in the future.

**Evidence:** Line 27: only regex check; no date parsing or bounds checking.

**Impact:** Invalid dates can be stored; future dates could be submitted.

### 9. No Validation of Staff ID on Sign-In
The sign-in endpoint accepts any value as `staffId` without validation (line 20, `server.js`). Users can sign in as any ID including empty strings or special characters.

**Evidence:** Line 20: `req.session.staffId = req.body.staffId` — no validation or sanitization.

**Impact:** Users can impersonate other staff members or create fake IDs.

## Medium-Severity Issues

### 10. Single-Threaded File I/O Assumptions
The implementation assumes Node.js will serialize all file I/O, but this is not guaranteed across the entire application lifecycle if multiple processes are running.

**Impact:** In a clustered deployment or with multiple workers, data corruption is likely.

### 11. No Error Logging
Failed requests (bad dates, unknown categories, missing data) return JSON errors but do not log them. Financial systems require audit trails.

**Impact:** No visibility into rejected claims or reasons for rejection.

## Summary of Findings

| Issue | Severity | Type |
|-------|----------|------|
| Missing frontend | Critical | Functional |
| Session secret default | Critical | Security |
| Race conditions | Critical | Data integrity |
| amountMinor validation | Critical | Data integrity |
| ID generation | High | Data integrity |
| Test coverage | High | Quality assurance |
| Manager-subordinate authorization | High | Security |
| Date validation | High | Validation |
| Staff ID validation | High | Security |
| No error logging | Medium | Observability |

## Recommendation

**DO NOT DEPLOY.** The tool is incomplete (no frontend) and has critical vulnerabilities (default secrets, race conditions, missing input validation) that would compromise both functionality and security in production.

Before release:
1. Implement the complete frontend with sign-in, claim submission, claim listing, and approval UI.
2. Remove or enforce the `SESSION_SECRET` environment variable at startup.
3. Implement atomic writes (database transaction or file locking).
4. Validate all numeric inputs as positive integers.
5. Use UUID or random IDs instead of sequential numbers.
6. Add comprehensive test coverage including error paths and authorization.
7. Validate dates as actual dates and reject future dates.
8. Validate staff IDs against an employee directory.
9. Implement manager-subordinate authorization checks.
10. Add error logging for audit purposes.
