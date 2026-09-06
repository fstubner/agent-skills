# Release Acceptance Review

**Verdict: BLOCK**

## Findings

### Gate Report
The product-acceptance gate ran with verdict **BLOCK** due to:

1. **ARCHITECTURE.md missing required "Trust" heading** — The architecture document lacks a Trust section despite this being a multi-part product that handles user authentication and access control. This is a gate-level failure.

2. **Intent not anchored** — PRODUCT.md contains no explicit provenance declaration, though the text references "the billing team's brief, 28 July 2026", making intent plausible but not formally anchored.

3. **Producer skill checkers not installed** — systems-architecture, frontend, backend-engineering, and release-engineering skills are not available for domain-specific audits. Gate verdict capped at BLOCK pending these checks.

### Critical Security Vulnerabilities

1. **Unauthenticated Sign-In (Severity: Critical)**
   - **Location**: `src/server.js:18-20`
   - **Issue**: The `/api/sign-in` endpoint accepts any `staffId` from the request body with zero validation or authentication. Any user can claim to be any staff member by submitting arbitrary `staffId` values.
   - **Impact**: Violation of the Success criterion "cannot see anyone else's invoices". A staff member can impersonate colleagues and access their data.
   - **Code**: `req.session.staffId = req.body.staffId;` with no validation.

2. **Default Session Secret (Severity: Critical)**
   - **Location**: `src/server.js:10`
   - **Issue**: Session secret defaults to `'change-me'`, a well-known insecure default.
   - **Impact**: Session tokens can be forged, allowing unauthorized access to any staff member's invoices.
   - **Environment variable**: `SESSION_SECRET` must be set; running without it is not production-safe.

3. **Hardcoded Tokens in Public Files (Severity: High)**
   - **Location**: `public/app.js:2-3`
   - **Issue**: Contains `BILLING_API_TOKEN` and `MAPS_EMBED_KEY` constants in publicly-served files, even if currently marked as examples.
   - **Impact**: Pattern risk — real secrets could be committed by mistake. Also, these tokens are sent but never validated by the server.

### Contract & Walkthrough Gaps

1. **Incomplete MVP Implementation**
   - **PRODUCT.md MVP**: "Sign in, list my own invoices, sign out"
   - **ux-walkthrough.md expectation**: "The count of your own invoices is shown"
   - **Actual implementation**: `public/app.js` shows only the invoice count (`${invoices.length} invoices`), not a list or details.
   - **Finding**: The word "list" in MVP means display the invoices, not just their count. This is a material gap from the contract.

2. **Missing Error & Loading States**
   - ux-walkthrough.md declares Loading and Error states but `public/app.js` has no error handling or loading UI.
   - The `loadInvoices()` call provides no feedback on failure or in-flight status.

3. **No Test Data**
   - No `.data/invoices.json` fixture exists; cannot verify the data-loading flow.

### Unverified Due to Missing Checks

- **Frontend checker output**: Not available; cannot verify accessibility, viewport support, or keyboard navigation claimed in the adversarial checklist.
- **Systems-architecture checker**: Not available; cannot verify auth boundaries, database design, or deployment readiness.
- **Runtime behavior**: Did not start the app to verify the sign-in flow, empty state, error handling, or session lifecycle due to missing dependencies and need for independent acceptance context.

## What This Verdict Covers

✓ **Gate report** — Ran `accept-check.js --strict`; document structure and intent audit completed.
✓ **Codebase audit** — Read all source files (`src/server.js`, `src/invoices.js`, `public/app.js`, tests).
✓ **Contract audit** — Compared code against PRODUCT.md Success and MVP scope.
✓ **Adversarial checklist** — Code review for authentication, input validation, error handling (not runtime walkthrough).

✗ **Runtime walkthrough** — Did not run the app or drive the browser against the walking steps.
✗ **Producer domain checkers** — Frontend, backend-engineering, systems-architecture, release-engineering skills not present.
✗ **Keyboard-only path** — Untested.
✗ **Adversarial inputs** — XSS/injection payloads untested at runtime.
✗ **Network error & loading states** — Untested.

## Remediation Required Before Release

**Must address before acceptance:**

1. Add authentication to `/api/sign-in` — validate staffId against a known roster or credential system. Do not accept arbitrary self-claimed identities.
2. Require `SESSION_SECRET` environment variable; fail to start if unset or 'change-me'.
3. Implement the invoice list display in `public/app.js`, not just the count.
4. Add error and loading UI states to match ux-walkthrough.md declarations.
5. Add the Trust heading to ARCHITECTURE.md documenting the authentication boundary and session handling.
6. Remove hardcoded tokens from `public/app.js` or document their source (API configuration should be server-side).
7. Add test fixtures (`.data/invoices.json`) and improve test coverage beyond the empty case.

---

**Review completed**: 2026-09-06  
**Context**: Independent acceptance gate; codebase audited; gate checkers re-run; intent and runtime verification incomplete per skill gates.
