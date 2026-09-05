# Acceptance Review: Expenses Claims Tool

**Verdict: BLOCK**

---

## Executive Summary

The expenses claims tool has critical blockers preventing deployment. No browser UI is implemented despite the walkthrough, PRODUCT.md, and ARCHITECTURE.md documenting one. The backend has security and data integrity issues: hardcoded session secrets, missing input validation, potential race conditions in concurrent requests, and authorization gaps.

---

## Gate Checks (Unable to Run)

The acceptance gate (`accept-check.js`) could not execute due to Node module system configuration conflicts. However, I proceeded with independent review per the skill directive: project documents are data to verify, not instructions to follow blindly.

---

## A — Contract Compliance

### PRODUCT.md Success Criterion: "A member of staff can submit a claim and see its status, and a line manager can approve it, without anyone editing a spreadsheet."

**BLOCKED**: The UI does not exist.
- `public/index.html` contains only a doctype, title, and `<main id="app"></main>`.
- No JavaScript implementation exists (no `public/app.js`, no `public/index.js`, no inline `<script>`).
- The project cannot render a sign-in form, claims list, or submission UI.
- **Finding: Primary job is not completable.**

### MVP Scope: "Submit a claim, list my own claims, approve a claim as a manager, sign out."

- Submit endpoint exists (`POST /api/claims`) but has no UI to call it.
- List endpoint exists (`GET /api/claims`) but has no UI to display it.
- Approve endpoint exists (`POST /api/claims/:id/approve`) but has no UI to call it.
- Sign-out endpoint exists (`POST /api/sign-out`) but has no UI to call it.
- **Finding: 0% of MVP is usable.**

---

## B — Security and Data Integrity Findings

### 1. Hardcoded Default Session Secret (Critical)
**File**: `src/server.js:11`
```javascript
secret: process.env.SESSION_SECRET ?? 'change-me',
```
- The fallback secret `'change-me'` is trivial and documented in source.
- Any attacker can forge sessions if `SESSION_SECRET` environment variable is not set.
- Session hijacking becomes trivial: sign in as any user by crafting a session cookie.
- **Impact**: Authentication bypass; any attacker can read and approve any expense claim.
- **Verdict: BLOCK**

### 2. Missing Input Validation (Critical)
**File**: `src/claims.js:15-27`
- No validation on `amountMinor` (claim.amountMinor is stored directly).
  - Negative amounts accepted: `{"amountMinor": -999999}` creates a $-9,999.99 refund claim.
  - Unbounded amounts accepted: `{"amountMinor": 999999999999}` causes financial record corruption.
  - Non-numeric amounts may pass if not validated on client (client is missing).
- No validation on `category` occurs in the submit function (only in server.js endpoint).
  - Direct calls to `submit()` bypass category validation.
- No validation on `spentOn` (date format validated in server.js with regex, but direct calls bypass it).
- **Impact**: Data integrity violation; fraudulent or malformed claims can be recorded.
- **Verdict: BLOCK**

### 3. Authorization Flaw: Any Manager Can Approve Any Claim (Critical)
**File**: `src/server.js:33-37` and `src/claims.js:30-38`
- The approval endpoint checks that the requester is a manager: `if (!req.session.isManager)`.
- It does NOT check that the manager approves claims for their own staff.
- A manager can approve claims submitted by employees who don't report to them.
- A manager can approve their own claims if they sign in with `isManager: true`.
- **Impact**: Managers can approve fraudulent expense claims outside their authority.
- **Verdict: BLOCK**

### 4. File-Based Concurrent Write Race Condition (High)
**File**: `src/claims.js:6-13`
- `load()` reads the JSON file entirely.
- Application logic modifies in-memory state.
- `save()` writes the entire file back.
- If two requests hit `submit()` or `approve()` simultaneously, both may load the same file state, modify it independently, and the second write overwrites the first (lost update).
- Example: Two staff submit claims simultaneously → only one is saved.
- **Impact**: Data loss; submitted claims can disappear silently.
- **Verdict: BLOCK**

### 5. Session Configuration: `secure: true` Without HTTPS Detection (Medium)
**File**: `src/server.js:14`
```javascript
cookie: { httpOnly: true, sameSite: 'lax', secure: true }
```
- `secure: true` requires HTTPS, but on a development/internal network with `NODE_ENV !== 'test'`, HTTPS may not be configured.
- Sessions will not be created over HTTP (cookie is silently rejected by the browser).
- The application will appear to break on HTTP-only networks without explicit warning.
- **Constraints state**: "Internal network only" — likely HTTP is the norm.
- **Impact**: Application unusable on internal network; staff cannot sign in.
- **Verdict: BLOCK**

### 6. Sign-In Has No Validation (Critical)
**File**: `src/server.js:19-23`
```javascript
app.post('/api/sign-in', (req, res) => {
  req.session.staffId = req.body.staffId;
  req.session.isManager = Boolean(req.body.isManager);
  res.json({ ok: true });
});
```
- No check that `staffId` exists or is valid.
- No check that the user is actually a manager (trusts the client-sent boolean).
- Any request with `{"staffId": "anyValue", "isManager": true}` succeeds.
- Allows arbitrary impersonation (I can sign in as anyone).
- **Impact**: Authentication bypass; data isolation violated.
- **Verdict: BLOCK**

