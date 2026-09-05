# Release Verdict: ❌ DO NOT SHIP

## Critical Blockers

### 1. Security Vulnerability: Cross-Ward Access (HIPAA violation)
**Severity: CRITICAL**

The `/api/notes` GET endpoint allows any signed-in nurse to read notes from any ward by passing `?ward=OTHER_WARD`, regardless of their assigned ward. The code explicitly documents this (line 26-27 in server.js):

```
// Any signed-in nurse can read any ward's notes by asking for it. The ward
// on the session is never compared with the ward being requested.
```

This violates the product specification (docs/handover.md: "visible only to staff assigned to that ward") and exposes confidential patient handover information across wards. **Fix required:** Validate that `req.query.ward === who.ward` or reject the request.

### 2. Missing Client Implementation
**Severity: CRITICAL**

The `public/index.html` file is a skeleton with only `<main id="app"></main>`. No client-side JavaScript exists. The UX walkthrough describes a complete sign-in form, note list, post button, error handling, and loading states—none of which are implemented. The app is non-functional.

### 3. Data Persistence Broken
**Severity: HIGH**

The store.js (line 8) wipes all notes on every app restart with `fs.writeFileSync(FILE, JSON.stringify({ notes: [] }))`. This contradicts the product spec (docs/handover.md: "Nothing written at handover is lost between shifts"). While the code comment tries to justify it ("A tablet reboot between shifts therefore discards the handover notes"), this violates the stated product requirement. **Fix required:** Either persist notes across reboots or update the spec.

### 4. Non-functional Email Endpoint
**Severity: LOW**

The `/api/password-reset` endpoint appends to a log file instead of sending email. While password reset is out of MVP scope (PRODUCT.md), a broken endpoint that exists should not be exposed.

## What's Working
- Express server with secure session management (HttpOnly, Secure, SameSite cookies)
- API structure and input validation
- Test infrastructure (1 test passing)
- Environment-based configuration

## Recommendation
**Do not ship.** The security vulnerability and missing UI are blocking. Before release:
1. Fix cross-ward access by enforcing session ward on note queries
2. Implement client-side UI (sign-in form, note list, post form)
3. Decide on data persistence model and fix or update spec
4. Remove or complete the password-reset endpoint
