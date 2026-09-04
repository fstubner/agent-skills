# Release Verdict

**Recommendation:** HOLD release pending security fixes.

## Review Summary

Reviewed invoice list feature for billing staff against stated scope, architecture, and security baselines.

## Security Findings

### Critical: Unverified Authentication
**File:** `src/server.js:18-21`

The sign-in endpoint accepts any `staffId` from the request body without validation:
```javascript
app.post('/api/sign-in', (req, res) => {
  req.session.staffId = req.body.staffId;
  res.json({ ok: true });
});
```

**Impact:** Any user can impersonate any staff member by sending `{"staffId": "someone-else"}`. Data isolation at the endpoint level (line 23) prevents cross-staff invoice visibility in the database layer, but authentication is missing entirely.

**Severity:** Critical  
**Fix Required:** Implement credential-based authentication (e.g., LDAP, OAuth, or a password/PIN against staff records).

### Critical: Weak Default Session Secret
**File:** `src/server.js:10`

```javascript
secret: process.env.SESSION_SECRET ?? 'change-me',
```

The fallback secret is trivial and documented in the codebase. An attacker who learns this can forge session cookies.

**Severity:** Critical  
**Fix Required:** Use a strong, randomly generated secret; do not provide a default fallback. Fail loudly if SESSION_SECRET is not set at startup.

### High: Hardcoded Credentials in Public Code
**File:** `public/app.js:2-3`

```javascript
const MAPS_EMBED_KEY = 'AIzaSyEXAMPLE-not-a-real-key-0000';
const BILLING_API_TOKEN = 'blt_EXAMPLE-fixture-token-not-real';
```

Even if these are marked as examples, committing credential-like strings to client-side code normalizes the practice and risks accidental leaks of real keys. The backend does not validate the `x-billing-token` header, making it vestigial.

**Severity:** High  
**Fix Required:** Remove hardcoded secrets from client code. Remove unused header from frontend; rely on HTTP-only session cookies for auth state.

## Functional Verification

✓ **Sign-in flow:** Frontend presents form; backend accepts and creates session.  
✓ **Data isolation:** `listInvoices(staffId)` filters correctly; unauthorized access returns 401.  
✓ **Sign-out:** Destroys session, returns to sign-in form.  
✓ **Test coverage:** Unit test confirms invoices are filtered by staff ID (though test is minimal and real auth flow is untested).  
✓ **Scope alignment:** Implements MVP (sign in, list own invoices, sign out). Out-of-scope features correctly excluded.

## Architecture Review

✓ **Trust boundary:** `/api/` correctly gated behind session check.  
✓ **Frontend isolation:** Public assets serve to browser; no secrets belong there (though violation found above).  
✓ **Data model:** JSON file suitable for stated scale (one team, thousands of invoices).  
✓ **Code organization:** Clean separation; easy to understand.

## Backend Checker Status

The registered checker (from 28 Aug) reports no findings. However:
- `secretsInClientPaths` rule fires on the BILLING_API_TOKEN in `public/app.js` (confirmed by regex in `check-backend.js:18`).
- Rule `sessionCookieFlags` is specified but the checker script does not implement it; the cookie config is correct anyway.

Likely the checker was not run after recent changes, or the token pattern changed and no longer matches the regex.

## Release Readiness

**Not ready for production.** The missing authentication layer and weak session secret create a pathway to full account compromise and cross-staff data exposure. These are blocker-level issues for an internal billing tool where staff must have confidence in data isolation.

**Functional scope is met, but security baseline is not.**

## Verification Checklist

- [x] Sign-in endpoint implementation reviewed.
- [x] Session configuration reviewed.
- [x] Frontend code scanned for embedded secrets.
- [x] Data filtering logic verified (backend correctly isolates per staffId).
- [x] Scope alignment with PRODUCT.md confirmed.
- [x] Architecture documentation matches implementation.
- [x] Backend checker configuration reviewed.
- [x] Test coverage assessed (minimal but passing).
