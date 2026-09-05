# Stock Count Tool - Release Review

**Date:** 2026-09-05  
**Verdict:** ❌ **NOT READY FOR RELEASE**

## Summary
The stock count tool has critical missing functionality and security gaps that prevent deployment to warehouse handhelds. The core feature—recording stock counts—is not implemented, and there are unmitigated server-side authorization vulnerabilities.

## Critical Issues (Must Fix)

### 1. Client App Incomplete - Missing Core Recording Feature
**File:** `client/src/app.js`  
**Severity:** BLOCKING  
The app only implements sign-in and clear functionality. The walkthrough specifies "Record a count: SKU and quantity" as the primary job, but:
- No form or input fields for SKU entry
- No quantity input field
- No list rendering to display recorded counts
- No sign-out UI
- Only renders a heading and clear button

The walkthrough also specifies three required states (Empty, Error, Loading) that have no implementation.

**Impact:** Users cannot perform the main task of the tool.

### 2. Missing HTML Root File
**Severity:** BLOCKING  
The client JavaScript references `document.getElementById('app')` but there is no `index.html` or public HTML file to bootstrap the application. The app will not run in a browser.

### 3. Missing Build Process
**File:** `client/package.json` references `src/build.js`  
**Severity:** HIGH  
The build script is referenced but does not exist. This breaks the client build pipeline needed for deployment to handhelds.

### 4. Missing Server-Side Authorization on Clear
**File:** `server/src/routes.js`, line 30-33  
**Severity:** CRITICAL SECURITY  
The `DELETE /api/counts` endpoint lacks server-side authorization. Only the client checks the manager role; an authenticated non-manager can directly call the endpoint and clear all counts:
```javascript
app.delete('/api/counts', requireStaff, (req, res) => {
  clearCounts();  // No role check
  res.json({ ok: true });
});
```
**Fix required:** Add `if (!MANAGERS.includes(req.session.staffId)) return res.status(403).json({ error: 'forbidden' });`

### 5. Unsafe Default Session Secret
**File:** `server/src/routes.js`, line 11  
**Severity:** CRITICAL SECURITY  
The session secret defaults to `'change-me'`, a hardcoded placeholder. This must be required in production.
```javascript
secret: process.env.SESSION_SECRET ?? 'change-me',
```
**Fix required:** Remove the default fallback; throw an error if SESSION_SECRET is not set.

## High-Priority Issues (Should Fix Before Release)

### 6. No Input Validation
**File:** `server/src/routes.js`, line 26-27  
The recordCount endpoint accepts any value for SKU and quantity without validation:
```javascript
app.post('/api/counts', requireStaff, (req, res) => {
  res.json(recordCount(req.session.staffId, req.body.sku, req.body.quantity));
});
```
- SKU should be non-empty and conform to warehouse format
- Quantity should be a positive integer

### 7. No Error Handling in Client
**File:** `client/src/app.js`, line 26  
The clearCounts function ignores fetch errors. If the network call fails, render() still executes, creating an inconsistent UI state.

### 8. Insufficient Test Coverage
**File:** `server/test/counts.test.js`  
Only one test exists for the core data layer. No tests for:
- API routes (sign-in, recording, listing, clearing)
- Authorization enforcement
- Error cases
- Session handling

## Medium-Priority Issues (Recommended Fixes)

### 9. Design Constraints Not Implemented
**File:** `design-tokens.json`, `design-direction.md`  
The design specifies warehouse floor ergonomics (64px tap targets, 20px minimum font, high-contrast #14506B accent) but:
- No CSS file exists
- design-tokens.json colors are defined but not applied
- No responsive layout for handheld terminals

### 10. No Confirmation on Destructive Action
The "Clear all counts" operation permanently removes all data for a cycle, but there is no confirmation dialog. A manager could accidentally trigger this with a stray tap on a handheld.

## Checklist Against Specification

| Requirement | Status | Notes |
|---|---|---|
| Sign in | ⚠️ Partial | Route exists, no UI |
| Record a count | ❌ Missing | Core feature not implemented |
| List counts | ❌ Missing | No list rendering |
| Clear all counts (manager) | ⚠️ Partial | Route works, no auth check |
| Sign out | ❌ Missing | No UI |
| Large targets (64px) | ❌ Missing | No CSS |
| High contrast (#14506B) | ❌ Missing | No CSS |
| Min 20px font | ❌ Missing | No CSS |
| Node 18+ compatible | ✅ Yes | Dependencies support this |

## Verified Working

- **Server startup:** Routes file exports correctly
- **Session management:** Session middleware configured with security headers (httpOnly, sameSite, secure)
- **Database persistence:** JSON file storage with load/save mechanism
- **Role distinction:** MANAGERS array and basic permission check in permissions.js
- **Test runner:** Node test setup is functional

## Recommendations

**Before deployment:**
1. Complete `client/src/app.js` with full UI: sign-in form, count recording form, list display, sign-out button
2. Create `client/public/index.html` with app root element
3. Create `client/src/build.js` build script
4. Add server-side authorization to DELETE endpoint
5. Remove insecure SESSION_SECRET default
6. Add input validation to recordCount endpoint
7. Implement CSS with design tokens for handheld ergonomics
8. Add error handling and user feedback in client

**After those fixes:**
1. Expand test coverage to routes and client scenarios
2. Add confirmation dialog for clear action
3. Implement graceful error states per walkthrough spec

---

**Next step:** Reject deployment request until critical issues are resolved.
