# Release Verdict: **REJECT**

**Date:** 2026-09-05  
**Reviewer:** Independent Code Review  
**Product:** Stock Count Tool (Warehouse Handheld)  

---

## Summary
The stock count tool is **NOT ready for warehouse deployment**. Multiple critical issues prevent the MVP from meeting functional and security requirements. The product must be remediated before handhelds can be loaded.

---

## Critical Issues

### 1. **Authorization Bypass: Counters Can Clear All Counts (SECURITY)**
**Severity:** CRITICAL  
**File:** `server/src/routes.js:30-33`  

The DELETE endpoint allows any authenticated staff member to clear all counts, not just managers. The requirement states only managers can clear counts at cycle end.

```javascript
app.delete('/api/counts', requireStaff, (req, res) => {
  clearCounts();  // ❌ No manager check
  res.json({ ok: true });
});
```

**Impact:** Counters can destroy an entire count cycle's data. Violates core business rule. Data integrity compromised.

**Remediation:** Add manager role check before clearCounts():
```javascript
if (!MANAGERS.includes(req.session.staffId)) return res.status(403).json({ error: 'unauthorized' });
```

---

### 2. **Client Application Incomplete (FUNCTIONAL)**
**Severity:** CRITICAL  
**File:** `client/src/app.js`  

The client implements only ~5% of required functionality. MVP requirements state "A counter can record a quantity against a SKU" but no such interface exists.

**Missing:**
- **Record form:** No SKU input field, quantity input, or submit button
- **Count list:** No display of recorded counts (required by walkthrough step 2)
- **Loading state:** Documented in ux-walkthrough.md but absent
- **Error state:** Documented in ux-walkthrough.md but absent  
- **Sign-out:** Required by MVP scope but no UI element

**Impact:** Counters cannot perform their primary job. Product is non-functional for the warehouse floor.

**Current output:** Just `<h1>Stock count</h1>` + a clear button. Not enough for any workflow.

---

### 3. **Missing Build Script (DEPLOYMENT)**
**Severity:** HIGH  
**File:** `client/package.json`  

The build script is referenced but does not exist:
```json
"scripts": { "build": "node src/build.js" }
```

File `src/build.js` is missing. No way to bundle/build the client for deployment to handhelds.

**Impact:** Cannot deploy to handheld terminals.

---

### 4. **Weak Session Secret Default (SECURITY)**
**Severity:** MEDIUM  
**File:** `server/src/routes.js:11`  

```javascript
secret: process.env.SESSION_SECRET ?? 'change-me',
```

Default 'change-me' is trivially guessable. If deployed without setting SESSION_SECRET env var, sessions are vulnerable to forgery.

**Remediation:** Require SESSION_SECRET in production. Throw error if NODE_ENV === 'production' and secret is default.

---

### 5. **Misplaced Security Reasoning (CODE QUALITY)**
**Severity:** MEDIUM  
**File:** `client/src/app.js:25`  

Comment states: "Only shown to managers, so no further check is needed."

This reflects a fundamental security misunderstanding. Client-side checks (button visibility) are **not** security controls. Server must always validate.

**Impact:** Indicates developers may not fully understand auth architecture. Risk of future security holes.

---

## Additional Concerns

### Test Coverage Insufficient
- Only 1 test exists (recordCount happy path)
- No API endpoint tests
- No authorization tests
- No clear/list functionality tests

**Recommended:** Add tests for:
- clearCounts only works for managers
- recordCount must be authenticated
- recordCount stores staffId correctly
- listCounts returns all recorded counts

---

### Missing Documentation
- No API endpoint documentation
- No deployment guide for handheld terminals
- No environment variable setup instructions
- No error handling strategy documented

---

## Verification Checklist

**Requirements vs. Implementation:**

| Requirement | Status | Notes |
|---|---|---|
| Sign in | ✅ Partial | API works, no UI to input staffId |
| Record a count | ❌ Missing | API exists but no client form |
| List counts | ❌ Missing | API exists but not displayed |
| Clear counts (manager only) | ⚠️ Broken | API lacks auth check—anyone can clear |
| Sign out | ❌ Missing | No UI element |
| Handheld deployment | ❌ Blocked | No build script |

---

## Recommendation

**HOLD for Production.** Return to engineering for:

1. **Add manager authorization check** to DELETE /api/counts (1 hour)
2. **Implement client form and list UI** (4-6 hours)  
3. **Create build.js script** (1-2 hours)
4. **Harden session secret** in production mode (30 min)
5. **Add authorization tests** to test suite (2 hours)

Post-fixes, conduct full workflow test on handheld simulator before warehouse deployment.

---

**Status:** ❌ **NOT APPROVED FOR DEPLOYMENT**
