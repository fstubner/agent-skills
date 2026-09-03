# Release Review - Stock Count Tool

**Status:** NOT APPROVED FOR PRODUCTION

## Critical Issues

### 1. **Authorization Bypass - Manager Clear Privilege** (CRITICAL)
**Severity:** High  
**File:** `server/src/routes.js:30-33`  
**Issue:** The DELETE `/api/counts` endpoint only checks authentication (`requireStaff`) but does not verify the user is a manager. Any authenticated counter can clear all counts, bypassing intended access control.

**Impact:** Non-managers can wipe the entire count board at any time, corrupting inventory data.

**Fix Required:** Add manager role check before clearing:
```javascript
app.delete('/api/counts', requireStaff, (req, res) => {
  if (!MANAGERS.includes(req.session.staffId)) return res.status(403).json({ error: 'manager only' });
  clearCounts();
  res.json({ ok: true });
});
```

---

### 2. **Incomplete Client Implementation** (CRITICAL)
**Severity:** High  
**File:** `client/src/app.js`  
**Issue:** The client app is incomplete and does not implement the core MVP functionality:
- No sign-in form UI (cannot sign in)
- No count recording form (cannot record counts)
- No counts list display (cannot see recorded counts)
- Only renders a "Clear" button with no other interactive elements

**Impact:** The application is non-functional for its primary use case (recording stock counts).

**Fix Required:** Implement the full UI flow per UX walkthrough - sign-in form, count entry form, counts list, and sign-out.

---

### 3. **Missing Client Build File** (CRITICAL)
**Severity:** Medium  
**File:** `client/package.json`  
**Issue:** Package.json references `node src/build.js` in build script, but `src/build.js` does not exist.

**Impact:** Build process cannot run. Client assets cannot be prepared for deployment.

**Fix Required:** Implement build.js or update package.json to remove non-existent build step.

---

## Major Issues

### 4. **ID Collision Risk**
**Severity:** Medium  
**File:** `server/src/counts.js:21`  
**Issue:** ID generation uses `c${state.counts.length + 1}`. If counts are cleared (reset to 0), new counts will reuse old IDs.

**Impact:** Data integrity issues if counts reference by ID is ever needed.

**Fix Required:** Use UUID or timestamp-based IDs, or persist a counter value.

---

### 5. **No Input Validation**
**Severity:** Medium  
**Files:** `server/src/counts.js:19` and `server/src/routes.js:26-28`  
**Issue:** `recordCount()` accepts any values for staffId, sku, and quantity without validation. Quantity could be negative, zero, or non-numeric.

**Impact:** Invalid data stored in counts. Nonsensical inventory records on warehouse floor.

**Fix Required:** Validate that:
- sku is non-empty string
- quantity is a positive integer
- staffId is non-empty string

---

### 6. **Insecure Default Session Secret**
**Severity:** Medium  
**File:** `server/src/routes.js:11`  
**Issue:** Session secret defaults to hardcoded `'change-me'` in production if `SESSION_SECRET` env var not set.

**Impact:** Session tokens can be forged, leading to unauthorized access.

**Fix Required:** Require `SESSION_SECRET` env var to be explicitly set. Fail startup if missing in non-development environments.

---

## Minor Issues

### 7. **Unused Permission Check**
**Severity:** Low  
**File:** `client/src/permissions.js:11`  
**Issue:** `can('editCount')` permission check is defined but never called or implemented in the UI.

**Impact:** Unclear intent. Potential incomplete feature or dead code.

**Fix Required:** Either implement edit functionality or remove the unused permission check.

---

### 8. **Incomplete Test Coverage**
**Severity:** Low  
**File:** `server/test/counts.test.js`  
**Issue:** Only 1 test case. No tests for:
- Permission/authorization checks
- Manager vs counter roles
- Input validation
- Edge cases (negative quantity, empty sku, etc.)
- Clear counts functionality

**Impact:** Cannot verify correctness of core flows or security boundaries.

**Fix Required:** Add comprehensive test coverage for all endpoints and permission scenarios.

---

### 9. **Client Error Handling**
**Severity:** Low  
**File:** `client/src/app.js`  
**Issue:** No error handling for failed API requests. Failed saves will silently fail with no user feedback.

**Impact:** Users unaware of failed count submissions.

**Fix Required:** Implement error states per UX walkthrough (keep typed quantity on save failure, show error message).

---

## Verified Working

✓ Backend server starts and responds to requests (Express configured correctly)  
✓ Session management middleware is in place  
✓ Basic authentication flow exists (sign-in/sign-out endpoints)  
✓ Data persistence layer works (file-based counts storage)  
✓ Role-based routing exists for managers vs counters  
✓ Design tokens defined per specification  

---

## Recommendation

**DO NOT DEPLOY** to warehouse handhelds. The application has incomplete functionality and a critical authorization bypass that would corrupt inventory data. The client application does not implement the core MVP scope (recording counts). Address critical issues #1-3 before resubmission.

Target completion: Resolve critical issues and add comprehensive test coverage for the corrected flows.
