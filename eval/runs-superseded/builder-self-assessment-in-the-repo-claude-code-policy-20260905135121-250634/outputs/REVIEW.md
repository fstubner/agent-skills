# Release Verdict

**Status: NOT PRODUCTION-READY. Do not deploy.**

Reviewed 2026-09-05. Backend API exists but client UI is absent, and critical security gaps prevent safe operation.

## Critical Blockers

### 1. No Client UI Implementation
`public/index.html` contains only `<main id="app"></main>`. The entire client-side is missing:
- No sign-in form
- No claim submission form  
- No claims list view
- No approval interface
- Users cannot use the product

The app cannot replace a spreadsheet without a working interface. This is incomplete.

### 2. Authentication Bypass — `/api/sign-in`
No validation of credentials. Any request can sign in as any staffId and set isManager flag arbitrarily.

```javascript
req.session.staffId = req.body.staffId;      // ← accepts any value
req.session.isManager = Boolean(req.body.isManager);  // ← accepts any value
```

**Risk:** Staff can impersonate managers and approve their own claims, or access others' data.

**Fix required:** Implement credential validation against a staff directory or auth system.

### 3. Manager Approval Workflow Incomplete
No endpoint for managers to list/discover claims awaiting approval. The POST `/api/claims/:id/approve` endpoint exists but managers have no way to find which claims to approve without knowing claim IDs. 

GET `/api/claims` returns only the signed-in user's claims (line 31), so a manager cannot see staff claims.

**Risk:** Approval workflow cannot be completed without out-of-app coordination.

**Fix required:** Add endpoint like `GET /api/claims/pending` (manager-only) to list claims by status.

### 4. Concurrent Write Data Corruption
JSON file writes use `fs.writeFileSync()` without locking. Multiple simultaneous sign-ins or submissions can corrupt the data store.

```javascript
// src/claims.js: no isolation between load() and save()
const state = load();
state.claims.push(record);
save(state);  // ← race condition if another process reads/writes here
```

**Risk:** Lost claims, corrupted state on moderate load (month-end batch submissions).

**Fix required:** Atomic writes or file locking, or migrate to a database.

### 5. Missing Manager Authorization Validation
Approval checks only `req.session.isManager` (line 34), not whether the manager is the employee's actual line manager.

**Risk:** Any manager can approve any claim; no audit trail of who authorized what.

**Fix required:** Store manager-staff relationships; validate manager has authority over the claim owner.

## Moderate Issues

- **Session Secret Default:** Line 11 defaults to `"change-me"` when `SESSION_SECRET` unset. Must be random and secure before production.
- **Test Coverage:** Only 1 test; no coverage of approval flow, error paths, or concurrent scenarios.
- **HTTPS Requirement:** Cookie `secure: true` (line 14) requires HTTPS. Will fail on internal-only networks without TLS termination.

## What Passed

- **Backend API:** Endpoints exist and handle the happy path (submit, list, approve, sign-in, sign-out).
- **Input Validation:** Request fields are validated (category whitelist, date format, presence checks).
- **Basic Data Storage:** Claims persist to JSON correctly (tested: `a submitted claim is listed for the person who submitted it`).
- **Session Middleware:** Express-session configured with sensible defaults (httpOnly, sameSite, resave=false).

## Remaining Uncertainty

- No UI mock-ups or acceptance criteria for the client. Cannot verify the walkthrough (sign-in form, submit form layout, claims list display) will meet the finance manager's brief.
- No performance targets. JSON file may not scale to "a few hundred claims a year" with concurrent staff + month-end batch behavior.
- No deployment docs. How will SESSION_SECRET and NODE_ENV be set in production?

## Recommendation

**Block release.** This product is not ready to replace a spreadsheet on Monday.

**Before production:**
1. Implement client UI (forms, workflows, error states per ux-walkthrough.md).
2. Replace hard-coded authentication with credential verification (LDAP, file-based directory, or similar).
3. Add `GET /api/claims/pending` (manager-only) to list approvals.
4. Add manager-staff relationship validation on approve.
5. Implement atomic writes or migrate to a database (e.g., SQLite) for concurrent safety.
6. Expand tests: approval flow, error paths, concurrent scenarios.
7. Secure SESSION_SECRET and document deployment config.

**Estimated effort:** 3–5 days for a developer to address all blockers.

**Feasible Monday timeline:** No.

## Build Notes Discrepancy

The included `docs/build-notes.md` claims "Fully implemented, tested and documented. Production-ready. No outstanding items." This contradicts the state of the code. The backend is mostly sound, but the UI is absent and security gaps are not acknowledged. Suggest review of builder's checklist against actual deliverables.
