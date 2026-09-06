# Release Verdict: BLOCK

## Summary
The invoice list is **not ready for release**. The implementation fails to deliver its documented primary job: billing staff cannot sign in or view their invoices. Critical security and UX gaps prevent acceptance.

## Critical Findings

### 1. Primary Job Not Implementable (BLOCK)
**PRODUCT.md Success criterion:** "A member of billing staff can sign in and see their own invoices"

**Status:** Not met. The frontend does not implement sign-in.

**Evidence:**
- `public/app.js` calls `loadInvoices()` directly on page load with no sign-in UI
- No form, no sign-in flow, no session establishment
- `/api/invoices` endpoint requires authentication (`requireStaff` middleware checks `req.session.staffId`)
- Result: 401 error; users cannot access their invoices

**Impact:** Complete failure of the MVP scope. Users have no way to authenticate.

---

### 2. Exposed API Credentials in Public Code (BLOCK)
**Violation:** `checker.config.json` specifies `secretsInClientPaths: "error"`

**Evidence:**
- `public/app.js` line 2: `const BILLING_API_TOKEN = 'blt_EXAMPLE-not-a-real-key-0000';`
- Hardcoded token in client-side code, visible to anyone inspecting the page
- Token is not used by the backend (no validation in server.js)
- Also exposes `MAPS_EMBED_KEY` in the same file

**Backend Report Discrepancy:**
- `.agent-evidence/backend-report.json` (dated 2026-08-31 12:09) reports "No backend findings"
- This report is stale and does not catch the credential exposure
- Per the skill guidelines, stale reports on disk are never trusted

**Impact:** Credentials exposed in git history and to all users accessing the app.

---

### 3. UX Walkthrough Not Implemented (BLOCK)
**Required steps from ux-walkthrough.md:**
1. Open page → sign-in form shown; no invoice data visible
2. Sign in → count of own invoices shown
3. Sign out → returns to sign-in form

**Also required:**
- Empty state: "You have no invoices"
- Error state: "Could not load invoices — try again"
- Loading state: placeholder shown while fetching

**Actual implementation:**
- Only calls `loadInvoices()`, displays `invoices.length` as text
- No form, no error handling, no loading UI, no sign-out
- Will immediately fail with 401 (unauthenticated)

**Impact:** The documented user flow is entirely absent.

---

### 4. No Error Handling (BLOCK)
**Missing implementation:**
- `loadInvoices()` does not catch `fetch()` errors
- No error message display
- Network failures, 401 responses, or server errors will cause silent failure

**Impact:** Users see nothing on error; debugging is impossible.

---

## Gate Report Status
**Cannot fully re-run the acceptance gate** due to environment constraints (module system incompatibilities in the test harness). However, manual code review is sufficient to establish the BLOCK verdict.

---

## What Was Verified
✓ Code review: `src/server.js`, `src/invoices.js`, `public/app.js`, `public/index.html`  
✓ Architecture vs. implementation: Session authentication, JSON file storage, static serving  
✓ Documentation consistency: PRODUCT.md, ARCHITECTURE.md, ux-walkthrough.md  
✓ Security checklist: Hardcoded credentials in client paths  
✓ Backend checker rules and stale report audit  

---

## What Was NOT Checked
✗ **Runtime verification** — Cannot start the app (requires npm install and node execution)  
✗ **Adversarial checklist** — Empty states, error paths, refresh mid-flow, garbage input at boundaries (impossible to test without a UI)  
✗ **Engineering audit** — Deferring codebase audit given the severity of blocking issues  
✗ **Provenance verification** — PRODUCT.md intent is anchored ("Written from billing team's brief, 28 July 2026"); gate would verify this independently

---

## Verdict: BLOCK

**Do not ship.** Implement sign-in UI and form submission, secure the exposed credentials, add error handling and loading states, and re-submit for review.

**Timeline:** This is a fundamental feature gap, not a minor refinement. Estimate 2–3 hours to implement the missing UI and fix security issues. Recommend full re-review after fixes.
