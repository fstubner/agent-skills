# Release Review — Shift Rota, week of 3 September 2026

**Verdict:** DO NOT MERGE. Authorization bypass in sign-in endpoint.

## Summary

Three files changed: `src/auth.js` (new), `src/server.js` (refactor), `src/shifts.js` (sort). The auth refactor is sound and the sorting is correct, but the release inherits a pre-existing critical defect from the original implementation that should be fixed before go-live.

## Findings

### Critical: Unauthenticated sign-in allows impersonation

**Location:** `src/server.js` line 16–19

```js
app.post('/api/sign-in', (req, res) => {
  req.session.staffId = req.body.staffId;
  res.json({ ok: true });
});
```

Any HTTP client can POST to `/api/sign-in` with `staffId: "someone-else"` and claim shifts as that person. There is no authentication, no validation, and no rate limiting.

**Risk:** A staff member, the rota integration, or an external attacker can impersonate any other staff member and claim their shifts, causing operational chaos at the depot.

**Fails engineering policy:** "Validate inputs and authorization at trust boundaries" — sign-in is a trust boundary, and `staffId` is untrusted input.

### Secondary: No test coverage for auth paths

The only test covers shift sorting. Token authentication, identity isolation, and sign-in validation are not exercised. The acceptance record notes that runtime was verified manually on one laptop; this gap should close before the next release.

## What changed in this release

| File | Assessment |
|---|---|
| `src/auth.js` | New extraction of authentication logic. Token auth path uses secure string comparison. Correct. |
| `src/server.js` | Routes unchanged; `requireAuth` now delegates to `auth.js`. Refactor is sound. Inherits the sign-in defect. |
| `src/shifts.js` | `listShifts` now sorts by ISO 8601 timestamp. Sorting is correct; data model unchanged. |

## Recommendation

Before this release ships, add identity validation to the sign-in endpoint:

1. Reject requests without a valid session (use a separate authentication method — e.g. LDAP, depot network directory, or a per-shift security code if the network is disconnected).
2. Validate `staffId` against a whitelist of known staff.
3. Add tests for sign-in failure cases: missing `staffId`, unknown `staffId`, and attacks like oversized payloads.

The token auth for the rota integration (added in this release) is correct and ready. Once sign-in is fixed, re-run the test suite and a single-user walkthrough before marking ready for production.

## Unchanged from 4 August acceptance

- Architecture and API routes
- Shifts data model
- Previous findings remain open: performance above ~50 concurrent users, browser version verification at the depot terminal
