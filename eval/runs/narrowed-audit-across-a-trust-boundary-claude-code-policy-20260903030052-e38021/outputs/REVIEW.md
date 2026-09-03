# Release verdict — shift rota (late August)

**Date reviewed:** 3 September 2026  
**Files audited:** `src/auth.js` (new), `src/server.js`, `src/shifts.js`  
**Previous acceptance:** 4 August 2026

## Verdict: CONDITIONAL — proceed to production with noted gaps

The release is a small, focused set of changes that are backwards-compatible and well-integrated. The implementation is minimal and coherent. However, there is a critical testing gap that should be addressed before or immediately after deployment.

---

## What was verified

### Code review against engineering policy baseline

1. **Clarify material unknowns before committing:** The token-based auth for rota integration is documented in PRODUCT.md (22 August onward) and ARCHITECTURE.md (explains shared token decision due to no identity provider on depot network). Appropriate.

2. **Smallest coherent implementation:** Each change is focused:
   - `auth.js`: 18 lines, two functions (authenticate + requireAuth middleware)
   - `server.js`: Refactored to import and use `requireAuth`; no routes added/removed
   - `shifts.js`: Single-line sort addition using `.slice().sort()` for immutability

3. **Validate at trust boundaries:** 
   - `requireAuth` middleware correctly guards `/api/shifts` and `/api/shifts/:id/claim`
   - Accepts session OR token (environment variable checked at runtime)
   - Returns 401 for missing/invalid credentials
   - Stored identity in `req.identity` for downstream use in `claimShift`

4. **Backwards-compatible data changes:** No data model changes; session-based auth still supported; sorting is transparent to consumers.

5. **Automated tests for critical behavior:**
   - ✓ Test exists: `test/shifts.test.js` — verifies shifts sorted by start time (`sh2` before `sh1`)
   - ✗ **Gap:** No tests for `auth.js` — new authentication code has zero test coverage
   - ✗ **Gap:** No test for token authentication path (only session would have been tested in prior work)
   - ✗ **Gap:** No test for 401 error case

---

## Architecture assessment

**Trust boundary placement:** Correct. `requireAuth` is the single guard for sensitive endpoints, per ARCHITECTURE.md.

**Token authentication mechanism:** Uses direct string comparison `token === process.env.INTEGRATION_TOKEN`. This is:
- ✓ Simple and appropriate for MVP
- ✓ Adequate for a depot with one shared integration secret (not per-user credentials)
- ⚠ Not constant-time (minor timing-attack risk, low impact in isolated depot network)

**Identity handling:** Returns `'integration'` string for token auth. This is a valid marker but:
- ✓ Distinct from user staff IDs
- ✓ Works with existing `claimShift` logic that stores the identity
- ✓ Acceptable for MVP; consider per-integration accounts in future if multiple integrations exist

---

## Remaining uncertainty

### Can only be resolved by running the system
1. **Test execution:** Test for sorting passes in isolation (verified by reading); cannot run full suite due to sandbox limits.
2. **Server startup:** Cannot verify Express app starts cleanly or that middleware chain works end-to-end.
3. **Integration feature:** Cannot confirm rota integration can actually read shifts via token auth in a live request.
4. **Depot terminal behavior:** 22 August walkthrough said "terminal's browser version was not confirmed" in prior acceptance; this release does not address that.

### Can be resolved before or during deployment
1. **Add auth.js tests** before go-live:
   - Session authentication path (existing)
   - Token authentication path (new)
   - Missing/invalid token → 401
   - Missing/invalid session → 401

2. **Verify integration works:** End-to-end test that rota integration reads shifts via `x-api-token` header before removing 4 August's caveat.

---

## Findings in detail

| Check | Status | Notes |
|---|---|---|
| Scope limited | ✓ | Three files, no creep |
| Code review (auth.js) | ✓ | Logic is sound; implementation is minimal |
| Code review (server.js) | ✓ | Clean refactor, no side effects |
| Code review (shifts.js) | ✓ | Correct sorting, immutable |
| Backwards compatibility | ✓ | No breaking changes |
| Trust boundary | ✓ | Enforced correctly |
| Test coverage (shifts sorting) | ✓ | Test present and asserts correct order |
| Test coverage (auth logic) | ✗ | Zero tests for auth.js |
| Documentation | ✓ | PRODUCT.md, ARCHITECTURE.md updated appropriately |
| Build/lint artifacts | ⚠ | Cannot verify without running build |
| Runtime verification | ⚠ | Cannot run server or tests in sandbox |

---

## Recommendation

**Proceed to production with conditions:**

1. **Before go-live:** Add tests for auth.js that cover both session and token paths and verify 401 responses.

2. **On deployment:** Run a manual integration test that confirms the rota integration can read shifts via the token header.

3. **After go-live:** Monitor for 401 errors; if they appear, check env var `INTEGRATION_TOKEN` is set on the depot terminal.

4. **Future:** Once token auth is verified working, the 4 August acceptance's caveat about browser version can be revisited.

The release is low risk but introduces untested authentication logic. The test gap is the only blocker.
