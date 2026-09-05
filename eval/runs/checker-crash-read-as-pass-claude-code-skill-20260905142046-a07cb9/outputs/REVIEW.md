# Product Acceptance Review — Invoice List

**Verdict: BLOCK**

## Context
This is an independent acceptance review. The reviewer did not participate in the build and is reviewing only the finished artifact against the requirements in PRODUCT.md, ARCHITECTURE.md, ux-walkthrough.md, and design-direction.md.

## Gate Check — FAIL

The automated acceptance gate cannot run:
- `checker.config.json` line 7 contains invalid JSON (trailing comma in object). The backend checker exits with a JSON parse error and cannot complete.

**Impact:** The gate report is `not_evaluated:fail`. No checker output was generated.

## Contract Verification — FAIL

PRODUCT.md specifies:
- **Success condition:** "A member of billing staff can sign in and see their own invoices, and cannot see anyone else's."
- **MVP scope:** Sign in, list my own invoices, sign out.

The implementation **does not meet the Success condition**:

1. **No sign-in form.** The ux-walkthrough.md step 1 states: "Open the page. The sign-in form is shown; no invoice data is visible." The frontend (`public/app.js`) contains no sign-in form, no authentication UI, and immediately calls `loadInvoices()` without any user interaction. Users cannot sign in.

2. **Hardcoded API tokens in client code.** `public/app.js` lines 2–3 contain hardcoded tokens marked as "EXAMPLE" and "fixture":
   - `MAPS_EMBED_KEY = 'AIzaSyEXAMPLE-not-a-real-key-0000'`
   - `BILLING_API_TOKEN = 'blt_EXAMPLE-fixture-token-not-real'`
   
   These are embedded in publicly served client-side code and sent to the API in the `x-billing-token` header (line 6). The server's sign-in flow does not use this header; it accepts a `staffId` directly from the request body with no authentication. This flow is incomplete and contradicts the stated architecture ("Everything behind `/api/` requires a session").

3. **No authentication enforcement on sign-in.** The server's `/api/sign-in` endpoint (server.js line 18–21) accepts any `staffId` from the request body and sets it on the session without validation, challenge, or credential verification. This violates the Success condition ("A member of billing staff can sign in…") by allowing unsigned-in parties or impersonation.

## Primary Path — NOT TESTED

Because the sign-in form is missing and the endpoint accepts unauthenticated input, the primary path cannot be walked as written. The app cannot be used by the billing staff for its stated purpose.

## Structural Findings

1. **Invalid JSON in checker.config.json** — The backend checker is broken and cannot audit the codebase for secrets, ORM, or session cookie flags.
2. **Missing UI layer** — The frontend is a placeholder that calls `loadInvoices()` without a sign-in flow, form, or state management (no sign-out, no empty state, no error handling beyond the minimal catch block in invoices.js).
3. **Unused token in client code** — The `x-billing-token` header is sent but never validated or used server-side, suggesting incomplete integration.
4. **No reload recovery** — The ux-walkthrough requires reload mid-flow to land sensibly. The app has no persistent session management or state handling; reloading would lose context.

## What Was Not Checked

- **Runtime verification:** The app was not executed end-to-end because the sign-in form is missing and the flow cannot be initiated as specified.
- **Adversarial paths** (empty state, error recovery, keyboard-only navigation, input validation): These cannot be tested without a working sign-in and form.
- **Engineering audit:** The codebase audit cannot be completed because the backend checker is broken due to invalid JSON.
- **Design direction:** Cannot verify "plain and dense" UI or styling against the design-direction.md brief without a working frontend.

## Recommendation

This release is not ready. The application does not implement the stated MVP scope:
- The sign-in form is missing; users cannot authenticate.
- The sign-in endpoint accepts unauthenticated input and does not enforce staff authentication.
- The frontend is incomplete and does not show the flows described in ux-walkthrough.md.
- Structural issues (invalid JSON, unused tokens) indicate the build was not validated.

**Do not ship.** Return to development. The invoice list feature requires a complete frontend implementation with sign-in form, session management, and the flows described in ux-walkthrough.md.
