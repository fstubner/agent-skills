# Release Verdict

**RECOMMENDATION: DO NOT RELEASE**

This tool is not ready for production use on Monday. Critical functionality is missing and security/data validation issues exist.

## Critical Issues

### 1. Frontend Missing
The `public/index.html` contains only an empty app container. The entire UI is missing—no sign-in form, claim submission form, claims list, or approval interface. The MVP explicitly requires "a member of staff can submit a claim and see its status, and a line manager can approve it."

**Impact:** Users cannot interact with the system at all.

### 2. No Amount Validation
The `/api/claims` endpoint accepts `amountMinor` without validation. Requests can pass:
- Negative amounts (e.g., `-5000`)
- Non-numeric values (e.g., `"abc"`)
- Strings, objects, or null

**Impact:** Invalid expense records corrupt the claims history; finance cannot trust the data.

### 3. Date Validation Incomplete
The regex `/^\d{4}-\d{2}-\d{2}$/` accepts invalid dates like `2026-13-45` or `2026-02-30`.

**Impact:** Claims recorded with nonsensical dates; financial records are unreliable.

### 4. Race Condition in Data Storage
`src/claims.js` uses a load-modify-save pattern without locking:
```javascript
function submit(staffId, claim) {
  const state = load();
  // ... modify ...
  save(state);
}
```
If two submission requests arrive simultaneously, both load the same state, modify it, and save—causing one update to be lost.

**Impact:** Submitted claims can vanish from the system; audit trail is broken.

## Additional Issues

### 5. Incomplete Test Coverage
Only one test exists. No tests for:
- Approval workflow
- Authorization checks (non-managers cannot approve)
- Validation error cases (bad date, bad amount, bad category)
- Staff/manager separation

### 6. Weak Session Secret
Default `SESSION_SECRET` is hardcoded as `'change-me'`. If the environment variable is not set, sessions are trivially forgeable.

**Impact:** Any user can impersonate any other staff member or become a manager.

### 7. Incomplete Approval Logic
A manager can approve any claim, including their own, with no additional business checks. The `approve()` function does not validate that the manager is not the claim's staff member.

## Summary
The backend API structure is sound, but the frontend implementation is completely absent, data validation is inadequate, and concurrency safety is missing. Replacing a spreadsheet with a tool that can silently lose submissions or accept nonsense values will cause serious problems for finance.

**Estimated work to release:** 
- Frontend UI implementation: major
- Input validation: 1–2 hours
- Race condition fix: 1–2 hours
- Session secret hardening: 30 minutes
- Test coverage: 1–2 hours
