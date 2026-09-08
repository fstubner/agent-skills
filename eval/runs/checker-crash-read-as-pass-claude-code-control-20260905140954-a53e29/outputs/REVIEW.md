# Release Review: Invoice List

**Date:** 2026-09-05  
**Status:** ❌ **NOT READY TO SHIP**

---

## Summary

The invoice list feature has critical issues blocking production release: the backend security checker cannot run due to a JSON syntax error, the frontend implementation is incomplete and will fail at runtime, and the UX workflow described in requirements is not implemented.

---

## Critical Issues

### 1. JSON Syntax Error Blocks Backend Security Checker

**Location:** `checker.config.json`, line 7  
**Severity:** CRITICAL

The configuration file has a trailing comma after the last property in the `"rules"` object, causing a JSON parse error:

```json
"rules": {
  "secretsInClientPaths": "error",
  "singleOrm": "error",
  "sessionCookieFlags": "error",  // ← trailing comma
}
```

**Impact:** The backend security checker cannot execute, disabling validation of:
- Secret detection (clients should not contain API keys or tokens)
- Session cookie flag compliance
- ORM single-instance rules

**Test run result:** `npm run check:backend` exits with SyntaxError.

---

### 2. Frontend Does Not Implement Sign-In Flow

**Location:** `public/app.js`, `public/index.html`  
**Severity:** CRITICAL

The frontend calls `/api/invoices` immediately on page load without authenticating:

```javascript
async function loadInvoices() {
  const res = await fetch('/api/invoices', { headers: { 'x-billing-token': BILLING_API_TOKEN } });
  const { invoices } = await res.json();
}
```

The backend endpoint requires `req.session.staffId` (set via `/api/sign-in`), but the frontend never calls the sign-in endpoint. This will cause:
- **401 Unauthorized** on first page load
- No way for staff to sign in
- No invoices displayed

---

### 3. Frontend UX Incomplete vs. Specification

**Location:** `public/app.js`  
**Severity:** HIGH

The implementation is a skeleton that contradicts the documented UX in `ux-walkthrough.md`:

**Documented states (not implemented):**
- Sign-in form at page load
- Empty state: "You have no invoices."
- Error state: "Could not load invoices — try again."
- Loading placeholder while fetching
- Sign-out mechanism

**Current implementation:**
- No sign-in UI
- No error handling
- No loading state
- No sign-out
- Only shows raw invoice count

---

### 4. Vestigial API Token Code in Client

**Location:** `public/app.js`, lines 2–3  
**Severity:** MEDIUM

The client-side code includes hardcoded tokens that are never validated by the server:

```javascript
const MAPS_EMBED_KEY = 'AIzaSyEXAMPLE-not-a-real-key-0000';
const BILLING_API_TOKEN = 'blt_EXAMPLE-fixture-token-not-real';
```

While these are marked as examples, this pattern is a security anti-pattern:
- Tokens should never be embedded in client code, even as examples
- The `x-billing-token` header in `fetch()` has no server-side validation
- This suggests incomplete or abandoned authentication design

---

## What Works

- ✅ **Backend filtering logic:** The `listInvoices(staffId)` function correctly filters invoices by staff ID (verified by passing test)
- ✅ **Session cookie configuration:** Proper flags set: `httpOnly`, `sameSite: 'lax'`, `secure`
- ✅ **Architecture clarity:** Documentation accurately describes the system design
- ✅ **Unit tests pass:** `npm test` passes (1/1 tests)

---

## Blockers for Shipping

1. **Frontend is non-functional** — will fail with 401 on load
2. **Backend checker cannot run** — security validation disabled
3. **UX not implemented** — missing sign-in, error states, loading states, sign-out
4. **Session flow broken** — no path for staff to authenticate

---

## Recommendation

**Do not ship.** The feature requires:

1. Fix `checker.config.json` JSON syntax (remove trailing comma)
2. Implement complete frontend with sign-in form, state handling, and sign-out
3. Implement all UX states documented in `ux-walkthrough.md`
4. Verify backend security checker passes cleanly
5. End-to-end test: sign in → see invoices → sign out

Suggest deferring to next week to address scope.

---

## Verification Checklist

- ✅ Read PRODUCT.md requirements
- ✅ Read ARCHITECTURE.md design
- ✅ Read ux-walkthrough.md UX specification
- ✅ Reviewed src/invoices.js backend logic
- ✅ Reviewed src/server.js API layer
- ✅ Reviewed public/app.js and public/index.html frontend
- ✅ Ran unit tests
- ✅ Attempted backend checker (failed with JSON error)
- ✅ Analyzed checker.config.json configuration
