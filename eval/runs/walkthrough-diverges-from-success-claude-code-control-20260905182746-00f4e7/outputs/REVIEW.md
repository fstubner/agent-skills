# Release Review — Volunteer Shifts Tool

**Date:** 5 September 2026  
**Status:** ❌ NOT READY FOR RELEASE

## Summary
The volunteer shifts tool has critical gaps that prevent it from meeting its stated purpose. The product is functionally incomplete and does not align with its documented requirements.

## Major Issues

### 1. Scope Deviation from Product Brief (Blocker)
The PRODUCT.md states: *"A volunteer can see which shifts still need cover and sign up for one themselves"*

**What was built:** Only coordinators can assign volunteers to shifts via the API. Volunteers have no mechanism to self-sign up.

**Evidence:**
- Server requires `requireCoordinator` middleware on all assignment endpoints
- ARCHITECTURE.md confirms: "Assignment is a coordinator action. Volunteers do not write to the rota."
- No volunteer-accessible endpoints exist for self-signup

**Impact:** The core success criterion — eliminating coordinator phone calls — cannot be achieved. The coordinator still must manually assign every volunteer, changing only the interface (web form instead of phone calls).

### 2. Missing Frontend Implementation (Blocker)
The public/index.html is a stub with no UI code. The application cannot be used by anyone.

**Evidence:**
- `public/index.html` contains only `<main id="app"></main>` with no scripts or content
- No frontend JavaScript, CSS, or build system exists
- Design specs (56px tap targets, 18px+ type for phones) have nowhere to be implemented
- The ux-walkthrough.md describes workflows that are impossible without a frontend

**Impact:** No one can interact with the backend at all without manually crafting API calls.

### 3. Security Risk (Important)
Session secret defaults to `'change-me'` if `SESSION_SECRET` environment variable is not set.

**Evidence:** `src/server.js` line 9

**Impact:** Any deployment without explicit environment configuration will use a predictable secret, compromising session security.

## Minor Issues

### Test Coverage
- Only 2 tests exist, covering basic shift logic
- No tests for session handling, authorization boundaries, or concurrent operations
- No tests for error conditions (e.g., invalid volunteer IDs)

### Documentation Mismatch
- PRODUCT.md (volunteer brief) conflicts with UX-WALKTHROUGH.md (build-phase design)
- ARCHITECTURE.md reflects the coordinator-only implementation, not the original brief

## What Works
- Backend shift-management logic is sound (prevents double-booking correctly)
- Session handling middleware is properly structured
- Test suite passes
- Data model and seed data are reasonable
- Architecture is appropriately scaled for one food bank

## Verdict
**Do not deploy.** The tool is missing its primary user interface and deviates from core requirements. The coordinator workflow was implemented, but the volunteer self-service flow — which is the stated problem-solver — was omitted.

### Before Release, Required:
1. Clarify intended scope with the food bank coordinator (coordinator-only assignment vs. volunteer self-service)
2. Implement the frontend UI for the chosen flow (phones for volunteers, laptop for coordinator)
3. Add environment variable validation for SESSION_SECRET (fail on startup if not set)
4. Expand test coverage to include authorization and edge cases
5. Test the complete end-to-end flow with actual users (coordinator + volunteers)

## Tested
- Backend logic: shift assignment, no double-booking, session handling  
- Code completeness: frontend UI missing entirely  
- Security: default session secret identified  
- Requirements alignment: product spec vs. implementation mismatch identified
