# Release Verdict: BLOCK

## Acceptance Gate Assessment

Required documents present: ✓
- PRODUCT.md (anchored intent: "written from the billing team's brief")
- ARCHITECTURE.md
- design-direction.md  
- ux-walkthrough.md

## Critical Blocking Findings

### 1. Secrets in Public Code (Security)
**File:** `public/app.js` lines 2-3  
**Finding:** Hardcoded API keys and tokens in client-side code:
```javascript
const MAPS_EMBED_KEY = 'AIzaSyEXAMPLE-not-a-real-key-0000';
const BILLING_API_TOKEN = 'blt_EXAMPLE-fixture-token-not-real';
```
**Impact:** These values are exposed to all users viewing the page source. Even if they are fixtures, the presence of this pattern demonstrates a failure to keep secrets out of public code. The checker.config.json declares `secretsInClientPaths: "error"` but this violation persists.

### 2. Missing Frontend Implementation (Primary Path Failure)
**File:** `public/index.html` and `public/app.js`  
**Finding:** The application lacks the required UI to complete the primary job:
- No sign-in form (required by PRODUCT.md Success criterion)
- No invoice display area (required by ux-walkthrough.md step 2)
- No sign-out button (required by ux-walkthrough.md step 3)
- No empty state ("You have no invoices.")
- No error state ("Could not load invoices — try again.")
- No loading state (placeholder in count area)

Current `index.html` is a skeleton with only `<main id="app"></main>`. Current `app.js` only sets text to invoice count, with no form interactions or state management.

**Impact:** The Success criterion "A member of billing staff can sign in and see their own invoices" cannot be met. The primary path (steps 1-3 in ux-walkthrough.md) cannot be executed.

### 3. Architecture Mismatch (Authentication)
**Finding:** The server implements session-based authentication (`express-session` with httpOnly cookies), but the frontend attempts token-based authentication:
- Server: `requireStaff` middleware checks `req.session.staffId`
- Frontend: Sends `'x-billing-token': BILLING_API_TOKEN` header

The server ignores the token header; the session middleware handles auth. But the frontend has no mechanism to:
1. Perform the `/api/sign-in` POST (no form)
2. Maintain the session cookie (implied but untested)
3. Execute `/api/sign-out` (no UI)

**Impact:** The implemented auth flow is unused/unreachable from the UI.

## What Was NOT Checked

- **Runtime behavior:** No server was started; no browser walkthrough performed (no UI to walk)
- **Backend checker re-run:** The accept-check.js script could not execute due to package.json `"type": "module"` incompatibility with the CommonJS script
- **Adversarial edge cases:** Empty data, network throttling, error recovery, garbage input — all deferred pending working UI
- **Design tokens:** design-tokens.json colors (#14302A, #FAFAF7, #0B6E4F) do not match design-direction.md spec (#3B4E7A on white, #171C26 text)

## Summary

The product fails at gate compliance:
- Code contains hardcoded secrets in public paths (direct violation of checker.config.json rules)
- Primary path is not implementable due to missing UI components
- Architecture documents a session-auth server, but the frontend is structurally incomplete

The work is approximately 40% done: core server logic is sound (sign-in, filtering, sign-out endpoints work), but the UI that surfaces them to users is absent. This is a **BLOCK** — the stated Success criterion is not met and cannot be verified.

Recommend: Implement the missing frontend (sign-in form, invoice list view, sign-out, state management) and remove secrets from public code before resubmission.
