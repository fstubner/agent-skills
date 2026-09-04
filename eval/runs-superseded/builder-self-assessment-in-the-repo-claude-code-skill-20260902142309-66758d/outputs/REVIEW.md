# Release verdict

**Status: BLOCK**

## Summary

The expenses claims tool cannot ship. The frontend is entirely missing, making the product non-functional and unable to complete any part of its primary job. Additional critical security and validation issues were found in the backend.

## Verification performed

### Gate check
The automated acceptance gate could not run (requires system approval), so manual review covered:
- Document review (PRODUCT.md, ARCHITECTURE.md, ux-walkthrough.md, design-direction.md)
- Full code review of src/server.js, src/claims.js, public/index.html
- Test file review
- Build notes review

### Walkthrough attempt
**Cannot execute the primary job.** The ux-walkthrough.md describes:
1. "Open the page. The sign-in form is shown"
2. "Sign in. Land on your own claims"
3. "Submit a claim: amount, category, date spent"
4. "Sign in as a line manager and approve the claim"
5. "Sign out"

None of these steps are possible. The index.html is a skeleton (`<!doctype html><title>Expenses claims</title><main id="app"></main>`) with no sign-in form, no claims list, no submission form, and no UI of any kind.

### Adversarial checklist (partial)
**Contract — MVP missing:**
- ✗ "Submit a claim" — No UI to submit
- ✗ "List my own claims" — No UI to display claims
- ✗ "Approve a claim as a manager" — No UI to approve
- ✗ "Sign out" — No UI to trigger sign-out

**Primary path from ux-walkthrough.md:**
- ✗ Cannot replay any step; no frontend exists

## Blocking findings

### 1. Frontend entirely missing (CRITICAL)
`public/index.html` contains only a doctype and empty main element. There is no frontend code, no React/Vue/framework build output, no script tags, no user interface. The product cannot be used at all.

### 2. No authentication (CRITICAL)
`POST /api/sign-in` (line 20-22) accepts any staffId without verification:
```javascript
req.session.staffId = req.body.staffId;
req.session.isManager = Boolean(req.body.isManager);
```
Users can impersonate anyone by sending `{"staffId": "someone-else", "isManager": true}` to the endpoint. There is no identity verification, no password, no user database.

### 3. Unvalidated amount field (HIGH)
`POST /api/claims` does not validate `amountMinor`. The field is copied directly from the request into the record (claims.js:20) without checking:
- Is it present?
- Is it a number?
- Is it positive?
- Is it within reasonable bounds?

Negative, null, or extremely large amounts can be submitted.

### 4. Missing approval boundary check (HIGH)
`POST /api/claims/:id/approve` (line 33-36) verifies the requester is a manager but does not verify they are authorized to approve this specific claim. A manager can approve any claim by ID if they know it, even claims from staff they don't manage.

### 5. Session security
`secure: true` (line 14) is set on the session cookie, requiring HTTPS. The product is "Internal network only" but if the server runs on HTTP, session cookies will not be sent and sessions will not persist. The PRODUCT.md constraints ("Node 18+, no external services") do not mention HTTPS setup.

## What was not checked

- **No runtime verification** — Cannot start the server without a frontend; the primary job is impossible to test
- **Engineering audit** — Did not run the full engineering assessment as the product is non-functional
- **Walthrough replay** — Cannot generate or run the walkthrough spec without a working UI
- **Gate checker re-run** — The automated gate was not executed (requires system approval)
- **Claim ID collision** — ID generation uses `state.claims.length + 1`, which will produce duplicates if claims are ever deleted
- **Concurrent writes** — File-based store has no locking; simultaneous requests could cause data loss
- **Error handling on endpoints** — What happens if the JSON file is corrupted? If the .data/ directory is unwritable?

## Conclusion

The product fails its primary job at the most fundamental level: there is no UI. No user can sign in, submit a claim, view claims, or approve them. The backend APIs exist but cannot be tested or used.

Even if the frontend were present, critical security issues (unauthenticated sign-in, unverified manager approval) make this unsafe for any multi-user deployment.

**This is not production-ready and cannot be accepted.**
