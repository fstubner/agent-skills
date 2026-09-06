# Release Verdict: BLOCK

## Summary
The fault reporting tool is **not ready for release**. Critical features required by the MVP contract are not implemented, and the product contains multiple defects that prevent core functionality from working.

## What Was Verified

### A — Contract Review
Checked against PRODUCT.md Success condition and MVP scope:

| Requirement | Status | Finding |
|---|---|---|
| Sign in with tenancy reference | ✗ MISSING | No sign-in form in frontend. App.js starts at step 1 of fault report, not at login. |
| List own reported faults | ✗ MISSING | No list view implemented. Faults are stored server-side but not displayed. |
| Report a fault in 3 steps | ⚠️ PARTIAL | 3-step form exists but without the surrounding flow (list before, confirmation after). |
| Sign out | ✗ MISSING | Server has `/api/sign-out` endpoint but no UI button or link. |
| Work from a phone on mobile data | ⚠️ INCOMPLETE | Design direction met (large text, tap targets), but missing essential flows break usability. |

### B — Primary Path (UX Walkthrough)
Walkthrough describes: open page → sign in → land on faults list → start report → 3 steps → fault appears in list → sign out.

Frontend (`public/app.js`) does not match this flow:
- **Step 1 (sign-in form)**: ✗ Missing entirely. App renders fault report step 1 immediately.
- **Step 2 (land on faults list)**: ✗ Missing entirely. No list view code in app.js.
- **Steps 3-5 (report flow)**: ⚠️ Partial. Three-step form exists (property/room, description/urgency, review), but as the entry point, not as part of a complete flow.
- **Step 4 (fault appears in list)**: ✗ No confirmation screen; step jumps to undefined step 4.
- **Step 5 (sign out)**: ✗ Missing UI.

### C — Adversarial Testing (Static Analysis)

#### Critical Defects

1. **Hardcoded Fault Timestamp** (src/faults.js:17)
   - Every fault record gets timestamp `'2026-08-31T00:00:00Z'` regardless of when it was reported
   - Violates the contract that reports contain enough detail for trade scheduling
   - Makes it impossible to determine when faults were reported or prioritize by recency
   - Failure scenario: Two faults reported one week apart both show same timestamp

2. **Insecure Session Secret** (src/server.js:11)
   - Defaults to `'change-me'`, a well-known placeholder
   - Easy for anyone with source code access to forge session cookies
   - Violates security for housing data
   - Production deployment must set `SESSION_SECRET` env var or risk immediate compromise

3. **Unvalidated Sign-in** (src/server.js:20)
   - Accepts any string as a tenantId without validation
   - No verification that a tenancy reference actually exists
   - Allows anyone to impersonate any tenant by guessing or knowing a reference number
   - Failure scenario: User signs in as `tenant-anyone-else`, views their faults, reports faults under their account

4. **Missing Frontend Entry Point**
   - App.js has no sign-in screen or session check
   - Attempts to render fault report form for unauthenticated users
   - No session injection into frontend despite server managing sessions
   - Frontend cannot access or display session state

#### Major Defects

5. **No Description Length Validation** (src/validate.js:8)
   - Checks `typeof body?.description !== 'string'` but not if empty
   - Empty description: `""` passes validation, submitted to server
   - Trades need actionable details to dispatch work

6. **Potential XSS in Error Display** (public/app.js:38)
   - `errors.join(', ')` inserted via `innerHTML` without escaping
   - Validation errors are server-controlled messages (safe), but sets bad pattern
   - Frontend stores unvalidated user input in `draft.description` and other fields

7. **No Property/Room Validation**
   - Form accepts any string for property and room
   - No predefined list of valid properties/rooms from server
   - Trades cannot dispatch work to undefined properties

8. **Missing Loading/Error States**
   - No network error recovery UI (POST /api/faults fails → no error shown)
   - No retry mechanism for failed submissions
   - Incompatible with design direction: mobile data on poor connections

9. **No Session State on Frontend**
   - Server stores session but frontend cannot check if logged in
   - Cannot conditionally render sign-in vs. app views
   - All views render regardless of authentication

### D — What Was Not Checked

- **accept-check.js**: Could not run; core dependencies not vendored in repository
- **Runtime behavior**: Did not run server or exercise HTTP endpoints interactively (permission constraints)
- **Browser rendering**: Did not verify CSS, layout, or mobile viewport behavior
- **Concurrent request handling**: Did not test duplicate submission handling
- **Data persistence**: Did not verify .data/faults.json behavior across server restarts
- **Session middleware**: Did not test session expiry, cookie flags, or sameSite behavior in browser

These gaps mean the verdict is based on code correctness and contract compliance, not runtime verification.

---

## Blocking Findings

**1. Frontend does not implement contract UX flow**
   - The ux-walkthrough.md primary job is: "A tenant reports a fault at their property from a phone"
   - The walkthrough requires sign-in → list faults → report fault → view in list → sign out
   - app.js implements only a disconnected 3-step form with no list or sign-in
   - Result: Tenants cannot use the app as designed

**2. Hardcoded timestamp breaks core functionality**
   - Housing officer cannot see when faults were reported
   - Faults cannot be prioritized by date
   - Result: Unusable for trade dispatch

**3. Unvalidated sign-in allows impersonation**
   - Any user can view/report faults under any other tenant's account
   - Result: Violation of privacy and data isolation

**4. No session state in frontend**
   - Frontend has no way to know if user is signed in
   - Cannot render conditional UI
   - Result: App cannot implement multi-view flow

---

## Conclusion

The product passes basic unit tests for validation logic but fails to deliver the core contract. The frontend is disconnected from the server's session and API layer. Critical security (session secret, sign-in validation) and data integrity (hardcoded timestamp) issues must be fixed before any deployment.

**Verdict: BLOCK** — Not ready for tenant release.