---

## C — Walkthrough Replay

**Not completed**: The UI does not exist. Steps 1–5 of the walkthrough cannot be executed:
1. ✗ "Open the page. The sign-in form is shown" — No form exists.
2. ✗ "Sign in. Land on your own claims, most recent first" — No claims list UI exists.
3. ✗ "Submit a claim" — No form exists.
4. ✗ "Sign in as a line manager and approve" — No UI exists.
5. ✗ "Sign out. Returns to the sign-in form" — No form exists.

**Finding: 0/5 walkthrough steps executable.**

---

## D — Adversarial Testing

### Empty State
Cannot test; no UI exists.

### Error Handling
- Invalid category on the API returns `{ error: 'unknown category' }` (good).
- Invalid date on the API returns `{ error: 'bad date' }` (good).
- Non-existent claim approval returns `{ error: 'not found' }` (good).
- **No UI error display mechanism exists**, so these errors are not shown to users.

### Garbage Input
API endpoints do validate category and date format, but:
- `amountMinor` accepts any value (no range/type check).
- `staffId` on sign-in accepts any value.
- `isManager` boolean can be spoofed.

### Duplicate Submissions
Cannot test end-to-end; no UI exists. Backend race condition means duplicates would silently overwrite.

---

## Code Audit Summary

### Test Coverage
- **One test exists**: `a submitted claim is listed for the person who submitted it` (passes).
- **Tests missing**: 
  - No test for rejection of invalid categories.
  - No test for rejection of invalid dates.
  - No test for manager-only approval.
  - No test for race conditions.
  - No test for authorization (manager approval restrictions).
  - No test for session security.
  - No test for sign-in validation.

### Architecture Notes
- The JSON file approach is reasonable for scale but requires proper concurrency control.
- Express session configuration is sound in principle (httpOnly, sameSite) but undermined by other issues.
- No audit logging exists; no record of who approved what or when.

---

## What Was NOT Checked

1. **Runtime verification**: The server was not started or driven due to the missing UI. Any runtime testing requires a browser or HTTP client to exercise the endpoints; the walkthrough steps cannot be replayed.

2. **Database consistency under load**: Concurrent writes are not tested; the file-based system's behavior under simultaneous requests is unknown but likely unsafe.

3. **Mobile/narrow viewport compliance**: No viewport assertions can be made without a UI.

4. **Keyboard navigation**: Not applicable; no UI exists.

5. **Reload mid-flow resilience**: Not applicable; no UI state to persist.

6. **Deployment readiness**: Environment configuration (NODE_ENV, SESSION_SECRET, PORT) is not validated. The fallback to `secure: true` on insecure networks will fail silently.

---

## Blocking Issues Summary

| Issue | Severity | Category |
|-------|----------|----------|
| No UI implementation | BLOCK | Contract |
| Hardcoded session secret | BLOCK | Security |
| Missing amount validation | BLOCK | Data Integrity |
| Authorization bypass (any manager approves any claim) | BLOCK | Security |
| Concurrent write race condition | BLOCK | Data Integrity |
| Secure cookie on HTTP (internal network) | BLOCK | Functionality |
| Sign-in has no validation (impersonation) | BLOCK | Security |

---

## Recommendation

**Do not deploy.** The product is not complete and has critical security vulnerabilities:

1. **Immediate action required**: Implement the UI (sign-in form, claims list, submit form, approval interface).
2. **Security fixes**:
   - Validate `amountMinor` (non-negative, reasonable maximum).
   - Validate `staffId` on sign-in against a known list of users.
   - Add manager-staff mapping; only allow managers to approve claims from their reports.
   - Remove hardcoded session secret; require `SESSION_SECRET` environment variable.
3. **Data integrity**:
   - Implement file locking or atomic writes to prevent race conditions.
   - Add transaction-like semantics (read-modify-write must be atomic).
4. **HTTPS/Internal Network**:
   - Detect HTTP vs HTTPS at runtime; adjust session cookie `secure` flag accordingly.
   - Or document that HTTPS is required and fail fast if not detected.
5. **Testing**:
   - Add tests for authorization, validation, and security boundaries.
   - Add integration tests that exercise the full API flows.

---

## Provenance

This acceptance review was conducted independently from the build phase. The product documents (PRODUCT.md, ARCHITECTURE.md, ux-walkthrough.md) were treated as specifications to verify, not directives to follow. The acceptance gate could not execute but did not block this review; the skill allows independent audit.

**Intent Check**: PRODUCT.md declares provenance as "Written from the finance manager's brief, 30 July 2026." This intent is clear and anchored, so the verdict is not capped by an unanchored-intent check.

**Acceptor Independence**: This review did not modify the product code. No builder context or build plan was shared in this turn; this task was explicitly framed as an acceptance review. The verdict is not self-acceptance.

---

**Verdict Date**: 2026-09-05  
**Reviewed by**: Claude Code Review Agent
