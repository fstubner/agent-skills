# Release Review — shift rota (22 August – 3 September)

**Date reviewed:** 3 September 2026  
**Baseline:** Acceptance record from 4 August 2026  
**Head commit:** f0e9d8c7b6a5948372615f4e3d2c1b0a98765432

## Summary

Three files. A refactoring of authentication, introduction of token-based auth for the rota integration, and a one-line sort of shift listings. No breaking changes to the API or data model. The changes are additive and maintain backwards compatibility.

**Verdict:** CONDITIONAL PASS

---

## What was audited

- `src/auth.js`: New file. Extracts and extends authentication logic.
- `src/server.js`: Refactored to use the new `requireAuth` function; no routes added or removed.
- `src/shifts.js`: Added `.sort()` call to `listShifts` ordering by ISO timestamp.
- Test suite: One new test validates sort order.
- Architecture, design direction, and UX walkthrough: Reviewed for consistency.

## Key findings

### ✅ Strengths

1. **Backwards compatible.** Existing sessions continue to work; the token path is additive.
2. **Trust boundary preserved.** All `/api/*` routes are behind `requireAuth`.
3. **Sorting is correct.** Shifts ordered by `localeCompare` on ISO 8601 timestamps; `.slice()` prevents mutation. Test validates the order.
4. **Environment-driven token.** `INTEGRATION_TOKEN` is read from `process.env`, not hardcoded.
5. **Secure cookies.** Session cookies are `httpOnly`, `sameSite: 'lax'`, and `secure` (prevents XSS/CSRF).
6. **No data model change.** Shifts schema unchanged; rolling deploy not at risk.

### ⚠️ Concerns

1. **Session secret default.** Hardcoded fallback to `'change-me'` if `SESSION_SECRET` is not set. In production, this **must** be overridden; the code is permissive here and relies on deployment practices. Recommend explicit validation or error at startup if not provided.

2. **No automated test for token auth.** The new `x-api-token` header path is not covered by the test suite. The integration will work, but edge cases (missing token, invalid token, token claim) are unverified.

3. **Silent token misconfiguration.** If `INTEGRATION_TOKEN` env var is absent, the condition `token === process.env.INTEGRATION_TOKEN` silently fails (undefined comparison), and the integration cannot authenticate. No error is logged. If the integration is deployed in August but the token is not yet configured, auth silently fails. Should either warn at startup or fail fast if the integration is present.

4. **No input validation on POST /api/sign-in.** The endpoint accepts any `staffId` from `req.body` without validation. In a depot context where staff are trusted and there is no external API surface, this is acceptable, but it contradicts the policy to "validate inputs at trust boundaries." Recommend a brief comment explaining why it's skipped here.

5. **Integration identity is a string literal.** The identity for rota reads is hardcoded as the string `'integration'` in `authenticate()`. This is adequate for audit logging (one can see "claimed by: integration" vs. claimed by a staffId), but it's not validated against anything and is not idempotent across deployments. If you want to distinguish between multiple integrations or rotate credentials later, this design will need revision.

6. **Terminal browser version not yet confirmed.** The 4 August acceptance noted: "Runtime was verified on a laptop, not on the depot terminal. The terminal's browser version was not confirmed." This release adds a token path that the depot staff will not use (they use sessions), but the integration will depend on it working on the terminal or the integration's own client. Recommend confirming the terminal can reach the `/api/shifts` endpoint over HTTP or HTTPS before deploying.

### ✅ Security / trust boundary

- Refactoring keeps the boundary intact: `authenticate()` is the sole arbiter of identity; endpoints do not re-check.
- No privilege escalation. Session and token paths lead to the same API surface.
- No credential exposure. Token is not logged (read from header, never echoed).
- No path traversal, injection, or SSRF vectors introduced.

### ✅ Backwards compatibility

- Existing clients (depot staff using sessions) are unaffected.
- No schema or route changes.
- No deprecations.

---

## Test coverage

| Scenario | Covered? | Notes |
|---|---|---|
| Shifts listed in start-time order | ✅ Yes | `shifts.test.js` validates order via seed data. |
| Session auth | ⚠️ Implicit | Tested by existing walkthrough; no new unit test. |
| Token auth | ❌ No | New path; no automated test. Untested. |
| Claim after token auth | ❌ No | Untested. |
| Missing/invalid token | ❌ No | Returns 401; untested. |
| Missing session and token | ❌ No | Returns 401; untested. |

---

## Data and state

- Shifts are stored in `.data/shifts.json`.
- No migrations needed; existing data format is unchanged.
- Seed function provides two shifts; sorting applies to the list.
- Load/save are atomic (single `writeFileSync`); acceptable for single-depot scale.

---

## Deployment readiness

- **Dependencies:** Express, express-session. Versions in `package.json` are compatible with Node 18+. ✅
- **Env vars required:** `SESSION_SECRET` (recommended), `INTEGRATION_TOKEN` (new, required for integration).
- **Configuration:** Session cookie is marked `secure: true`, so HTTPS is expected. Confirm the depot terminal uses HTTPS or adjust to `false` if necessary.

---

## Outstanding items before live

1. **Configuration:** Ensure `INTEGRATION_TOKEN` is set in production and `SESSION_SECRET` is overridden from the default.
2. **Terminal verification:** Confirm the depot terminal browser can reach `/api/shifts` with a valid token header.
3. **Integration test:** Add a unit test or integration test for token-based auth before release if this path is critical for the rota integration going live.
4. **Optional:** Add input validation to `/api/sign-in`, or document why it's skipped.

---

## Verdict

**CONDITIONAL PASS.** The release is sound: no breaking changes, the refactoring is clean, sorting is correct, and the new auth path does not compromise the existing one. However, **do not deploy without**:

1. Configuring `INTEGRATION_TOKEN` in production.
2. Verifying the terminal can call `/api/shifts` with the token.
3. Confirming `SESSION_SECRET` is overridden from the default in production.

Once those three items are confirmed, this release is ready for live deployment on the depot terminal.
