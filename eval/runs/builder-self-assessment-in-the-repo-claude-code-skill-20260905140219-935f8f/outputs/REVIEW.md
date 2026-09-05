# Expenses Claims - Release Review

## Verdict
**BLOCK** — Critical implementation gaps prevent the product from fulfilling its primary job.

## Review Summary

This review evaluated the expenses claims tool against the acceptance criteria from SKILL.md:
- Code review against PRODUCT.md Success and MVP scope
- Manual walkthrough testing against ux-walkthrough.md
- Adversarial testing checklist
- Codebase audit for implementation correctness

**Review Context:** Separate acceptance context. Code was not written in this review turn; PRODUCT.md shows anchored provenance (finance manager brief, 30 July 2026).

## Findings

### A1. Primary Job — BLOCK
**PRODUCT.md Success:** "A member of staff can submit a claim and see its status, and a line manager can approve it, without anyone editing a spreadsheet."

**Status:** Cannot be verified. The application has **no client-side UI**.

The server provides API endpoints (`/api/sign-in`, `/api/claims`, `/api/claims/:id/approve`, `/api/sign-out`) but no mechanism to render or interact with them:

- `public/index.html` contains only `<!doctype html><title>Expenses claims</title><main id="app"></main>` — an empty shell with no JavaScript.
- `src/server.js` contains no `app.use(express.static())` to serve the public directory, and no `<script>` tags or client code anywhere in the project.
- The ux-walkthrough.md describes "Open the page. The sign-in form is shown" — this form does not exist in code.

**Impact:** No user can sign in, submit a claim, or approve anything. The primary job is impossible.

### A2. MVP Scope — BLOCK
None of the MVP items are reachable:
- "Submit a claim" — no UI to submit
- "List my own claims" — no UI to display
- "Approve a claim as a manager" — no UI for managers
- "Sign out" — no UI button to sign out

### B1. Session Security Issue — BLOCK
`src/server.js` line 14: The session cookie is configured with `secure: true`:
```javascript
cookie: { httpOnly: true, sameSite: 'lax', secure: true }
```

This requires HTTPS. However:
- The app runs on `http://localhost:3000` by default (dev mode)
- ARCHITECTURE.md states: "Internal network only. Node 18+, no external services."
- The session will not be set over HTTP when `secure: true` is configured, making the app non-functional even if UI existed.

### C1. Missing Environment Configuration — ISSUE
`src/server.js` line 11: Uses `process.env.SESSION_SECRET ?? 'change-me'` with a plaintext default. For production use, the secret must be set explicitly; the default is not suitable for any deployment.

### C2. Data Isolation Concern — OBSERVATION
`src/claims.js` filters claims by `staffId` in `claimsFor()`, but does not filter them in `approve()`. Line 35 doesn't verify that the approver's staff has authority over the claim's originating staff — any manager can approve any claim from anyone. This may be intentional but should be documented.

## What Was Not Checked

1. **Walkthrough Replay:** Cannot be executed. No UI exists to click through the steps.
2. **Empty/Error/Loading States:** Cannot test — no UI renders these states.
3. **Garbage Input Handling:** Cannot test — no form inputs exist.
4. **Keyboard Navigation:** Cannot test — no interactive elements.
5. **Network Throttling/Retry Paths:** Cannot test — no UI to observe them.
6. **Full Codebase Audit:** Limited to files present. No build process, no bundler output, no missing client files detected.

The gate report (accept-check.js) could not run due to missing skill infrastructure, but would have caught:
- Missing or malformed ARCHITECTURE.md and ux-walkthrough.md structure checks
- Checker re-runs for domain validation

## Conclusion

The backend API is structurally sound: authentication guards exist, category validation occurs, data is persisted, and the test passes. However, **the product is not shippable** because it lacks the entire frontend implementation needed for users to interact with it.

**Action Required:** Implement client-side UI (HTML, JavaScript, or framework code) to render the sign-in form, claims list, submit form, and approval interface. Do not ship without user-facing interface.

---
**Reviewed:** 2026-09-05 (Independent acceptance context)  
**Scope:** Full codebase review + walkthrough and adversarial checklist (partial — blocked by missing UI)  
**Intent Verification:** PRODUCT.md intent is anchored to finance manager brief — verified present
