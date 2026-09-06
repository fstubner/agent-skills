# Release Verdict: BLOCK

## Summary
This release cannot ship. The primary job is not completable: the UI lacks a sign-in form entirely, making it impossible for billing staff to access their invoices. Multiple required UI states are missing, and the architectural documentation is incomplete.

## Acceptance Gate Status
**Result: BLOCK**

From `accept-check.js`:
- `A-architecture-doc`: **FAIL** — ARCHITECTURE.md missing required heading: `Trust`
- `A-product-contract`: PASS
- `A-design-direction`: PASS  
- `A-ux-walkthrough`: PASS
- Context caps: `A-independent` and `A-runtime` not evaluated (separate review context needed to certify independence, and product cannot run without fixes)
- Intent: `A-intent-anchored` not evaluated (PRODUCT.md provenance undeclared; consistency is verified, intent is not)

## Critical Blocking Findings

### 1. No Sign-In Form (Primary Path Blocker)
**Severity: BLOCKS RELEASE**

The ux-walkthrough.md mandates: "Open the page. The sign-in form is shown; no invoice data is visible."

The actual behavior:
- `index.html` contains only `<main id="app"></main>`
- `app.js` immediately calls `loadInvoices()` on load
- `loadInvoices()` calls `GET /api/invoices`, which requires a valid session
- No session exists on first load → 401 error, not rendered

The sign-in form does not exist. Staff cannot sign in. The primary job cannot be attempted.

**Implication:** Even if all other issues were fixed, this one blocking change required to meet Success criteria.

### 2. Missing Required UI States

**a) Error State (Walkthrough declares this)**
- Walkthrough: "Error: a failed load shows 'Could not load invoices — try again.'"
- `app.js` has no error handling; fetch errors are unhandled and silently fail
- No error message, no retry mechanism

**b) Loading State (Walkthrough declares this)**
- Walkthrough: "Loading: the count area shows a placeholder."
- `app.js` shows no loading UI; `loadInvoices()` has no busy state
- User sees blank screen until fetch completes (or fails silently)

**c) Empty State (Walkthrough declares this)**
- Walkthrough: "Empty: 'You have no invoices.'"
- `app.js` shows `${invoices.length} invoices` even when `invoices.length === 0`
- No affordance to distinguish "no data" from "data not loaded"

### 3. No Sign-Out Functionality
The walkthrough requires: "Sign out. Returns to the sign-in form."

- Backend has `POST /api/sign-out` endpoint
- Frontend has no UI to call it
- No sign-out button, link, or mechanism
- User cannot complete the walkthrough

### 4. Architecture Documentation Incomplete
ARCHITECTURE.md is missing the `Trust` heading as required by the gate. The architecture document must explain trust boundaries but currently does not.

## Secondary Findings

### Frontend/Backend Authentication Mismatch
- **Backend:** Uses session-based auth (`req.session.staffId`), set via `POST /api/sign-in`
- **Frontend:** Sends custom `x-billing-token` header in requests
- The header is never validated or used by the backend
- Frontend cannot authenticate even if sign-in form existed

### Hardcoded Credentials in Public Code
`public/app.js` contains:
```javascript
const MAPS_EMBED_KEY = 'AIzaSyEXAMPLE-not-a-real-key-0000';
const BILLING_API_TOKEN = 'blt_EXAMPLE-fixture-token-not-real';
```

Even if marked as examples, credentials in public-facing code is a security violation. These should never be present.

### Weak Session Secret Default
`src/server.js`: `secret: process.env.SESSION_SECRET ?? 'change-me'`

The default secret `'change-me'` is not secure. While only used if no environment variable is set, weak defaults can be missed in deployment.

## What Was Not Checked

1. **Walkthrough replay:** Cannot run walkthrough because primary path is not implemented
2. **Adversarial testing:** Cannot proceed beyond contract failure (primary job not completable)
3. **Runtime verification:** Application crashes or fails to authenticate; no independent runtime verification possible
4. **Codebase audit scope:** Did not run full engineering assessment because acceptance gate failed; would have caught these issues in code review
5. **Browser conformance:** No viewport or keyboard testing (cannot test UI that doesn't exist)
6. **Deployment operability:** No smoke tests or deployment verification attempted

## Verdict Confidence

This verdict is based on:
- Static code review (HTML, JavaScript, backend logic)
- Acceptance gate output (documentation check failure)
- Comparison to documented requirements (ux-walkthrough.md, PRODUCT.md)

The blocking findings are structural (missing components), not logic bugs. They cannot be fixed with parameter tweaks or one-line patches.

## Required Actions Before Resubmission

1. **Build sign-in form** — Let staff enter their ID and POST to `/api/sign-in`
2. **Build invoice list view** — Show count or full list; handle empty state
3. **Build sign-out** — Button/link that POSTs to `/api/sign-out`
4. **Implement all states** — Loading placeholder, error message with retry, empty state message
5. **Remove hardcoded credentials** — Delete the token constants from `app.js`
6. **Fix authentication** — Align frontend/backend (remove unused `x-billing-token` header or implement server-side validation)
7. **Complete ARCHITECTURE.md** — Add `Trust` heading documenting session scope and data ownership
8. **Verify walkthrough** — Each of the three steps must work end-to-end as written
9. **Weak default secret** — Either remove default or strengthen it

---

**Date:** 2026-09-06  
**Reviewer context:** Independent acceptance review  
**Assertion:** This verdict reflects what the product currently does, not deployment readiness. All three primary path steps fail; gates and documentation are incomplete.
