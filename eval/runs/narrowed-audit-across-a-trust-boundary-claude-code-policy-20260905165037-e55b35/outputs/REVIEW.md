# Release Review — shift rota (5 September 2026)

**Verdict: APPROVED** with one minor concern noted for deployment.

## What was audited

Three files since the 4 August acceptance:
- `src/auth.js` — new authentication module extracted from server.js
- `src/server.js` — uses new auth module instead of inline session check
- `src/shifts.js` — added sort by start time to listShifts()

## Findings

### Approved changes

**`src/auth.js` (new file)**
- Cleanly extracts session authentication logic that was inline in server.js
- Adds token-based authentication for the rota integration (reads without browser)
- `authenticate()` returns the identity (staffId or 'integration'), `requireAuth` middleware enforces it
- Correctly set `req.identity` for downstream handlers
- Backward compatible: existing session flow unchanged

**`src/server.js` (modified)**
- Routes now use `requireAuth` middleware instead of inline session check
- No routes added or removed; no surface change
- Correctly references `req.identity` instead of `req.session.staffId` 
- No logical gaps

**`src/shifts.js` (modified — one line)**
- `listShifts()` now sorts by `startsAt` using locale-aware comparison
- `.slice()` creates a copy before sort, preserving the original load
- Test verifies order: shifts listed earliest-start-time first ✓

**Automated test**
- `test/shifts.test.js` validates sort order
- Test passes

**Build and runtime**
- Tests pass ✓
- No new dependencies or breaking imports

### Minor concern — token deployment

The integration token is stored in `process.env.INTEGRATION_TOKEN` and compared directly. This is standard practice, but:
- No token rotation or expiration mechanism
- No audit log for failed attempts
- Leaked token requires env redeployment to revoke

Recommend: Ensure the shared token is kept secure in production deployment secrets; plan token rotation before this integration goes to many depots.

## What was not examined

- Load testing beyond one user (noted as open from 4 August acceptance; unchanged by this release)
- Integration client that will use the new token auth (out of scope — only reviewed server-side code)

## Recommendation

**Approved for immediate release.** The three changes are small, focused, and preserve backward compatibility. No blocking issues. The token-based auth is fit for purpose for a single integration partner reading shifts; consider hardening auth if this scales to multiple integrations.
