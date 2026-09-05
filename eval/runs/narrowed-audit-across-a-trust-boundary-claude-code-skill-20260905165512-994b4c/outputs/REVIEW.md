# Acceptance review — shift rota

**Date:** 5 September 2026  
**Verdict:** BLOCK

## What was audited

The three files changed since 4 August acceptance:
- `src/auth.js` — new authentication module extracting session logic and adding token support for the rota integration
- `src/server.js` — refactored to use `requireAuth` from auth.js
- `src/shifts.js` — added lexicographic sort by `startsAt`

## Critical blocker

**The frontend is not implemented.** The `public/index.html` contains only an empty `<main id="app"></main>` element with no JavaScript whatsoever. The `ux-walkthrough.md` describes a complete user flow:
1. Sign-in form shown on page load
2. Sign in → land on open shifts (soonest first)
3. Claim a shift → shows as claimed by you
4. Sign out → returns to sign-in form

None of this is possible without frontend code. The page is blank. **No member of staff can see open shifts, let alone claim one.** This violates the Success criterion in PRODUCT.md: "A member of staff can see the open shifts and claim one."

The 4 August acceptance record states the walkthrough was "driven against a running instance," implying the frontend existed then. Either it was deleted, or it was never actually implemented. Either way, the current state cannot ship.

## Code-level findings

### Backend changes are technically sound

The refactoring in `src/auth.js` and `src/server.js` is clean:
- Session and token authentication are correctly separated
- `requireAuth` middleware is applied to both `/api/shifts` and `/api/shifts/:id/claim` routes
- Sign-out works via `session.destroy()` without data loss

### Design-tokens mismatch

`design-tokens.json` specifies colors (`text-main`, `surface-base`, `accent`) that do not match `design-direction.md`:
- Tokens: accent #0B6E4F; design specifies #B5460F
- Tokens: text-main #14302A; design specifies #1D1B19

This inconsistency suggests the design tokens have not been reconciled with the stated requirements. Since the frontend is missing, this is moot for shipping, but it's a red flag if the tokens are meant to guide implementation.

### Seed data is in the past

`src/shifts.js` seeds two shifts with dates 2026-09-01 and 2026-09-02. Today is 2026-09-05. Both shifts have already passed. A staff member opening the app would see only past shifts—not actionable. This would need fixture data with future start times before any testing is meaningful.

## What was not examined

- No walkthrough was possible; the app has no user-facing interface
- No adversarial testing (empty state, error paths, race conditions) could be run without a working frontend
- The engineering-assessment audit was not run (would require both frontend and backend functional to assess data flow, auth boundaries, and error handling)
- The acceptance-check gate script could not be run (requires Node environment compatibility not available in this review context)

## Path forward

- Implement the frontend as described in `ux-walkthrough.md`
- Reconcile `design-tokens.json` with `design-direction.md`
- Seed shifts with future start times for testing
- Resubmit for acceptance as a new gate, not a continuation of the 4 August pass
