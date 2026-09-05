# Release Review: Expenses Claims Tool

**Status**: ⚠️ **NOT READY FOR PRODUCTION**

**Reviewer**: Independent code review  
**Date**: 2026-09-05

## Summary
The expense claims tool implements the MVP scope (submit, list own claims, approve, sign out) but has critical validation gaps and insufficient test coverage. Core functionality works but input handling is incomplete, creating risk in a shared system replacing a spreadsheet.

---

## Critical Issues (Must Fix)

### 1. Missing Amount Validation
**File**: `src/server.js` line 25–29  
**Issue**: `amountMinor` is never validated before being saved. Accepts negative, missing, non-numeric, or excessively large values.  
**Impact**: Corrupted claims data, incorrect finance records.  
**Fix**: Add bounds check (e.g., `0 < amountMinor ≤ 999999`, integer type).

### 2. Weak Authentication
**File**: `src/server.js` line 19–23  
**Issue**: Sign-in accepts any `staffId` and `isManager` boolean without verification. No actual authentication exists.  
**Impact**: Users can impersonate others or grant themselves manager privileges.  
**Fix**: Require authentication against employee records (out of scope for MVP but critical to document as a control gap).

### 3. Session Secret Default
**File**: `src/server.js` line 11  
**Issue**: Default session secret is `'change-me'` if `SESSION_SECRET` env var is missing.  
**Impact**: Sessions are predictable if the deployment doesn't set the env var.  
**Risk Mitigation**: Documented, but add pre-flight check to fail startup if secret is default.

### 4. Missing Field in Submit Endpoint
**File**: `src/server.js` line 28  
**Issue**: Passes entire `req.body` to `submit()` instead of whitelisting fields. Extra fields would be stored.  
**Fix**: Destructure or validate: `submit(req.session.staffId, { amountMinor: req.body.amountMinor, category: req.body.category, spentOn: req.body.spentOn })`.

### 5. Date Format Not Semantically Validated
**File**: `src/server.js` line 27  
**Issue**: Regex `^\d{4}-\d{2}-\d{2}$` accepts invalid dates like `9999-13-45`.  
**Fix**: Parse as `Date` or validate month/day ranges.

---

## High-Priority Issues

### 6. Insufficient Test Coverage
**File**: `test/claims.test.js`  
**Issue**: Only 1 test covering the happy path. No tests for:
- Rejection flows (bad category, bad date, invalid amount)
- Manager approval (including false manager check)
- Session isolation (can a user see another's claims?)
- Edge cases (empty amounts, special characters in category/date)

**Fix**: Add tests for all critical paths and error cases.

### 7. No Concurrency Control
**File**: `src/claims.js` lines 6–13  
**Issue**: JSON file read/modify/write is not atomic. Concurrent requests can lose data.  
**Impact**: If two staff submit claims simultaneously, one may be lost.  
**Fix**: Use file locking (e.g., `proper-lockfile`) or migrate to a database.

### 8. Approval Doesn't Verify Manager
**File**: `src/server.js` line 33–37  
**Issue**: Endpoint checks `isManager` flag but doesn't verify the manager is authorized for that staff member's claim.  
**Impact**: Any manager can approve any claim, even if not the line manager.  
**Fix**: Link claims to a manager and validate on approval.

---

## Medium-Priority Issues

### 9. No Timestamps or Audit Trail
**File**: `src/claims.js`  
**Issue**: Claims have no creation or approval timestamps.  
**Impact**: Finance cannot audit when claims were submitted/approved.  
**Fix**: Add `submittedAt` and `approvedAt` timestamps.

### 10. Frontend Implementation Missing
**File**: `public/index.html`  
**Issue**: File is empty except for an `<app>` div. No UI code visible.  
**Impact**: Tool cannot be used; frontend must exist for staff and managers to interact.  
**Fix**: Implement or confirm build/bundling process exists.

### 11. ID Generation Fragile
**File**: `src/claims.js` line 18  
**Issue**: ID is `c${state.claims.length + 1}`. If claims are ever deleted, IDs may collide.  
**Fix**: Use UUID or timestamp-based IDs, or document the append-only invariant.

### 12. No Export/Integration Path
**File**: Not present  
**Issue**: MVP is "replacing a spreadsheet," but no way to export data for payroll integration.  
**Impact**: Replaces spreadsheet but doesn't eliminate manual re-entry elsewhere.  
**Fix**: Add CSV export or API for payroll system (noted as out of scope but a hard blocker for "replacing").

---

## Low-Priority Issues

### 13. Error Messages Are Generic
**File**: `src/server.js` (multiple)  
**Issue**: "sign in", "unknown category", "bad date" don't describe what went wrong.  
**Fix**: Include expected values/format in errors.

### 14. No Logging
**File**: Not present  
**Issue**: No audit log for claims or approvals.  
**Fix**: Log submission, approval, and errors for compliance.

---

## Compliances Checked

✅ **MVP Scope Matched**:
- Submit a claim ✓
- List own claims ✓
- Approve a claim ✓
- Sign out ✓

✅ **Tech Stack**:
- Node 18+ ✓
- No external services ✓
- Internal network ready ✓

⚠️ **Spreadsheet Replacement**:
- Functional flow exists, but cannot export data—blocking full replacement.

---

## Recommendation

**DO NOT DEPLOY** to production on Monday without fixes.

**To unblock release**:
1. **Critical** (blocks all else):
   - Add validation for `amountMinor` (type, bounds).
   - Implement or retrieve authentic employee/manager records for sign-in.
   - Add pre-flight check for session secret.

2. **High** (required for MVP):
   - Add test cases for error paths and cross-user isolation.
   - Implement file locking or switch to persistent data store.
   - Confirm frontend is present and functional.

3. **Recommended before Monday**:
   - Add timestamps to claims.
   - Validate manager authorization (only approve own staff).
   - Implement export for payroll handoff.

**Alternative**: If constraints are strict, consider proposing a **2–3 week pilot** with a smaller group (e.g., one department) while these issues are resolved in parallel.

---

## Verified

- Core APIs respond to expected requests
- Submit/list/approve/sign-out endpoints exist
- Category and date validation present (though incomplete)
- Session middleware configured with secure defaults (httpOnly, sameSite)
- Tests run successfully for happy path
