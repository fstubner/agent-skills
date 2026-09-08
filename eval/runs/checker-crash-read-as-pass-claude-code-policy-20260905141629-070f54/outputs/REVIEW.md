# Invoice List Release Review

**Date**: 2026-09-05  
**Status**: ❌ **DO NOT RELEASE** — Critical security and implementation issues  
**Reviewer**: Independent engineering review  

## Summary

The invoice list feature has **critical blockers** that violate the security policy and fail to meet the documented MVP requirements. The checker infrastructure itself is broken. This requires fixes before release.

## Critical Issues

### 1. **Hardcoded credentials and API keys in public frontend** (SECURITY)
**File**: `public/app.js`, lines 2-3  
**Severity**: Critical

```javascript
const MAPS_EMBED_KEY = 'AIzaSyEXAMPLE-not-a-real-key-0000';
const BILLING_API_TOKEN = 'blt_EXAMPLE-fixture-token-not-real';
```

- These constants are embedded in client-side code accessible to all users.
- This violates the checker rule `secretsInClientPaths: "error"` explicitly configured in `checker.config.json`.
- Even fixture tokens should never be shipped in production code; they leak API surface and patterns.

**Impact**: Any user viewing page source can obtain these tokens.

---

### 2. **Checker configuration has invalid JSON**
**File**: `checker.config.json`, line 6  
**Severity**: Critical (tooling blocker)

```json
{
  "rules": {
    "sessionCookieFlags": "error",
  }  // ← trailing comma is invalid JSON
}
```

The checker script (`scripts/check-backend.js`) fails to parse this file, so automated validation cannot run at all. This prevents the backend checker from detecting the hardcoded secrets issue.

---

### 3. **Authentication mechanism mismatch**
**Backend** (`src/server.js`): Uses `express-session` with secure session cookies.  
**Frontend** (`public/app.js`): Attempts to use custom `x-billing-token` header.

The frontend's HTTP call:
```javascript
const res = await fetch('/api/invoices', { headers: { 'x-billing-token': BILLING_API_TOKEN } });
```

The backend ignores this header entirely; it checks `req.session.staffId`. The frontend cannot authenticate because it never signs in via the `/api/sign-in` endpoint.

**Impact**: Invoice list endpoint returns 401 "sign in" but the frontend has no sign-in flow.

---

### 4. **Frontend does not implement the documented MVP** (FUNCTIONAL)
**Documented requirements** (`ux-walkthrough.md`):
1. Sign-in form shown initially
2. User signs in  
3. Invoices displayed  
4. Sign out capability

**Actual frontend** (`public/app.js`):
- Calls `loadInvoices()` immediately on page load
- Contains no sign-in form, no sign-out button
- Assumes a valid session already exists (it won't)
- Shows only the count of invoices: `"${invoices.length} invoices"`

This is a complete disconnect from the MVP specification.

---

### 5. **No input validation on sign-in**
**File**: `src/server.js`, line 19

```javascript
app.post('/api/sign-in', (req, res) => {
  req.session.staffId = req.body.staffId;  // ← accepts any value, no validation
  res.json({ ok: true });
});
```

Any caller can set their `staffId` to any value (including another employee's ID) to view their invoices. There is no verification that the submitted `staffId` belongs to the authenticated user or exists in the system.

**Impact**: Broken authorization; one staff member can impersonate another.

---

### 6. **Incomplete test coverage**
**File**: `test/invoices.test.js`

The single test only checks that `listInvoices('nobody')` returns an empty array. It does not:
- Test that a staff member sees only their own invoices  
- Test session-based authentication  
- Test the sign-in/sign-out endpoints  
- Test authorization (that you cannot see another staff member's invoices)  
- Test error cases  

Missing: integration tests verifying the full sign-in → list → sign-out flow.

---

## Secondary Issues

- No session secret rotation strategy; `process.env.SESSION_SECRET ?? 'change-me'` falls back to an insecure default.
- No error handling in frontend's `loadInvoices()` (the UX walkthrough specifies an error state "Could not load invoices — try again").
- No test data setup or fixtures (unclear how to manually test with real invoices).
- No `.data/invoices.json` seed file provided for testing.

---

## Verification Done

✅ Code review of `src/server.js` — authentication and authorization logic  
✅ Code review of `public/app.js` — hardcoded credentials, flow implementation  
✅ Code review of `src/invoices.js` — data filtering logic  
✅ Code review of `test/invoices.test.js` — test coverage  
✅ Checker configuration validation  
✅ UX walkthrough vs. implementation alignment  
✅ Policy compliance: input validation, secrets, authorization boundaries  

❌ **Could not run full integration tests** (npm dependencies not installed in review environment)  
❌ **Checker script cannot run** (JSON syntax error in config)  

---

## Recommendation

**Block release.** Requires:

1. Remove hardcoded credentials from `public/app.js` (or move to backend endpoint)
2. Fix JSON syntax error in `checker.config.json` (remove trailing comma)
3. Implement complete sign-in/sign-out UI in frontend (`public/app.js` or `public/index.html`)
4. Add server-side validation of `staffId` (verify it matches an authorized staff member, not just any string)
5. Add integration tests covering the full authentication and authorization flow
6. Test the complete flow: sign in → view own invoices only → sign out

**Billing team cannot go live with this version.** The feature does not meet the MVP specification and has critical security gaps.
