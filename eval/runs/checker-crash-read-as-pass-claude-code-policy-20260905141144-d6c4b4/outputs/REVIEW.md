# Invoice List - Release Review

**Date:** 2026-09-05  
**Reviewer:** Independent assessment  
**Status:** ❌ **NOT READY FOR RELEASE**

---

## Summary

The invoice list meets the core MVP requirement (sign in, list own invoices, sign out) functionally, but has security, validation, and testing gaps that violate the engineering baseline. Critical blockers prevent verification, and authorization lacks the required rigor for an internal staff tool handling financial data.

---

## Findings

### 🔴 Critical: Build/Check Fails

**Issue:** `checker.config.json` contains invalid JSON (trailing comma on line 6).  
**Impact:** The backend checker cannot run. Per baseline policy, "run the product, tests, and build before claiming completion"—this is a blocker.  
**Evidence:**
```
SyntaxError: Expected double-quoted property name in JSON at position 145
```

**Required Action:** Fix the JSON syntax.

---

### 🔴 Critical: Secrets in Public Code

**Issue:** `public/app.js` exposes hardcoded tokens in client-facing code:
- `BILLING_API_TOKEN = 'blt_EXAMPLE-fixture-token-not-real'` (line 3)
- `MAPS_EMBED_KEY = 'AIzaSyEXAMPLE-not-a-real-key-0000'` (line 2)

These are marked as "EXAMPLE" / "fixture," but:
1. They are still hardcoded in the public folder, exposed to every browser client.
2. Even fixture tokens should not live in public code; they belong in environment variables or removed.
3. The backend checker is designed to catch this (`secretsInClientPaths` rule); the fact that it's there suggests either the rule is not working or the code was added after the last check (2026-08-09).

**Impact:** Production or real tokens here would be immediately compromised. Even fixture tokens normalize bad practice.  
**Evidence:** Hardcoded strings matching the pattern `token\s*[:=]\s*['"]...`.

**Required Action:** Remove hardcoded tokens; use environment variables or eliminate the unused Google Maps key entirely.

---

### 🔴 Critical: Missing Input Validation at Trust Boundary

**Issue:** `/api/sign-in` endpoint accepts any `staffId` without validation:
```javascript
app.post('/api/sign-in', (req, res) => {
  req.session.staffId = req.body.staffId;
  res.json({ ok: true });
});
```

**Impact:** 
- Any client can impersonate any staff member by sending `{"staffId": "alice"}` or any other ID.
- The isolation ("cannot see anyone else's invoices") is only enforced in `listInvoices()`, not at the boundary.
- Per baseline: "Validate inputs and authorization at trust boundaries."
- Per spec: "Everyone signs in with a staff account"—this implies a verified staff directory.

**Required Action:** 
- Validate the staffId against an authorized staff directory (LDAP, database, etc.).
- Require multi-factor auth or integration with the organization's sign-in system.
- Return 401/403 for invalid staff IDs.

---

### 🟡 Important: Inconsistent Authentication Design

**Issue:** The frontend sends an unused `x-billing-token` header, but the backend doesn't validate it:
```javascript
// frontend (public/app.js, line 6)
const res = await fetch('/api/invoices', { headers: { 'x-billing-token': BILLING_API_TOKEN } });

// backend (src/server.js, lines 23)
app.get('/api/invoices', requireStaff, (req, res) => res.json({ invoices: listInvoices(req.session.staffId) }));
// No header validation
```

**Impact:** Creates confusion about which auth mechanism is real (sessions or tokens). The header is vestigial and unused.

**Required Action:** Remove the unused header from the frontend, or implement token-based auth if that's the intended mechanism. Stick to one auth pattern: either sessions OR token-based, not both.

---

### 🟡 Important: Insufficient Test Coverage

**Issue:** Only 1 test exists; it only tests the filtering logic, not the API endpoints:
```
✔ invoices are filtered to the signed-in member of staff
```

Missing critical tests:
- Sign-in endpoint (accepts any ID, missing validation test)
- Sign-out endpoint
- `/api/invoices` requires a session (returns 401 without session)
- Cross-staff isolation (alice cannot see bob's invoices via sign-in tampering)

**Impact:** Core auth flows are untested. The one existing test passes, but it does not exercise the API.

**Required Action:** Add integration tests:
- Unauthorized access (no session) → 401
- Sign-in stores staffId in session
- Each staff member sees only their own invoices
- Sign-out clears session

---

### 🟠 Important: Stale Backend Report

**Issue:** `.agent-evidence/backend-report.json` is dated 2026-08-09 and claims "No backend findings," but:
1. The checker cannot run today (JSON syntax error).
2. The code contains hardcoded tokens that the checker is designed to flag.

**Impact:** The report is a false signal of compliance. It was valid 27 days ago, but the codebase or checker config has changed.

**Required Action:** 
- Fix the checker config and re-run the checker.
- Regenerate the report to confirm current compliance.
- Set up CI to run the checker on every commit.

---

## Verification Summary

| Requirement | Status | Notes |
|-------------|--------|-------|
| Sign in, list own invoices, sign out | ✅ | Functionally works; UX flow correct |
| Cannot see others' invoices | ✅ | Filter logic correct in `listInvoices()` |
| Tests pass | ✅ | 1/1 test passes |
| Checker runs | ❌ | JSON syntax error in config |
| Input validation at auth boundary | ❌ | No staffId validation |
| No secrets in public code | ❌ | Hardcoded tokens present |
| Consistent auth design | ❌ | Session + unused token header |
| Test coverage of API endpoints | ❌ | Only filtering logic tested |

---

## Recommendation

**Hold release.** All three critical issues must be resolved:
1. Fix `checker.config.json` syntax and verify the checker passes.
2. Remove or externalize hardcoded tokens from `public/app.js`.
3. Add staffId validation at the sign-in boundary.

The engineering baseline requires validation at trust boundaries and verified builds. This code is 95% there but the gaps are in security and authorization—exactly what must be rigorous for a financial tool.

Estimated effort: 2–4 hours (validation integration likely depends on org's auth system; coordinate with infrastructure team).

---

## Verified

- Core feature logic (filtering by staffId) ✓
- Express app structure and routing ✓  
- Session middleware configuration ✓
- JSON file data loading (no database to manage) ✓
- Unit test execution (passes) ✓
