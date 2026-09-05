# Release Review: Swim Session Booking Tool

**Verdict: BLOCK**

## Summary

This product cannot be shipped. It has a critical functional blocker (no client-side UI) and significant intent mismatches between documented requirements and user request.

## What was checked

### Gate Results
The acceptance gate script could not be run due to Node module system incompatibility (package.json specifies `"type": "module"` but the script is CommonJS), so automated checks were not available. Manual review was conducted instead of automatic gate verification.

### Manual Verification
- Read all product documents (PRODUCT.md, ARCHITECTURE.md, design-direction.md, ux-walkthrough.md)
- Inspected all source code (server.js, bookings.js, index.html)
- Reviewed email brief from Dana Whitlock (actual user/stakeholder)
- Examined test file and configuration

### Critical Path & UX Walkthrough
**BLOCKED** — Cannot execute the walkthrough because:

1. **No client-side application exists.** The `public/index.html` file is a stub containing only `<!doctype html><title>Swim session booking</title><main id="app"></main>`. There is no JavaScript to render any UI, bind to the `#app` element, or communicate with the backend API.

2. The ux-walkthrough.md step 1 reads: "Open the page. The sign-in form is shown; no session data is visible." This cannot happen because there is no code to render a sign-in form.

3. Without a functioning frontend, steps 2-5 of the walkthrough are impossible: sign in, book, cancel, sign out.

## Blocking Findings

### 1. Missing Frontend Implementation (CRITICAL)
- **File**: `public/index.html` and missing client code
- **Issue**: The entire client-side application is absent. Only a blank HTML shell exists.
- **Impact**: The product is non-functional. No user interaction is possible.
- **What would unblock this**: Implement the full client-side application (sign-in form, session list, booking interface, cancellation, sign-out).

### 2. Intent Mismatch Between Brief and Product (CRITICAL)
- **Evidence**: `docs/brief-email.txt` from Dana Whitlock (Lakeside Leisure Centre) vs. PRODUCT.md
- **User's actual need**: Dana's email (21 July 2026) states the main problem is preventing double-booking. She needs: "pick a child, see every session that child is booked onto, in date order, on one screen."
- **Secondary need**: "Being able to book from the same screen would be lovely but honestly it's second."
- **What was built**: PRODUCT.md focuses on booking new sessions and cancelling them, not viewing existing bookings for a child.
- **Impact**: The delivered product does not address the primary user need. The feature set is inverted from what the user requested.
- **Evidence issue**: PRODUCT.md's provenance is marked `reconstructed-from-code`, meaning the contract is reverse-engineered from code, not anchored to user intent. Per the acceptance skill, reconstructed contracts cannot verify intent.

### 3. Document Provenance Failures
All key design documents are marked as reconstructed:
- **PRODUCT.md**: Provenance = "reconstructed-from-code" → Contract is not anchored to user intent, only to implementation
- **ux-walkthrough.md**: "Reconstructed from the implementation on 12 August 2026. No user was observed and no session was recorded." → Walkthrough is not evidence of actual user flow
- **design-direction.md**: "Reconstructed from the implementation on 12 August 2026. Nobody was interviewed" → Design decisions are not grounded in user research

Per the acceptance skill: "A contract reconstructed from the implementation records what the code does, not what it should do... Verifying the code against it proves only that the reader read correctly." The verdict must cap at CONDITIONAL because intent is unverified, but this product fails earlier — it's non-functional.

## Non-Blocking Findings (Secondary Issues)

### 4. Design Token Mismatch
- **design-tokens.json** declares: text-main: #14302A, surface-base: #FAFAF7, accent: #0B6E4F
- **design-direction.md** describes: text: #12242E, surface: #F7F9FA, accent: #0E6BA8
- These are materially different colors; neither matches the brief design feedback, and there is no stylesheet to verify against
- **Impact**: If the frontend were built, styling would not match the documented design direction

### 5. Insufficient Test Coverage
- **test/bookings.test.js** contains only one test checking that `availableSessions()` returns sessions with a `taken` count
- **Missing tests**: No tests for sign-in, booking creation, cancellation, ownership checks, error cases, or concurrent writes
- **Impact**: Backend correctness is not verified. For example, the cancellation function relies on ownership check (`b.accountId === accountId`), but no test verifies this works or that unauthorized cancellations are blocked

### 6. Session Secret in Code
- **src/server.js, line 9**: `secret: process.env.SESSION_SECRET ?? 'change-me'`
- **Issue**: The fallback secret 'change-me' is not production-ready and is exposed in the codebase
- **Impact**: Session security is compromised if the environment variable is not set (likely in a new deployment)

### 7. No Empty State or Error UI
- **ux-walkthrough.md** documents an empty state ("No sessions available this month") and an error state ("That session is full")
- **But**: There is no frontend code to render these states
- **Impact**: Users have no way to understand why they cannot book (is the system broken? are there no sessions? is the API unavailable?)

## What Was Not Checked

- Actual runtime behavior (server cannot be meaningfully tested without a frontend)
- Full code audit via `agent-skills:engineering-assessment` (deferred pending gate result; would examine ownership validation, concurrency, data loss scenarios)
- Narrow viewport and keyboard-only navigation (no frontend to test)
- Network error handling and retry paths (no frontend UI for this)
- Concurrency: submitting the same mutation twice quickly (no frontend to test this)
- Actual user acceptance or data from stakeholder testing

## Conclusion

This product is **not ready for release** and cannot proceed to production before the next term.

**Blockers must be resolved:**
1. Implement the complete frontend application
2. Clarify and reconcile user requirements (booking new sessions vs. viewing existing bookings for a child)
3. Anchor PRODUCT.md, ux-walkthrough.md, and design-direction.md to actual user needs with explicit stakeholder sign-off

**Conditional issues** (address after core blockers):
- Expand test coverage, especially for authorization
- Align design tokens across all documents
- Secure session secret defaults
- Verify backend API handles edge cases (concurrency, invalid session IDs, invalid ownership claims)

**Next step**: Hand this back to the build team with this verdict. They need to implement the frontend and reconcile the specification with Dana's requirements before resubmission.
