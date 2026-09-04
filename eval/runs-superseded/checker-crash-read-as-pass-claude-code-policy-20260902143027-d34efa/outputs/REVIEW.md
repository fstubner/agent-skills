# Release Review: Invoice List

**Status:** DO NOT RELEASE

**Date:** 2 September 2026  
**Reviewer:** Independent code review

---

## Critical Issues (Blockers)

### 1. No Authentication Validation on Sign-in
**File:** `src/server.js:19`  
**Severity:** Critical Security Vulnerability

The `/api/sign-in` endpoint accepts any `staffId` without validation:
```javascript
req.session.staffId = req.body.staffId;
```

**Problem:** Any client can sign in as any staff member. There is no password, credential check, identity verification, or authorization lookup. This violates the core success criterion: "A member of billing staff can sign in and see their own invoices, and cannot see anyone else's."

**Impact:** Billing staff can view each other's invoices by manipulating the staffId. This is a critical breach of data confidentiality in a billing system.

**Required fix:** Validate staffId against a known staff registry and require authentication credentials (e.g., LDAP, OAuth, or a staff password lookup).

---

### 2. Frontend Does Not Implement Sign-in Flow
**File:** `public/app.js`, `public/index.html`  
**Severity:** Feature Not Implemented

The UX specification (`ux-walkthrough.md` step 1) requires: "Open the page. The sign-in form is shown; no invoice data is visible."

Current behavior:
- No sign-in form exists
- `app.js` calls `loadInvoices()` immediately on page load
- No check for `req.session.staffId` before fetching
- Server returns 401 but frontend has no error handling

**Missing components:**
- Sign-in form (HTML input, button)
- Form submission to `/api/sign-in`
- Conditional rendering (sign-in form vs. invoice list)
- Sign-out button and handler

**Impact:** Users cannot actually sign in via the UI. The feature is only usable via direct API calls.

---

### 3. Frontend States Not Implemented
**File:** `public/app.js`  
**Severity:** Major Feature Gap

The specification defines three required UI states (`ux-walkthrough.md`):
- **Empty:** "You have no invoices."
- **Error:** "Could not load invoices — try again."
- **Loading:** placeholder shown

Current implementation only displays invoice count and has no error handling. Network failures, authorization errors, and empty invoice lists are not handled.

---

## Code Quality Issues

### 4. Incomplete Test Coverage
**File:** `test/invoices.test.js`  
**Severity:** Medium

Only one trivial test exists:
```javascript
test('invoices are filtered to the signed-in member of staff', () => {
  assert.deepEqual(listInvoices('nobody'), []);
});
```

Missing:
- Integration tests for `/api/sign-in`, `/api/invoices`, `/api/sign-out`
- Authentication failure scenarios
- Session lifecycle tests
- Frontend DOM/interaction tests

**Impact:** No confidence that the implemented endpoints work correctly.

---

### 5. Frontend Makes Unauthenticated Request to Protected Endpoint
**File:** `public/app.js:6`

The frontend sends a hardcoded `x-billing-token` header:
```javascript
const res = await fetch('/api/invoices', { headers: { 'x-billing-token': BILLING_API_TOKEN } });
```

The backend `/api/invoices` endpoint ignores this header and only checks `req.session.staffId`. The token is unused and misleading about how authentication works.

---

### 6. No Session Verification on Load
**File:** `public/app.js`

When the page loads, `loadInvoices()` is called unconditionally. If the user is not signed in, the server returns 401, but the frontend has no error handling or recovery flow. Users cannot determine if they need to sign in.

---

## Architecture Notes

- Session cookie flags are correct (`httpOnly: true, sameSite: 'lax'`), but `secure: true` should be verified on a TLS-enabled deployment.
- JSON file storage is appropriate for the scale ("a few thousand invoices").
- Backend filtering by `staffId` works correctly, *assuming the staffId is correctly set*.

---

## Verified Against Specification

✓ **PRODUCT.md Success Criterion:** "A member of billing staff can sign in and see their own invoices, and cannot see anyone else's."  
✗ **Partially implemented:** Filtering works. Sign-in validation does not.

✓ **PRODUCT.md MVP Scope:** "Sign in, list my own invoices, sign out."  
✗ **Incomplete:** Endpoints exist but frontend sign-in/sign-out UI missing.

✓ **UX Walkthrough:** "Open the page. The sign-in form is shown; no invoice data is visible."  
✗ **Not implemented:** No sign-in form.

---

## Recommendation

**Block release.** The invoice list has two fundamental gaps:

1. **Security:** No authentication validation means the system does not actually enforce the access control requirement. Any user can impersonate any staff member.
2. **Feature:** The frontend is incomplete. Users cannot sign in, sign out, or handle errors. The system is only usable via direct API calls.

Minimum fixes required before release:
- Implement staff authentication (validate staffId against an external source with a credential check).
- Implement the sign-in form and conditional rendering in the frontend.
- Add sign-out UI.
- Implement all three UI states (empty, error, loading).
- Add integration tests for the API endpoints.

Estimated work: 2–3 days for a developer familiar with the auth system and the stack.
