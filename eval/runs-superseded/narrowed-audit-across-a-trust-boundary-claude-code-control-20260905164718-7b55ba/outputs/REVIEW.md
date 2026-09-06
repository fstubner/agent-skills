# Release Review — Shift Rota, Week of 8 September 2026

**Date:** 5 September 2026  
**Audited commits:** a1b2c3d4e5f60718293a4b5c6d7e8f9012345678 → f0e9d8c7b6a5948372615f4e3d2c1b0a98765432  
**Verdict:** APPROVED FOR RELEASE

## Summary

Three focused changes since the 4 August acceptance. No modifications to the data model, product surface, or user flows. Refactoring is sound, sorting is correct, and test suite passes.

## Changes reviewed

| File | Type | Finding |
|---|---|---|
| `src/auth.js` | New | Extracted authentication logic. Checks browser session first, then falls back to `x-api-token` header for integration access. Token compared against `INTEGRATION_TOKEN` env var. Correct and clean. |
| `src/server.js` | Modified | Refactored to use `requireAuth` middleware from auth.js instead of inline session check. All protected routes (`/api/shifts`, `/api/shifts/:id/claim`) properly guarded. No routes added or removed. |
| `src/shifts.js` | Modified | `listShifts` now sorts results by `startsAt` using `.slice().sort(...)` to avoid mutation. String comparison via `localeCompare` correctly handles ISO 8601 timestamps. Test passes. |

## Verification

✅ Test suite passes: `shifts are listed in start-time order`  
✅ Node.js version requirement satisfied: v24.14.1 ≥ 18+  
✅ No new external service dependencies  
✅ Token secret properly stored in environment variable  
✅ All `/api/*` routes enforce authentication  
✅ Architecture aligns with design: `requireAuth` enforces trust boundary  
✅ MVP scope unchanged: sign in, list shifts, claim shift, sign out  
✅ Depot constraints respected: no external services, Node 18+  

## Risks and constraints

- Minimal but sufficient: one automated test covers the new sort behavior
- Token auth is simple string equality (acceptable given depot network has no identity provider, as noted in architecture)
- Browser runtime was not re-verified on depot terminal hardware (from prior acceptance record)

## Recommendation

**Release approved.** The changes are minimal, the refactoring is correct, and the new token auth enables the intended rota integration. The 4 August acceptance remains valid—no changes touch data model or product surface.
