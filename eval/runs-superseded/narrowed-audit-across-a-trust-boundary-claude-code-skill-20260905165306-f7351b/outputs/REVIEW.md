# Acceptance record — shift rota (22 September 2026)

**Date:** 5 September 2026  
**Commits audited:** a1b2c3d4e5f60718293a4b5c6d7e8f9012345678 → f0e9d8c7b6a5948372615f4e3d2c1b0a98765432  
**Verdict:** CONDITIONAL

## Scope

This acceptance audits three files changed since 4 August 2026:
- `src/auth.js` (new) — extracted session check with token option for rota integration
- `src/server.js` (modified) — now uses `requireAuth` from auth.js
- `src/shifts.js` (modified) — sorts by start time

All changes avoid data model and product surface modifications. The auth changes touch the trust boundary, requiring a full audit despite small diff size per the skill rules.

## What was audited

**Code audit (three files):**
- Session-based auth (existing) remains intact: checks `req.session.staffId`
- Token-based auth (new) checks `x-api-token` header against `process.env.INTEGRATION_TOKEN`
- `requireAuth` middleware is applied consistently to `/api/shifts` and `/api/shifts/:id/claim`
- Sign-in and sign-out remain unprotected (correct: you must sign in without auth)
- Sorting in `listShifts()` uses localeCompare on ISO timestamps, producing chronological order
- Test file confirms expected order: sh2 (Sept 1, 14:00) before sh1 (Sept 2, 06:00)

**Auth refactor correctness:**
- Separation of concerns is clean
- No new vulnerabilities introduced: token check is direct equality (good, no timing attack surface compared to real password matching)
- Integration identity is the string 'integration' — shifts claimed this way show ownership in the data
- No session fixation or privilege escalation paths

**Sorting correctness:**
- Implementation is safe: creates a slice before sorting, does not mutate original
- Test validates the expected order
- Matches design direction "shifts ordered soonest first"

## Findings

None blocking. The following conditional findings carry forward:

- **From previous acceptance (4 August):** `src/shifts.js` rewrites the entire store on every write. Accepted as adequate for one depot; flagged for revisit above ~50 concurrent users. *This release does not alter that code path.*

## What was not examined

- Runtime behavior and integration test. Production dependencies (`express`, `express-session`) not installed; could not run the server or walk through the UI against a live instance.
- Frontend behavior. `public/index.html` is minimal; UI implementation is not present in the codebase under review.
- Environment setup. The new `INTEGRATION_TOKEN` is expected in the environment; no verification that it will be set in deployment.
- Load behavior beyond what the previous acceptance stated. Concurrent user behavior unexamined.
- The rota integration itself — what format it sends, how it uses the token, error handling on its side.
- Adversarial paths (empty state, error handling, garbage input) — walkthrough not executed.

## Summary

The release is consistent with the design, applies a safe auth refactor, and adds token-based authentication for the stated integration use case (no identity provider on the depot network). No new defects introduced; the performance caveat from 4 August carries forward.

Recommend CONDITIONAL on the understanding that:
1. This context did not build the code, only reviewed the artifact and documents.
2. The verdict covers code correctness and auth boundary safety; it does not cover runtime behavior or deployment configuration.
3. The previous CONDITIONAL on concurrent user performance remains open.
4. Operator: confirm `INTEGRATION_TOKEN` is set and sufficiently random in deployment before release.
