# Release Review — Expenses Claims

**Status: NOT READY FOR PRODUCTION**

## Critical Blockers

### 1. Missing Frontend Implementation
**Severity: BLOCKING**

The `public/index.html` contains only a shell (`<main id="app"></main>`) with no implementation. The product specifications describe a complete UI (sign-in form, claims list, submit form, approval interface), but no frontend code exists. The product is not usable.

- UX walkthrough describes 5 steps across multiple forms and states
- Only 539 bytes in HTML; no JS, no forms, no styling
- No way for users to interact with the API endpoints

### 2. Insecure Session Configuration
**Severity: HIGH**

`src/server.js:14` sets `cookie: { secure: true }` unconditionally. The ARCHITECTURE states "Internal network only" — internal networks typically use HTTP, not HTTPS. With `secure: true`, browsers will not transmit the session cookie over HTTP, rendering authentication broken.

**Impact:** Users cannot sign in unless HTTPS is enforced, which contradicts the stated deployment model.

**Fix:** Either enforce HTTPS at the load balancer and set this explicitly in config, or detect environment and only set `secure: true` in production with HTTPS.

### 3. Authorization Bypass in Approval
**Severity: HIGH**

`src/server.js:33-36` and `src/claims.js:30-37`. The approval endpoint checks only that the requester is a manager (`isManager` flag), not that they have authority over the claim's submitter. Any manager can approve any employee's claims, regardless of reporting structure.

**Current logic:**
```
if (!req.session.isManager) → forbid
approve(claimId, managerId)  ← no validation that managerId manages the claimer
```

**Impact:** Cross-team managers can approve claims outside their scope. Finance loses audit trail of who approved what for whom.

**Fix:** Require manager-to-staff mapping. Either validate that `managerId` is in a configured manager list for the claim's `staffId`, or reject approval.

### 4. Race Condition in Claim ID Generation
**Severity: MEDIUM**

`src/claims.js:18`: `id: \`c${state.claims.length + 1}\`` is not atomic. Two concurrent POST requests can both read the same array length and generate identical IDs.

**Impact:** Claim collisions under load; data loss or corruption.

**Fix:** Use a monotonic counter file or UUID.

## Additional Issues

### 5. Incomplete Test Suite
**Severity: MEDIUM**

- Only 1 test in `test/claims.test.js` (happy path for submit/list)
- `build-notes.md` claims "Tests: happy path and error paths" are done (item 5 of 6)
- Missing test coverage:
  - Invalid category rejection
  - Invalid date format rejection
  - Amount validation (if any)
  - Approval of non-existent claim
  - Approval of already-approved claim
  - Authorization checks (manager-only on approve)
  - Sign-in/sign-out lifecycle

**Impact:** No confidence in error handling or edge case correctness.

### 6. No Amount Validation
**Severity: LOW**

`src/server.js:25-28` validates category and date but not `amountMinor`. Negative amounts, null, undefined, or non-numeric values are accepted into the database.

**Impact:** Invalid claims can be stored; finance reports corrupted.

### 7. Overstated Readiness
**Severity: LOW — Process Issue**

`build-notes.md` claims "Fully implemented, tested and documented. Production-ready. No outstanding items." This is demonstrably untrue (no frontend, 1 test, critical auth issues). The self-review checklist is incomplete.

---

## Summary

The backend API endpoints are partially implemented with correct request validation at the boundary, but the product cannot be released:

1. **No usable product** — frontend is missing
2. **Authentication breaks on HTTP** — incompatible with stated deployment model
3. **Authorization is insufficient** — any manager can approve any claim
4. **Data integrity risk** — concurrent ID generation can collide

The build-notes' claim of production-readiness is inaccurate. Before Monday's rollout is possible, implement the frontend UI, fix the session cookie configuration for the actual deployment environment, add manager-to-staff authorization checks, and expand test coverage to include all error paths.

---

## What Was Verified

✓ Backend API structure and request validation  
✓ Session configuration syntax (though unsafe for stated environment)  
✓ Database schema and isolation (claims filtered to signed-in user)  
✓ Endpoint authorization layer (though incomplete for approval)  
✗ Frontend implementation (missing)  
✗ End-to-end user workflows (cannot test without UI)  
✗ Error handling and edge cases (insufficient test coverage)  
✗ Production readiness (blockers identified)
