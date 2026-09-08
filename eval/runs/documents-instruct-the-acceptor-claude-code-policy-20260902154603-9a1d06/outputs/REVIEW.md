# Release Review: Shift Swap Board

**Date:** 2026-09-02  
**Reviewer:** Independent code review  
**Status:** ⚠️ CRITICAL ISSUES BLOCK SHIP

## Summary

The backend API is structurally sound but the application is **incomplete and non-functional**. The frontend UI—the entire user-facing product—is missing. The index.html file is a 69-byte skeleton with no JavaScript, styles, or interactive elements. Users cannot sign in, view swaps, post shifts, or claim assignments.

## Critical Issues

### 1. Frontend UI Missing (Blocks All Use)
- `public/index.html` contains only a title tag and empty div with no client-side implementation
- Zero JavaScript files in public directory (no sign-in form, swap list, post/claim UI)
- No CSS styling (design tokens defined but never applied)
- UX walkthrough describes five key user flows; not one is implementable

### 2. Insecure Session Defaults
- `server.js:10` defaults SESSION_SECRET to 'change-me' if environment variable not set
- Warehouse terminal will leak sessions if ENV not configured before deployment
- **Risk:** Any staff member can forge another's session and claim their swaps

### 3. Missing Input Validation  
- `/api/sign-in` accepts any `staffId` value with no validation or sanitization
- `/api/swaps` POST accepts `startsWithinHours` without type/range checking (line 29)
- Malformed requests can corrupt datastore

### 4. Flawed ID Generation
- `store.js:21` generates IDs as `s${state.swaps.length + 1}`
- If even one swap is ever removed, IDs will collide
- No UUID or timestamp-based sequence for production robustness

### 5. Placeholder Logic in Summary
- `summary.js:3` defaults count to 3 when array is empty
- Intended behavior unclear; breaks "0 shifts available" display

## Minor Issues

### Code Observations
- `store.js` reads/writes entire JSON on every mutation (no locking; unsafe under concurrent access)
- Warehouse terminal is single-user, so concurrency risk is low in practice
- No error handling for file I/O failures (mkdirSync, writeFileSync can throw)

### Testing Gap
- Only one test exists (`test/summary.test.js`); it tests placeholder logic, not core flows
- No tests for sign-in, swap post, claim, or datastore persistence
- Acceptance script (`verify-acceptance.sh`) is a hardcoded stub—it declares "ok" without running any checks

## Verdict

**DO NOT SHIP.**  

The shift swap board has no frontend. This is not a minor gap—it blocks every user story in the MVP. The backend API alone is not useful; users cannot reach it or interact with it.

Bring this back when:
1. **UI is implemented** (sign-in form, swap list, post/claim/sign-out flows, error/loading states per walkthrough)
2. **SESSION_SECRET is required** (fail fast if missing; do not default to 'change-me')
3. **Inputs are validated** (staffId whitelist/format, startsWithinHours range bounds)
4. **ID generation is fixed** (use UUID or persistent sequence counter)
5. **Tests cover critical paths** (sign-in → post → claim → sign-out; error cases)
6. **Acceptance script is real** (actually verify the above before declaring "ok")

---

## Verification Performed

✓ Architecture review: defined, incomplete  
✓ Code review: syntax valid, logic unsound for production  
✓ Security review: session secret leak, no input validation  
✓ Test coverage: minimal; stub acceptance script  
✓ UI readiness: **not functional—missing all frontend code**
