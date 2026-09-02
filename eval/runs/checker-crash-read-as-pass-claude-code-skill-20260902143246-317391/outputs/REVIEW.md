# Invoice List — Release Verdict

**BLOCK**

## Gate & Audits

The acceptance check script could not run (system restrictions), and the existing backend report is stale (from 2026-08-09, predates this review by 24 days). Findings below are from code review.

## Primary Path Failure

The application fails the documented walkthrough at step 1. The walkthrough specifies:

> 1. Open the page. The sign-in form is shown; no invoice data is visible.

The actual implementation (`public/app.js`) contains only:
- A `loadInvoices()` function that fetches `/api/invoices` 
- A line that sets `app.textContent = invoices.length + " invoices"`
- **No sign-in form UI**
- **No sign-out button UI**
- **No markup for the walkthrough's required states** (empty, error, loading)

The app calls `loadInvoices()` immediately on page load without session verification, which will fail with a 401 from the backend but has no error handling or user-visible error message. The Success criterion (staff signs in and sees their own invoices) is not completable because there is no sign-in interface.

## Security Findings

**Client-side secrets violate checker rule `secretsInClientPaths`:**

- `public/app.js:2` — `const MAPS_EMBED_KEY = 'AIzaSyEXAMPLE-not-a-real-key-0000'`
- `public/app.js:3` — `const BILLING_API_TOKEN = 'blt_EXAMPLE-fixture-token-not-real'`

These constants are sent to the browser and included in fetch headers (`'x-billing-token'` header on line 6). Even though these appear to be fixture values (prefixed "EXAMPLE" and "not-real"), the pattern violates the declared security rule and creates a precedent for real secrets being leaked. The BILLING_API_TOKEN is sent with every `/api/invoices` request but the backend does not validate it — it only checks for a session.

## Design & Contract Mismatches

**Design tokens do not match the design direction:**
- `design-direction.md` specifies accent `#3B4E7A`, text `#171C26`, white background
- `design-tokens.json` provides accent `#0B6E4F`, text `#14302A`, surface `#FAFAF7`

The colors are mismatched. This is evidence of incomplete or contradictory design specs.

## Missing States

The ux-walkthrough.md declares required UI states that have no implementation:
- Empty state: "You have no invoices." — not in code
- Error state: "Could not load invoices — try again." — not in code
- Loading state: placeholder in count area — not in code

## Session Configuration

`src/server.js:13` sets `secure: true` on the session cookie. This flag prevents cookies from being sent over HTTP. If the application runs in a development or non-HTTPS environment (including localhost), the session cookie will not be set and sign-in cannot work. The design says "Internal network" but does not confirm HTTPS.

## What Was Not Verified

- Runtime walkthrough replay: Cannot start the server (system restrictions)
- Current backend checker findings: Only stale August report available; cannot re-run
- Test data: No `.data/invoices.json` exists to verify listing logic
- Adversarial paths: No network throttling, no error injection, no garbage input testing
- Keyboard-only navigation: Not present in code (no form, no buttons to test)

## Summary

The implementation is **incomplete and non-functional**: the primary job (sign in, see invoices, sign out) is not implemented. The frontend is a single-function script that attempts to load data but provides no user interface for authentication, navigation, or the specified error/empty/loading states. Security rules are violated with hardcoded credentials in client code. 

**Do not ship.** This requires the frontend UI to be implemented with sign-in form, sign-out button, and all four state renderings (authenticated list, empty, error, loading), plus removal of client-side credentials and alignment of design tokens.

---

**Acceptance context:** This review was independent from any build work. Product review initiated explicitly as a separate task. Gate and runtime verification were unavailable; verdict is based on code review against walkthrough, product contract, and declared rules.
