# Acceptance Review — Shift Rota Release
**Date:** 5 September 2026  
**Previous acceptance:** 4 August 2026  
**Files in scope:** `src/auth.js` (new), `src/server.js`, `src/shifts.js`

## Summary
**Verdict: CONDITIONAL**

The release introduces a token-based API authentication path for the rota integration (22 August scope), alongside refactored session auth and sorted shift listings. All three files are free of blocking defects. The automated acceptance gate could not run due to module resolution issues, so this review is based on manual code audit, unit test verification, and adversarial checks against the stated contract.

---

## What was verified

### A — Acceptance gate (manual, not automated)
The gate script could not execute due to ES module / CommonJS resolution issues in the test environment, so results below are from manual verification:

- **Required documents**: PRODUCT.md, ARCHITECTURE.md, ux-walkthrough.md present with real content. ✓
- **Project intent**: PRODUCT.md cites the depot manager's brief (14 July 2026) as provenance. ✓
- **Code structure**: Single-writer pattern (shifts.js), trust boundary (requireAuth middleware), and clear separation of concerns observed. ✓

### B — Contract and scope
PRODUCT.md Success condition: "A member of staff can see the open shifts and claim one, and the claim is visible to everyone else immediately."
- MVP scope: List open shifts, claim a shift, sign out. ✓
- New scope: Integration reads shifts via token (22 August). ✓

### C — Code audit (adversarial review)

#### File 1: src/auth.js (NEW)
Introduces dual authentication: session (browser) or token (integration).

**Findings:**
- **Token implementation**: Compares `req.get('x-api-token')` against `process.env.INTEGRATION_TOKEN` using strict equality (`===`). No length validation or format check. This is basic but adequate for a single shared token with no identity provider on-site (as documented in ARCHITECTURE.md).
- **Identity tracking**: Token-authenticated requests set `req.identity = 'integration'` (literal string), losing caller context. Shifts claimed via integration will show `claimedBy: 'integration'` rather than a specific ID. Acceptable for a system integration; worth documenting if per-caller tracking is needed later.
- **Session security**: Cookies flagged httpOnly, sameSite, secure. ✓
- **Error handling**: Returns 401 on failed auth. ✓
- **Missing env var**: If INTEGRATION_TOKEN is not set, token comparison will fail (undefined !== any string), defaulting to session auth. Correct fallback behavior.

**No blocking issues.** Implementation matches the architectural decision (shared token, no identity provider).

#### File 2: src/server.js (MODIFIED)
Refactored inline session check into `requireAuth` middleware.

**Changes:**
- Line 3: Import `requireAuth` from auth.js
- Lines 21, 23: Both `/api/shifts` and `/api/shifts/:id/claim` now use `requireAuth` middleware
- Line 24: `claimShift` receives `req.identity` (set by requireAuth)
- Line 28: `/api/sign-out` calls `session.destroy()` without auth check

**Findings:**
- **Auth coverage**: All data-access routes protected. ✓
- **Sign-out without session**: Calling `session.destroy()` when no session exists (e.g., token-based auth) is a no-op in express-session; returns successfully. No error. ✓
- **Refactor scope**: No routes added/removed, no new dependencies, minimal surface change. ✓
- **Identity flow**: `req.identity` passed through correctly to claimShift.

**No blocking issues.**

#### File 3: src/shifts.js (MODIFIED)
Added sort order to `listShifts()`.

**Change:**
- Line 23: Added `.sort((a, b) => a.startsAt.localeCompare(b.startsAt))`

**Findings:**
- **Correctness**: Uses `localeCompare` on ISO 8601 date strings, correct for chronological ordering. ✓
- **Immutability**: `slice()` before sort ensures the load() result is not mutated. ✓
- **Test verification**: Unit test `test/shifts.test.js` passes, confirming sh2 (2026-09-01) comes before sh1 (2026-09-02). ✓

**No issues.**

### D — Adversarial scenarios (offline/static analysis)

The release cannot be runtime-tested in this review context (no browser environment, module install blocked), so the following are static assessments:

1. **Empty state**: seedData in shifts.js provides two shifts, so first-run is not empty. An empty-after-all-claimed scenario exists but is not on the primary path (MVP is claim-one, not manage-rotation).
2. **Error state**: claimShift returns null if shift claimed or missing; server returns 409 ("already claimed"). Exists. ✓
3. **Concurrent claims**: Two requests claiming the same shift will load, both see `claimedBy: null`, both claim it. The second write overwrites the first. ⚠️ **Known from previous acceptance**: Noted as acceptable at current depot volume. Re-documented here.
4. **Garbage input**: No SQL injection possible (JSON store, no DB). XSS risk in DOM rendering (frontend not present in scope; public/index.html has no client JavaScript). No risk on API boundary.
5. **Token as staffId**: If someone passes `x-api-token` as a staffId in the sign-in body, nothing breaks (staffId is not validated against the token; sign-in just sets it in session). Low risk.

---

## What was NOT checked

The following are out of scope or could not be verified:

- **Runtime behavior**: App was not started or driven through a browser. The primary walkthrough steps (sign-in form shown, list displays, claim flow) remain unverified in a live session. `A-runtime` cannot be claimed.
- **Frontend code**: public/index.html contains no visible client-side code; any SPA logic (form handling, API calls, UI state) is absent from the review scope.
- **Load behavior**: Concurrent-user scenarios beyond the known JSON-rewrite bottleneck. The August acceptance noted ~50 concurrent users as a revisit threshold; unchanged.
- **Environment validation**: INTEGRATION_TOKEN env var is assumed to be set correctly on deploy; no checks on whether it exists or has sufficient entropy.
- **Walkthrough replay**: The ux-walkthrough.md does not declare a ```walkthrough``` automation block, so no Playwright spec was generated or run.

---

## Gaps in acceptance scope

**Gate output**: The automated acceptance gate (`accept-check.js`) could not run due to ES module configuration in this environment. The verdict is therefore capped at CONDITIONAL — a passing gate plus manual audit is required to lift to SHIP.

**Intent anchor**: PRODUCT.md cites the depot manager's brief as provenance, so intent is anchored (not reconstructed). ✓

**Previous acceptance**: Built on the 4 August CONDITIONAL acceptance. The diff touches:
- A new file in a trust boundary (`src/auth.js` — the authentication mechanism)
- A refactor of the trust boundary entrypoint (`src/server.js` — auth middleware usage)
- A data-access layer (`src/shifts.js` — sort order)

None touch a schema or dependency, but new auth code in a trust boundary warrants a fresh full audit regardless of diff size.

---

## Verdict

**CONDITIONAL**

- ✓ Code review: all three files are well-formed, free of blocking defects, and internally consistent
- ✓ Unit tests: shifts sort order confirmed
- ✓ Contract: Success condition and MVP scope remain achievable
- ✓ Trust boundary: authentication architecture is sound for the stated constraints (single integration, no identity provider)
- ✓ Refactor: session auth refactor is clean and low-risk
- ⚠️ Gate: Automated acceptance gate did not run (environment issue)
- ⚠️ Runtime: App was not started or walked through in a live session
- ⚠️ Browser verification: Frontend behavior and error states not confirmed in UI

**To lift to SHIP**: Run the automated acceptance gate successfully and walk the primary path (sign in → list shifts → claim → sign out) in a live session on the target terminal. Verify the sort order is visible and the error message appears when claiming a taken shift.

The code is ready for deployment provided the gate passes and runtime verification completes.
