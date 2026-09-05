# Release Verdict: Expenses Claims Tool

**Status:** NOT READY FOR PRODUCTION

The tool has functional MVP scope but contains critical security vulnerabilities and data integrity issues that must be resolved before replacing the spreadsheet system.

## Critical Issues

### 1. No Authentication / Authorization Validation (SECURITY CRITICAL)

**Location:** `src/server.js:19-23`

The sign-in endpoint accepts any `staffId` and `isManager` flag from the client with zero validation:

```javascript
app.post('/api/sign-in', (req, res) => {
  req.session.staffId = req.body.staffId;
  req.session.isManager = Boolean(req.body.isManager);
  res.json({ ok: true });
});
```

**Risk:**
- Any client can impersonate any staff member
- Any client can self-elevate to manager and approve all claims
- No audit trail of who approved what
- Violates the finance use case (staff and managers must be identifiable)

**Why the build notes claim is incorrect:** The notes claim "Authorisation on every route" but authorization requires *authentication* first. The code has no authentication mechanism at all.

**Fix Required:** Implement actual staff directory integration or at minimum:
- Require a staff directory file or environment variable listing valid staffIds and manager assignments
- Validate staffId and manager status against this source of truth
- Reject any sign-in request with invalid or missing staffId

### 2. Missing Input Validation for Amount (DATA INTEGRITY)

**Location:** `src/server.js:25-29`

The `amountMinor` field is accepted without validation:

```javascript
app.post('/api/claims', requireStaff, (req, res) => {
  if (!CATEGORIES.includes(req.body.category)) return res.status(400).json({ error: 'unknown category' });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(req.body.spentOn ?? '')) return res.status(400).json({ error: 'bad date' });
  return res.json(submit(req.session.staffId, req.body)); // ← amountMinor not validated
});
```

**Risk:**
- Negative amounts could be submitted (credits/fraud)
- Zero amounts (nonsensical claims)
- Extremely large amounts (typos or attacks)
- Non-integer values leading to corrupted financial data
- Violates "Validate inputs and authorization at trust boundaries"

**Fix Required:** Add validation:
```javascript
if (typeof req.body.amountMinor !== 'number' || req.body.amountMinor < 1 || req.body.amountMinor > 1000000) {
  return res.status(400).json({ error: 'invalid amount' });
}
```

### 3. Insufficient Test Coverage

**Location:** `test/claims.test.js`

Only one test exists. The build notes claim "Tests cover the happy path and the error paths" but there are no tests for:
- Invalid amounts
- Invalid categories (claim says this is validated but not tested)
- Invalid date formats (claim says this is validated but not tested)
- Unauthorized access (no session)
- Authorization failures (non-manager attempting approval)
- Approval workflow
- Edge cases (missing fields, wrong data types)

**Fix Required:** Add comprehensive tests covering at minimum:
- All validation error cases
- Approval authorization (manager/non-manager)
- Claim visibility (staff only see their own)
- Concurrent submissions (if concurrency fixes are applied)

### 4. Data Integrity: Fragile ID Generation

**Location:** `src/claims.js:18`

```javascript
id: `c${state.claims.length + 1}`,
```

**Risk:**
- If file is corrupted and read as empty array, IDs restart at c1 (collisions)
- If claims are ever deleted/purged, IDs will reuse
- Not idempotent if submission retries occur

**Lower priority but should be fixed:** Use UUID or timestamp-based IDs instead.

### 5. Race Condition in File-Based Storage

**Location:** `src/claims.js` (load/save pattern)

The load-modify-save pattern is not atomic:

```javascript
function load() { return JSON.parse(...) }
function save(state) { fs.writeFileSync(...) }
export function submit(...) {
  const state = load();     // ← Another request could load here
  state.claims.push(record); // ← And here
  save(state);             // ← Both writes overwrite
}
```

**Risk:** Two simultaneous submissions will lose one claim.

**Severity:** Medium (internal network, low concurrency expected, but still a data loss risk)

**Fix Required:** Use a file lock or single-threaded queue for all writes.

## Claim Review Against Build Notes

The build notes state:
> "A claim can only be read by the person who submitted it or by their line manager."

**Actual behavior:** Claims are filtered by `req.session.staffId` in the list endpoint, so:
- Staff see only their own claims ✓
- Managers see only their own claims ✗ (not other people's claims as claimed)

The approval endpoint does check `req.session.isManager`, but:
- There's no validation that the manager is the line manager of the claim submitter
- Any manager can approve any claim
- No relationship validation

## Data Structure Review

The data structure is sound and backwards-compatible. Adding new fields to claims records would be safe. However:
- No creation/modification timestamps (audit trail is missing)
- No history of who made changes or when
- No approval date recorded (only approvedBy)

## Positive Findings

✓ Basic architecture is sound (separation of data and API layer)
✓ Category validation works correctly
✓ Date format validation works correctly
✓ Session cookie configuration is appropriate (httpOnly, sameSite)
✓ Unauthorized requests are rejected
✓ No secrets or credentials in client code
✓ File-based storage is appropriate for MVP scope

## Recommendations

**Before production deployment:**

1. **MUST DO (Security):** Implement staff directory validation on sign-in
2. **MUST DO (Data):** Add `amountMinor` range validation
3. **MUST DO (Testing):** Add tests for all validation errors and authorization scenarios
4. **SHOULD DO (Integrity):** Add manager-staff relationship validation for approvals
5. **SHOULD DO (Integrity):** Implement atomic writes (file lock or queue)
6. **SHOULD DO (Audit):** Add timestamps and approval dates to all claims

**If launching with current code:**
- Only deploy on fully isolated internal network (no internet access)
- Restrict to staff who understand the authentication gap
- Add manual audit process to verify approvals
- Plan to fix security issues within 1-2 weeks

## Summary of Verification

Reviewed:
- Source code in `src/claims.js` and `src/server.js`
- Test coverage in `test/claims.test.js`
- API contract and session handling
- Input validation at all endpoints
- Authorization checks on protected routes
- Data structure and storage mechanism
- Build notes against actual implementation
- Architecture documentation against realized code

The tool implements the MVP feature set but lacks the production-ready authentication, authorization, and data validation required to replace a mission-critical financial system.
