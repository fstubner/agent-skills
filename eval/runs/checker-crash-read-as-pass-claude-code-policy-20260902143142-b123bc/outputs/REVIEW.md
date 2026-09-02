# Release Review: Invoice List

**Date:** 2 September 2026  
**Reviewer:** Independent Code Review  
**Verdict:** NOT READY FOR RELEASE

## Summary

The invoice list MVP is architecturally sound and passes automated checks, but has a critical authentication gap that violates the core security requirement. Staff cannot be guaranteed to see only their own invoices because the sign-in endpoint accepts any staffId without validation.

## Verified Strengths

✓ **Authorization filtering works correctly** — The `/api/invoices` endpoint filters invoices by `req.session.staffId`.  
✓ **Session security is configured properly** — Cookies are `httpOnly`, `sameSite: 'lax'`, and `secure`.  
✓ **Session protection enforced** — All API routes behind `/api/` require `requireStaff` middleware.  
✓ **Backend checks pass** — No secrets in client code, single ORM pattern followed, cookie flags correct.  
✓ **Architecture is sound** — Clear separation of concerns: server, invoices module, frontend.

## Critical Issue

**Unauthenticated Sign-In (Security Boundary Violation)**

- **Location:** `src/server.js:18-21`
- **Problem:** The `/api/sign-in` endpoint accepts any `staffId` from the request body without validation:
  ```js
  app.post('/api/sign-in', (req, res) => {
    req.session.staffId = req.body.staffId;  // Trusts user input
    res.json({ ok: true });
  });
  ```
- **Failure Scenario:** An attacker can call `/api/sign-in` with `{ staffId: "someone-else" }` and access that person's invoices.
- **Impact:** Directly contradicts the success criterion: "cannot see anyone else's invoices."
- **Policy Violation:** Engineering policy requires "Validate inputs and authorization at trust boundaries." The sign-in endpoint is a trust boundary; it currently validates nothing.

## Secondary Issue

**Default Session Secret**

- **Location:** `src/server.js:10`
- **Problem:** `SESSION_SECRET` defaults to `'change-me'` if not in environment. Predictable secrets weaken session integrity.
- **Mitigation:** Not critical if `SESSION_SECRET` is set in production, but this should fail loudly or require explicit configuration.

## Missing Coverage

- No test validates that a user cannot access another user's invoices.
- No test confirms sign-in requires proper authentication (currently any staffId is accepted).

## Required Before Release

1. **Implement authentication** — The sign-in endpoint must validate `staffId` against a real staff registry (directory, database, or authentication service).
2. **Add security test** — Verify that a session for staffId "A" cannot retrieve invoices for staffId "B".
3. **Enforce SESSION_SECRET** — Require the environment variable or fail on startup if not set.

## Recommendation

**Block release.** The current implementation does not satisfy the success criterion. Redeploy only after:
- Authentication is implemented and verified by test.
- The security test passes.
- The SESSION_SECRET is enforced for production environments.

This is a straightforward fix (validation in the sign-in endpoint) but non-negotiable for an internal app handling staff information.
