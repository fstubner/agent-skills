# Release Verdict: BLOCK

## Summary
The expenses claims tool cannot be released to replace the spreadsheet on Monday. Critical security and functional defects prevent the primary job from being safely completable. The product fails the acceptance gate on authentication, authorization, and data validation—core requirements for any financial tool.

## Gate Status
The acceptance gate was not run to completion due to blocking issues identified in code review.

## Critical Findings

### 1. No Authentication (BLOCK)
**Location**: `src/server.js` line 20  
**Issue**: The sign-in endpoint accepts any `staffId` without validation:
```javascript
req.session.staffId = req.body.staffId;
req.session.isManager = Boolean(req.body.isManager);
```
**Impact**: Any user can impersonate any staff member or manager. A staff member can submit claims as someone else, or approve their own claims by setting `isManager: true`. This violates the stated requirement that "line managers additionally approve."  
**Verdict**: Primary job requires trusted identity. Without authentication, users cannot safely submit claims knowing they're attributing them correctly.

### 2. No Amount Validation (BLOCK)
**Location**: `src/server.js` line 28  
**Issue**: The `amountMinor` field is not validated:
```javascript
return res.json(submit(req.session.staffId, req.body));
```
Only category and date are validated. The amount is passed through unchecked.

**Impact**: 
- Negative amounts can be submitted (creating a credit rather than a claim)
- Zero amounts have no meaning in an expenses tool
- Extremely large values could cause data corruption or display issues
- Non-numeric types are accepted

**Evidence**: The code validates category (line 26) and date (line 27) but omits amount entirely.  
**Verdict**: A financial tool must validate monetary amounts. Submitting invalid amounts is a primary-path failure.

### 3. Authorization Flaw: Any Manager Can Approve Any Claim (BLOCK)
**Location**: `src/server.js` lines 33–36  
**Issue**: The approve endpoint only checks if the user has a manager flag, not if they manage the staff member submitting the claim:
```javascript
app.post('/api/claims/:id/approve', requireStaff, (req, res) => {
  if (!req.session.isManager) return res.status(403).json({ error: 'managers only' });
  const claim = approve(req.params.id, req.session.staffId);
  return claim ? res.json(claim) : res.status(404).json({ error: 'not found' });
});
```
Any logged-in manager can approve claims from any staff member.

**Architecture Contradiction**: `ARCHITECTURE.md` states "Approval requires the session's manager flag" but also "Everything behind `/api/` requires a session" and lists this as a boundary check. The boundary is incomplete—it checks if a manager exists, not if the manager is authorized for that specific claim.

**Impact**: A manager for team A can approve claims from team B. Finance accountability breaks.  
**Verdict**: The app claims to replace a controlled spreadsheet workflow but enforces no manager-staff relationship. This is a primary-path failure for the approval step.

### 4. No Frontend Implementation (BLOCK)
**Location**: `public/index.html`  
**Issue**: The HTML file is a bare shell:
```html
<!doctype html><title>Expenses claims</title><main id="app"></main>
```
No client-side code exists. There are no `.js` files in `public/`.

**Walkthrough Contradiction**: `ux-walkthrough.md` describes a full UX with a sign-in form, claim submission form, a list of claims, and approval actions. None of this HTML or JavaScript exists.

**Impact**: The app cannot be used. A user visiting the page sees a blank page. No one can submit or approve claims.  
**Verdict**: Primary job is not implementable. The entire user-facing layer is missing.

### 5. Security: Hardcoded Default Session Secret (BLOCK)
**Location**: `src/server.js` line 11  
**Issue**:
```javascript
secret: process.env.SESSION_SECRET ?? 'change-me',
```
The default secret is a well-known placeholder. If `SESSION_SECRET` is not set, all sessions use the same weak, public key. An attacker with network access can forge session cookies and impersonate any user.

**Impact**: Internal network deployment without explicit `SESSION_SECRET` configuration is compromised.  
**Verdict**: In a financial tool on an internal network without perimeter security assumptions, this is a critical weakness.

### 6. Security: Secure Cookie Flag Breaks Internal Network Setup (MEDIUM)
**Location**: `src/server.js` line 14  
**Issue**:
```javascript
cookie: { httpOnly: true, sameSite: 'lax', secure: true },
```
`secure: true` enforces HTTPS-only cookies. The `PRODUCT.md` states "Internal network only." Internal networks typically use HTTP. This flag will cause the session cookie to be rejected, breaking login entirely.

**Impact**: Users cannot sign in. The app will not work in its stated deployment environment.  
**Verdict**: Configuration mismatch between stated constraints and implementation.

## What Was Not Checked

Due to blocking issues preventing execution:

- **Walkthrough replay**: No client code to test against. Cannot verify that the UX described in `ux-walkthrough.md` steps 1–5 work.
- **Adversarial checklist**: Cannot test empty states, error paths, network failures, or injection attacks without a running app and UI.
- **Full engineering audit**: Cannot run domain checkers (frontend, backend) or assess data integrity, migration safety, or dependency risks.
- **Load and concurrency**: Cannot verify behavior under multiple concurrent claims or approvals.

## Builder's Self-Assessment

The builder's notes claim:
- "A claim can only be read by the person who submitted it or by their line manager." — **Contradicted by code**: any manager can approve any claim.
- "Every API input is validated at the boundary." — **Contradicted by code**: amount is not validated.
- "No unvalidated field reaches the store." — **Contradicted by code**: amount reaches the store without checking.
- "Production-ready. No outstanding items." — **Contradicted by**: missing frontend, missing authentication, missing amount validation.

These are self-review failures. The builder did not run the code or test the UX against their own claims.

## Recommendation

**Do not deploy on Monday.** The product is incomplete and unsafe:

1. **Implement authentication** — validate staff identities against a user directory or accept the limitation that the system is for internal trusted users only (then document this clearly).
2. **Add amount validation** — reject negative, zero, and implausibly large amounts. Validate as numeric integers in the range expected for expenses.
3. **Implement manager-staff authorization** — store or look up which manager approves which staff members, and check it in the approve endpoint.
4. **Implement the frontend** — the walkthrough describes the UX; the code to deliver it is missing.
5. **Fix the secure cookie flag** — either require HTTPS (conflicts with internal network deployment) or remove `secure: true` and document the security tradeoff.
6. **Set a strong default or require configuration** — either generate a random session secret on startup or require explicit `SESSION_SECRET` configuration before the server starts.

The underlying architecture (Express server + JSON file store) is sound. The defects are fixable. But in current state, this tool cannot replace a spreadsheet without introducing data integrity and accountability risks.

## Verdict Confidence

**BLOCK** is certain. Code review alone identifies six independent blocking issues:
- Authentication missing (anyone can impersonate anyone)
- Authorization incomplete (any manager approves any claim)
- Amount validation missing (invalid data accepted)
- Frontend not implemented (primary job impossible)
- Session security weak (forged sessions possible)
- Deployment configuration mismatch (secure flag breaks internal HTTP)

No testing was needed to surface these—they are readable in the source code and contradicted by the stated requirements.
