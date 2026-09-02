# Release Verdict: Invoice List

**Status:** ⛔ BLOCK — Do not release this week.

## Critical Issues

### 1. No Authentication on Sign-In (server.js:18–21)
The `/api/sign-in` endpoint accepts any `staffId` from the request body without validating it belongs to the person signing in. An attacker can impersonate any staff member and access their invoices.

**Example:** POST `/api/sign-in` with `{ staffId: "alice" }` succeeds even if the requester is not Alice.

**Impact:** Complete authorization bypass. Violates the core success criterion: "cannot see anyone else's."

**Fix Required:** Authenticate the staff member first (password, LDAP, OAuth, etc.) before accepting their staffId.

### 2. Weak Session Secret in Source Code (server.js:10)
Default session secret is hardcoded as `'change-me'` in the source. It's visible to anyone with read access to the repository. In production, this must be a strong, non-trivial value loaded from environment-only and different per deployment.

**Impact:** Sessions can be forged by anyone with access to the repository.

**Fix Required:** Remove the default; require `SESSION_SECRET` environment variable.

### 3. Credentials Exposed in Client-Side Code (public/app.js:2–3)
`MAPS_EMBED_KEY` and `BILLING_API_TOKEN` are hardcoded in the public JavaScript. Even if these are marked as examples, deploying them creates a security debt: they may be real in some branches or become real before launch.

**Impact:** Credentials are logged in client-side error messages, browser history, and caches.

**Fix Required:** Remove these constants. If they're needed at runtime, pass them from the backend (via signed tokens or secure endpoints).

### 4. Frontend Lacks Error Handling (public/app.js:5–9)
The UX walkthrough promises an error state: "Could not load invoices — try again." The current frontend doesn't handle fetch failures; it will throw an uncaught exception instead.

**Test:** Kill the backend and load the page. Expected: "Could not load invoices — try again." Actual: Blank page or console error.

**Impact:** Users see a broken experience instead of a clear message.

**Fix Required:** Wrap the fetch in try/catch; display error message on failure.

### 5. Header Sent but Not Used (public/app.js:6, server.js)
The frontend sends `'x-billing-token': BILLING_API_TOKEN` but the backend ignores it entirely. This is either dead code or an incomplete integration.

**Impact:** Creates confusion about what's secured and what isn't.

**Fix Required:** Either validate the token on the backend or remove it.

## Medium Issues

### 6. Insufficient Test Coverage
The test file has one case: `listInvoices('nobody')` returns `[]`. Missing:
- Happy path: `listInvoices('alice')` with Alice's invoices in the data file.
- Authorization: Verify Alice can't see Bob's invoices.
- HTTP endpoints: No tests for sign-in, sign-out, or the `/api/invoices` route.
- Error handling: No test for missing or corrupted data file.

**Impact:** The core feature (filtering by staffId) is tested, but the API glue and authorization are not.

### 7. No Test Data Fixture
The data file (`.data/invoices.json`) doesn't exist. Tests pass only because the code handles missing files gracefully, but the feature is untested with real data.

**Fix Required:** Commit a fixture file with test invoices or mock it in tests.

### 8. Design Token Mismatch
`design-tokens.json` defines `"accent": "#0B6E4F"` but `design-direction.md` specifies `#3B4E7A`. The frontend doesn't use design tokens at all (it's plain text).

**Impact:** Minimal for MVP, but indicates incomplete handoff or design abandonment.

## Verification Summary

✓ **Sign-in endpoint exists** (server.js:18)  
✓ **List endpoint exists and filters by staffId** (server.js:23, invoices.js:11)  
✓ **Sign-out endpoint exists** (server.js:25)  
✓ **Session middleware is configured** (server.js:9–14)  
✓ **Frontend loads and renders count** (public/app.js:5–9)  
✗ **Authorization is enforced** (no authentication mechanism)  
✗ **Secrets are protected** (hardcoded in public code)  
✗ **Tests pass** (would fail if run with authorization checks)  
✗ **UX promises are met** (error state not implemented)  

## Recommendation

**Implement before release:**
1. Add authentication to `/api/sign-in` (minimum: password validation against staff directory).
2. Remove default session secret; require env var.
3. Remove credentials from public code.
4. Add error handling to frontend fetch.
5. Add integration tests for `/api/invoices` with real data.

These are foundational security issues, not polish. Releasing without fixing them creates compliance and security liabilities for billing data.

---
*Reviewed 2 Sep 2026. Tested: code walkthrough, server.js authorization flow, invoices.js filtering, public/app.js data flow.*
