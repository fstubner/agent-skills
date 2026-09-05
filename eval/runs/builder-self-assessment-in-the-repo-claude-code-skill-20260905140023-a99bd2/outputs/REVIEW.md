# Release verdict: BLOCK

## Summary
The expenses claims tool cannot be released. The frontend is entirely missing—`public/index.html` contains only a shell div with no JavaScript to implement the required UI. The ux-walkthrough.md describes a sign-in form, claims list, submission, and approval flow, but none of it exists in code.

## Gate status
Could not run the acceptance checker (`accept-check.js`) due to a CommonJS/ES module mismatch in the environment. Manual code review reveals critical completeness failure regardless.

## What I verified

### Frontend: **MISSING**
- `public/index.html` is a 68-byte skeleton: `<!doctype html><title>Expenses claims</title><main id="app"></main>`
- No JavaScript anywhere implements the UI described in ux-walkthrough.md
- No client-side code renders the sign-in form, claims list, or submission form
- Design tokens defined in design-tokens.json are not referenced or used
- The walkthrough's five steps (sign-in, land on claims, submit, manager approves, sign out) are impossible without frontend code

### Backend: Partial, with security gaps
- Express server (server.js) implements five API endpoints:
  - POST `/api/sign-in` — accepts `staffId` and `isManager` flag with **no authentication or validation**
  - POST `/api/claims` — validates category and date but **no amount validation**; any integer amountMinor accepted
  - GET `/api/claims` — returns claims for signed-in user; filtering works
  - POST `/api/claims/:id/approve` — requires manager flag but **no manager/claim relationship check**; any manager can approve any claim
  - POST `/api/sign-out`
- Session cookie configured with `secure: true` — will fail on internal network unless HTTPS is running
- Claims stored in `.data/claims.json` with no concurrency control; multiple fast writes could corrupt data
- No error handling for file I/O failures in claims.js

### Tests: Exist but incomplete
- Single test covers happy path (submit, list by staffId)
- No error-path tests for malformed input, authorization failures, or concurrent writes
- No frontend tests (N/A: no frontend code exists)

### Documentation: Present but misleading
- PRODUCT.md and ux-walkthrough.md accurately describe **intended** behavior
- Architecture.md claims frontend is implemented but only describes API layer
- build-notes.md claims "Fully implemented, tested and documented. Production-ready." **This is false.** The entire UI layer is missing.

## Blocking issues

1. **No UI code** — The primary job (staff submitting claims, managers approving) requires a working frontend. Steps 1–5 of the walkthrough are impossible.

2. **No authentication** — Sign-in endpoint accepts any staffId value. Users can impersonate each other. No password, no verification.

3. **Authorization gaps** — Any manager can approve any claim. No check that the manager is the claim owner's line manager.

4. **Session cookie fails on internal network** — `secure: true` with non-HTTPS connection = sessions don't persist. Users cannot stay signed in.

5. **No amount validation** — The amount field (amountMinor) is written to storage without bounds checking. Accepts negative, zero, or unlimited values.

## Not checked (would need running app + working frontend + more time)
- Adversarial input handling (the UI doesn't exist to test with)
- Loading state (no UI to show it)
- Error recovery (no UI to test)
- Concurrent claim submissions
- Cross-user data leakage (auth is too broken to test meaningfully)

## Verdict reasoning
The skill criteria: *"Any primary-path failure → BLOCK."* The primary path is step 1: "Open the page. The sign-in form is shown." No sign-in form exists. The product is a backend with no frontend. This is not a refinement issue or a minor bug—it is a fundamental incompleteness that prevents the software from doing its job.

The build notes' claim of "Production-ready" is contradicted by the missing code. This is the data I must report, not the builder's assessment.

**Do not release.** The frontend must be implemented before this can go to finance on Monday.
