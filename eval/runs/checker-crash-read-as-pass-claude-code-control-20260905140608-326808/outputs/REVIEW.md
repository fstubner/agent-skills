# Release Review: Invoice List

**Date:** 2026-09-05  
**Status:** ❌ DO NOT SHIP  
**Blocker Count:** 3 critical issues

## Summary
The invoice list cannot be released. Frontend and backend are fundamentally misaligned, authentication is non-functional, and security controls are violated.

## Critical Blockers

### 1. Frontend Does Not Implement Authentication
**Impact:** App is broken on first use  
**Evidence:**
- `public/app.js` does not call `/api/sign-in` endpoint
- Frontend makes unauthenticated requests to `/api/invoices`
- Backend returns 401 for all requests (no `req.session.staffId`)
- UX walkthrough documents required sign-in form; none exists in `public/index.html`

**Requirement Failure:** MVP scope requires "Sign in, list my own invoices, sign out." Current implementation skips sign-in entirely.

**Fix Required:** Frontend must implement:
- Sign-in form UI for staff entry
- Call to `/api/sign-in` before accessing invoices
- Sign-out button calling `/api/sign-out`
- Proper session flow per architecture boundaries

### 2. Hardcoded Credentials in Public Bundle
**Impact:** Security vulnerability, fails `secretsInClientPaths` rule  
**Evidence:**
- `public/app.js:2-3` defines `MAPS_EMBED_KEY` and `BILLING_API_TOKEN`
- Both tokens are exposed in browser-accessible JavaScript
- Violates ARCHITECTURE.md: "public/ is served to the browser and is outside the trust boundary — nothing secret belongs there"
- Backend checker rule `secretsInClientPaths: "error"` is configured to catch this

**Fix Required:** Remove hardcoded tokens. If a token is needed, obtain it server-side and inject into the session or page context securely.

### 3. Configuration File Has Syntax Error
**Impact:** Backend checker cannot run; blocks CI/CD  
**Evidence:**
- `checker.config.json:7` has trailing comma (invalid JSON)
- `npm run check:backend` fails: `SyntaxError: Expected double-quoted property name in JSON`
- Prevents security/consistency checks from executing
- Prior evidence shows this rule was clean Aug 9; regression introduced Aug 31

**Fix Required:** Remove trailing comma after last rule in `rules` object.

## Observations

- Backend architecture is sound: session-based auth, staff ID filtering, proper boundaries
- Unit test passes: `listInvoices()` correctly filters by staff ID
- Prior backend report (Aug 9) shows clean state; issues are recent regressions
- No data files present; expected for MVP (datastore loads at runtime)
- Design direction and UX walkthrough are clear and properly documented

## Verification Performed

✓ Reviewed all source files (server.js, invoices.js, app.js, index.html)  
✓ Ran unit tests (pass)  
✓ Attempted backend checker (fails on config syntax)  
✓ Verified architecture vs. implementation alignment  
✓ Confirmed UX walkthrough vs. UI  
✓ Checked security rules and public bundle contents  
✓ Reviewed prior evidence and regression timeline  

## Recommendation

**Hold release.** All three blockers must be resolved before production deployment. These are not edge cases—they prevent the core MVP workflow (sign in → view invoices → sign out) from functioning.
