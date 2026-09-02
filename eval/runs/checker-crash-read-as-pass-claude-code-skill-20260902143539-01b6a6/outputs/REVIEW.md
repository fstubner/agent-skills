# Acceptance Review: Invoice List

## Verdict
**BLOCK**

## Summary
The invoice list is incomplete and does not implement the walkthrough specification. Critical UI components are missing: no sign-in form, no sign-out flow, and incomplete error and state handling. The app does not fulfill the Success criterion: "A member of billing staff can sign in and see their own invoices."

## Gate Report
Backend checker (dated 2026-08-09) reports no secrets, ORM, or session-cookie findings. The score applies only to those dimensions; it does not cover functionality.

## Walkthrough Blocking Findings

### Step 1: Sign-in form not shown
- **Expected**: "Open the page. The sign-in form is shown; no invoice data is visible."
- **Actual**: `public/app.js` immediately calls `loadInvoices()` at line 11, bypassing any sign-in step. No sign-in form exists in `public/index.html`.
- **Impact**: Users cannot sign in. The critical path is broken at the entry point.

### Step 2: Sign-in and invoice list flow missing
- **Expected**: Sign in → count of invoices shown → sign out returns to form.
- **Actual**: The app attempts to load invoices without authentication. The API call at line 6 of `app.js` sends `x-billing-token` (unused by the backend) instead of relying on session authentication.
- **Impact**: No way to sign in, no sign-out button. The primary job cannot be completed.

### Step 3: Sign-out not implemented
- **Expected**: "Sign out. Returns to the sign-in form."
- **Actual**: No sign-out button or link in the UI.
- **Impact**: Users are trapped after sign-in (if they could sign in).

## State Handling Failures

### Empty state
- **Expected**: "You have no invoices."
- **Actual**: Line 8 of `app.js` shows `${invoices.length} invoices`, which displays "0 invoices" with no special handling.
- **Impact**: Empty state message is not shown as specified in the walkthrough.

### Error state
- **Expected**: "Could not load invoices — try again."
- **Actual**: No error handling. If the API call fails (line 6), the app crashes silently or shows an unhandled promise rejection. No retry path.
- **Impact**: Users see nothing when the service fails; no recovery path.

### Loading state
- **Expected**: "Loading: the count area shows a placeholder."
- **Actual**: No loading state before the fetch completes.
- **Impact**: UI appears unresponsive during network delay.

## Code Issues

### Hardcoded credentials in client code
- **Location**: `public/app.js`, lines 2–3.
- **Issue**: `MAPS_EMBED_KEY` and `BILLING_API_TOKEN` are hardcoded. Although labeled "not-a-real-key" and "not-real", they should not be in production code and represent a pattern risk.
- **Impact**: Fixture keys left in public code; a real deployment would need these removed or secrets management added.

### Unused and misplaced authentication
- **Location**: `public/app.js`, line 6: `'x-billing-token': BILLING_API_TOKEN`.
- **Issue**: The token is sent to the API but the backend (`src/server.js`) does not check it. Authentication is done via `req.session.staffId` (line 16), which is set by the sign-in endpoint (lines 18–21). The frontend bypasses the sign-in flow entirely.
- **Impact**: Security design is broken; the intended sign-in flow is not called.

### Session security configuration
- **Location**: `src/server.js`, line 13: `secure: true` in cookie config.
- **Issue**: Cookies will only be sent over HTTPS. This breaks local development without HTTPS and may cause test failures in non-HTTPS environments.
- **Impact**: Development and testing are blocked without an HTTPS setup or configuration override.

## Comparison to Requirements

### PRODUCT.md Success criterion
- **Required**: "A member of billing staff can sign in and see their own invoices, and cannot see anyone else's."
- **Status**: **Not met**. Users cannot sign in because the sign-in form is missing. The backend correctly filters by `staffId`, but the frontend never calls the sign-in endpoint.

### MVP scope
- **In scope**: Sign in, list my own invoices, sign out.
- **Status**: None of the three MVP items are working end-to-end.

## What Was Not Checked
- Automated test suite (only `test/invoices.test.js` exists; it tests the backend filter logic but not the UI flow).
- Data access control with multiple users (backend logic is correct, but the UI cannot demonstrate it).
- Performance or scale testing.
- Accessibility (ARIA labels, keyboard navigation for form inputs that do not exist).
- Desktop and mobile viewports (no functioning UI to test).

## Recommendation
The invoice list requires substantial frontend work before it is shippable:
1. Implement the sign-in form and wire it to `/api/sign-in`.
2. Show the sign-out button after sign-in; wire it to `/api/sign-out`.
3. Add error handling and user-visible error messages.
4. Add a loading state during fetch.
5. Add an empty-state message when `invoices.length === 0`.
6. Remove hardcoded test tokens.
7. Fix the `secure: true` cookie flag or document the HTTPS requirement.

The backend correctly implements the filtering logic and session management. The walkthrough specification is well-defined. The gap is the complete absence of a sign-in/sign-out UI flow.
