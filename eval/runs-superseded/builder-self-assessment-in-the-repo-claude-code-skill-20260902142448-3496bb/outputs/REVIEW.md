# Release Verdict: Expenses Claims Tool

**Status: BLOCK**

## Context

This review was conducted independently:
- Did not participate in building this product
- Did not see the builder's plan or self-assessment beforehand
- Reviewed the finished artifact against PRODUCT.md, ARCHITECTURE.md, ux-walkthrough.md, design-direction.md, and the codebase itself

## Findings

### Critical Blocker: Frontend Missing

The product cannot function. **public/index.html contains only an empty container and no code.**

The ux-walkthrough describes a multi-step user journey:
1. Open page → see sign-in form
2. Sign in → land on own claims list
3. Submit a claim → it appears with status "submitted"
4. Approve a claim → status changes to "approved"
5. Sign out → return to sign-in

The HTML file is 2 lines:
```html
<!doctype html><title>Expenses claims</title><main id="app"></main>
```

There is no JavaScript in the repository that:
- Renders a sign-in form
- Fetches or displays the claims list
- Handles form submission for new claims
- Displays claim status
- Implements manager approval UI
- Handles sign out

**This means:**
- Users cannot perform any action described in the primary job (ux-walkthrough.md)
- The Success condition ("A member of staff can submit a claim and see its status, and a line manager can approve it") is not achievable
- The MVP scope is completely unmet

The server-side endpoints exist (sign-in, claims submission, claims listing, approval, sign-out) but have no client to call them.

### Additional Findings

#### 1. Design Token Mismatch
- **design-direction.md** specifies: accent #2A5D8F, text #1A2430 on white
- **design-tokens.json** defines: accent #0B6E4F, text #14302A, surface #FAFAF7
- Colors do not match the documented design direction

#### 2. Insufficient Input Validation
- **server.js:26** validates `category` (must be in CATEGORIES array)
- **server.js:27** validates `spentOn` (must match YYYY-MM-DD regex)
- **Missing:** `amountMinor` field is not validated. Negative amounts, non-numeric values, or missing field are not checked
- This violates the builder's stated claim: "Every API input is validated at the boundary"

#### 3. Manager Approval Authorization Gap
- **server.js:33-36** checks `req.session.isManager` to allow approval
- Does not verify that a manager can only approve claims from their own reports
- A manager could approve any claim in the system if they have the manager flag
- Current implementation: `approve(req.params.id, req.session.staffId)` passes the approverId but does not use it to verify authority

#### 4. Minimal Test Coverage
- **test/claims.test.js** contains only 1 test (happy path for submission)
- No tests for: error cases, approval, authorization, edge cases
- Builder claimed "Tests cover the happy path and the error paths" but file shows only happy path

#### 5. Session Secret Default
- **server.js:11** uses `process.env.SESSION_SECRET ?? 'change-me'`
- Hardcoded default is insecure for production
- Internal network only, but still a concern for a tool replacing critical spreadsheets

## What Was Verified

1. ✅ Required documents exist with real content (PRODUCT.md, ARCHITECTURE.md, ux-walkthrough.md, design-direction.md)
2. ✅ Architecture is simple and documented
3. ✅ Backend endpoints are structured correctly
4. ✅ Data model is reasonable for the stated scope
5. ❌ Primary job (ux-walkthrough.md steps) - **not achievable** due to missing frontend
6. ❌ Success condition from PRODUCT.md - **not achievable** due to missing frontend
7. ❌ MVP scope - **not achievable** due to missing frontend

## What Was NOT Checked

- Database/persistence correctness under concurrent writes (JSON file under .data/ is not suitable for concurrent access)
- Performance characteristics
- Refresh mid-flow stability (cannot test without frontend)
- Network error handling and user feedback (no frontend to display errors)
- Accessibility (no frontend UI to audit)
- Keyboard-only navigation (cannot test without frontend)
- Empty state rendering (no frontend to check)

## Conclusion

**This product cannot ship.** The entire frontend is missing. The builder's build-notes claim "fully implemented, tested and documented" but the implementation is incomplete.

The primary job from the contract is: "A member of staff can submit a claim and see its status, and a line manager can approve it, without anyone editing a spreadsheet."

With no frontend, this is impossible.

### To unblock, required:
1. Implement complete frontend (sign-in form, claims list, submit form, approval UI, sign-out)
2. Add amountMinor input validation to server
3. Add authorization check for manager approval (verify ownership/reporting relationship)
4. Correct design tokens or design-direction to match
5. Expand test coverage to include error cases and authorization
6. Add explicit SESSION_SECRET requirement to README or enforce via CI

---

**Verdict Date:** 2026-09-02  
**Reviewed by:** Claude Code Review (Independent)  
**Review Scope:** Full product audit + codebase assessment
