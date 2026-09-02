# Release Review: Expenses Claims Tool

**Date:** 2026-09-02  
**Reviewer:** Independent code review  
**Verdict:** ⚠️ **NOT PRODUCTION-READY** — Critical authorization and data validation gaps must be resolved before replacing spreadsheet on Monday.

## Summary
The tool implements the MVP scope (submit, list, approve, sign out) and has basic API structure, but has **five critical issues** that disqualify it from production use:

1. No authentication on sign-in
2. No authorization enforcement for approvals
3. Missing input validation (amount)
4. Race condition on claim IDs
5. Session secret defaults to insecure value

## Critical Issues

### 1. No Authentication (Security Blocker)
**src/server.js:19-22**  
The sign-in endpoint accepts any `staffId` and `isManager` flag from the request body with zero verification:
```
app.post('/api/sign-in', (req, res) => {
  req.session.staffId = req.body.staffId;
  req.session.isManager = Boolean(req.body.isManager);
  res.json({ ok: true });
});
```
**Risk:** Any user can impersonate any staff member or claim manager status. A staff member could sign in as their manager and approve their own claims.

**Required fix:** Implement real authentication (LDAP/Active Directory integration, password validation, or trusted proxy header for internal network).

---

### 2. No Authorization Check on Approval (Security Blocker)
**src/server.js:33-37**  
The approval endpoint only checks if the session has `isManager` set, which was just set by the sign-in endpoint without verification. No check that:
- The manager is actually authorized to approve claims from the claiming staff member
- The manager is the direct supervisor
- The manager is in the right department

**Risk:** Any staff member can set `isManager=true` in sign-in, then approve claims (own or others').

**Required fix:** Implement manager hierarchy/team mapping. Validate that only the correct manager can approve.

---

### 3. Missing Amount Validation (Data Integrity)
**src/server.js:25-28 & src/claims.js:20**  
The `amountMinor` field is accepted without any validation:
```javascript
if (!CATEGORIES.includes(req.body.category)) return res.status(400).json({ error: 'unknown category' });
if (!/^\d{4}-\d{2}-\d{2}$/.test(req.body.spentOn ?? '')) return res.status(400).json({ error: 'bad date' });
return res.json(submit(req.session.staffId, req.body));
```

**Risk:** 
- Can submit negative amounts (negative reimbursements?)
- Can submit non-numeric values (strings, null, undefined)
- Can submit extremely large numbers
- Corrupts financial data

**Test case:** `POST /api/claims` with `amountMinor: "negative" or -10000 or null` → accepted.

**Required fix:** Add validation:
```javascript
if (typeof req.body.amountMinor !== 'number' || req.body.amountMinor <= 0 || req.body.amountMinor > 1000000)
  return res.status(400).json({ error: 'invalid amount' });
```

---

### 4. Race Condition on Claim ID Generation (Data Integrity)
**src/claims.js:6-14, 17-18**  
ID generation is based on array length without serialization:
```javascript
function load() { ... }
// ← Another process can write here
function save(state) { ... }

export function submit(staffId, claim) {
  const state = load();
  const record = { id: `c${state.claims.length + 1}`, ... };
```

**Risk:** If two claims are submitted concurrently:
1. Process A loads, sees 5 claims, generates ID `c6`
2. Process B loads, sees 5 claims, generates ID `c6`
3. Both save → one claim overwrites the other

**Impact:** Lost claims, data corruption.

**Required fix:** Add file-level locking or switch to a database. For internal network with "few hundred claims/year", UUID or timestamp-based IDs would be simpler:
```javascript
const record = { id: `c${Date.now()}-${Math.random()}`, ... };
```

---

### 5. Session Secret Defaults to Insecure Value (Security Blocker)
**src/server.js:10-15**  
```javascript
secret: process.env.SESSION_SECRET ?? 'change-me',
```

**Risk:** If `SESSION_SECRET` is not set, sessions are signed with the hardcoded string 'change-me', making session forgery trivial.

**Required fix:** Require `SESSION_SECRET` environment variable; fail at startup if not set:
```javascript
const secret = process.env.SESSION_SECRET;
if (!secret) throw new Error('SESSION_SECRET environment variable is required');
```

---

## Secondary Issues

### Missing Tests
- No test for approval endpoint
- No test for invalid amount
- No test for non-manager attempting approval
- No test for concurrent submissions

**Impact:** Errors in the high-risk paths (approval, validation) are not caught.

### Missing Date Validation
- Regex validates format `YYYY-MM-DD` but not that the date is valid (e.g., `2026-13-32` passes)

### Missing Category Propagation
- Category list is hardcoded in server.js but not exported to client; client would need to hardcode it too or fetch it

---

## What Works
- ✅ Basic endpoint structure (sign-in, submit, list, approve, sign-out)
- ✅ Session cookie hardened (`httpOnly: true, sameSite: 'lax, secure: true`)
- ✅ Claims listing correctly filtered to signed-in staff member
- ✅ Date format validated with regex
- ✅ Category whitelist enforced

---

## Recommendation
**Do not deploy on Monday.** The authentication and authorization gaps are showstoppers for replacing a real business process. 

**Minimal fix path (estimated 2-3 days):**
1. Add real authentication (integrate with company LDAP or implement password storage)
2. Add manager/staff hierarchy mapping, validate approval authorization
3. Add amountMinor validation (range check, type check)
4. Add approval test case
5. Replace ID generation with timestamp-based or UUID (eliminates race condition)
6. Require SESSION_SECRET via environment variable

**For the interim:** Keep the spreadsheet in use. This tool can go live as a pilot/feedback tool only after the above fixes.

---

**Verified:**
- Code structure and dependencies (Express, express-session)
- API endpoints present and callable
- Session cookie configuration
- Input validation on category and date
- Claims storage and filtering logic
- Authorization checks in place (but not functional due to lack of authentication)
