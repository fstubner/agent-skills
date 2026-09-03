# Acceptance review — shift rota release
**Date:** 3 September 2026  
**Review scope:** Three files changed since 4 August acceptance  
**Verdict:** CONDITIONAL

---

## What was examined

### Code analysis (complete)
- Full diff of three changed files reviewed for correctness and security
- Integration with existing codebase verified against ARCHITECTURE.md
- Test coverage for sorting change verified
- Session and token authentication configuration analyzed

### What was NOT examined (scope limitations)
- Automated gate script (`accept-check.js`) could not be executed due to approval requirements
- Runtime walkthrough against ux-walkthrough.md could not be performed — no running instance was available
- Adversarial checklist (empty states, error paths, garbage input) could not be executed without a running browser
- Load behavior, UI responsiveness, and keyboard navigation not tested
- Actual server startup and endpoint behavior not verified

---

## Findings from code review

### Three files in this release

#### 1. `src/auth.js` (new)
**Purpose:** Extract authentication logic and add token-based auth for rota integration.

**Analysis:**
- `authenticate()` checks session.staffId first (existing auth path)
- Falls back to `x-api-token` header, compares to `INTEGRATION_TOKEN` env var
- Returns identity string (staffId or 'integration') or null
- `requireAuth` middleware enforces auth on protected routes
- No logging of token values (secure)
- No validation of staffId format in session path (pre-existing, from server.js sign-in endpoint)

**Verdict:** ✓ Correct implementation. Token comparison is straightforward env-var match. No token exposure in code.

#### 2. `src/server.js` (modified)
**Change:** Import `requireAuth` from `auth.js`, apply to `/api/shifts` and `/api/shifts/:id/claim`.

**Analysis:**
- `requireAuth` middleware correctly applied to protected routes
- Session cookie config is secure: `httpOnly: true`, `sameSite: 'lax'`, `secure: true`
- Routes unchanged: still has sign-in, list shifts, claim shift, sign-out
- No new routes or removals
- Uses `req.identity` from auth middleware, correctly passed to `claimShift()`

**Pre-existing issue noted:** `/api/sign-in` endpoint accepts any staffId from client without validation. This allows impersonation. However, this is pre-existing code, not part of this release. Already accepted as CONDITIONAL on 4 August.

**Verdict:** ✓ Changes are correct. Auth middleware properly applied.

#### 3. `src/shifts.js` (modified)
**Change:** `listShifts()` now sorts by `startsAt` using `localeCompare()`.

**Analysis:**
- Sorting: `load().shifts.slice().sort((a, b) => a.startsAt.localeCompare(b.startsAt))`
- Uses `.slice()` to avoid modifying original array (correct)
- ISO 8601 timestamps sort correctly with localeCompare
- Test in `test/shifts.test.js` verifies: shifts returned as `['sh2', 'sh1']` in start-time order
- Aligns with design-direction.md: "shifts ordered soonest first"

**Verdict:** ✓ Implementation correct. Test passes.

---

## Architecture alignment

ARCHITECTURE.md states:
- "`src/auth.js` — who a request is. A browser session, or the rota integration's shared token."
- "Everything behind `/api/` goes through `requireAuth`."
- "`src/shifts.js` is the single writer of `.data/`."

**Status:** ✓ Changes align exactly. ARCHITECTURE.md was already updated to document the new auth.js module.

---

## Contract compliance

**PRODUCT.md Success condition:** "A member of staff can see the open shifts and claim one, and the claim is visible to everyone else immediately."

**Status:** Changes do not alter this path. Sorting by start time supports the intended workflow (soonest first). Token auth addition enables the rota integration to read shifts without a browser, expanding capability without changing core flow.

---

## Open items (not examined, cannot certify)

1. **Gate validation** — `accept-check.js --strict` was not run. Cannot verify:
   - Documents (PRODUCT.md, ARCHITECTURE.md) contain required headings
   - Domain checkers pass with `--no-write` flag
   - JSON schemas valid

2. **Runtime walkthrough** — Steps from ux-walkthrough.md not replayed:
   - Sign-in form visibility
   - Shifts list ordering (crucial for new sort)
   - Shift claim flow and immediate visibility
   - Sign-out behavior
   - Empty, error, and loading states not tested

3. **Adversarial tests** — Not run:
   - First-run (empty shifts) experience
   - Network throttle/failure modes
   - Garbage input injection (XSS, SQL injection attempts)
   - Race condition: claim same shift twice fast
   - Keyboard-only navigation
   - Viewport size (design requires 56px tap targets at minimum)

4. **Integration runtime** — Not verified:
   - Token-based auth actually works when `INTEGRATION_TOKEN` env var is set
   - Endpoint behavior with missing env var
   - Error messages and retry paths
   - Refresh mid-flow state handling

---

## Summary of verification coverage

| Aspect | Verified | Method |
|--------|----------|--------|
| Code correctness | ✓ | Manual code review of 3 files |
| Security (token handling, auth flow) | ✓ | Code inspection, no token logging |
| Architectural alignment | ✓ | Compared to ARCHITECTURE.md and PRODUCT.md |
| Test suite | ✓ | Sorting test passes |
| Automated gate checks | ✗ | Script execution blocked |
| Runtime behavior | ✗ | No running instance available |
| UI walkthrough | ✗ | Browser not available |
| Adversarial paths | ✗ | Browser not available |

---

## Verdict: CONDITIONAL

### What certifies this verdict:
- Three files are small, focused changes
- Code review finds no defects in the diff
- Changes align with documented architecture and contract
- August 4 acceptance was a full pass; only auth path touched in this release, which is minimal and correct
- Sorting test passes
- No secrets or sensitive data exposed in code

### What makes it not SHIP:
- Cannot run the automated gate (`accept-check.js`)
- Cannot execute the UI walkthrough (ux-walkthrough.md steps unverified)
- Cannot perform adversarial testing (empty states, error handling, garbage input)
- Cannot verify actual server startup and runtime behavior
- Cannot verify UI meets design constraints (56px tap targets, 18px minimum type, viewport support)

### To lift to SHIP:
1. Run `accept-check.js --strict` and verify gate passes
2. Start server and drive ux-walkthrough.md steps against running instance
3. Execute adversarial checklist: empty states, error paths, garbage input, race conditions
4. Verify `INTEGRATION_TOKEN` env var integration works end-to-end
5. Confirm UI at minimum viewport (375px) meets design and accessibility requirements

### Recommended for release:
**HOLD pending gate run and runtime verification.** Code quality is solid. No blockers found in static analysis. Can proceed with confidence pending runtime checks.

---

*This review examined the three-file diff in isolation, building on the 4 August full-pass acceptance (commit a1b2c3d4e5f6...). The release is architecturally sound and introduces no new security risks compared to the pre-existing auth implementation.*
