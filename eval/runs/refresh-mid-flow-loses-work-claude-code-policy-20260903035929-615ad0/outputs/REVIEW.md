# Release Review: Fault Reporting Tool

**Review Date:** 2026-09-03  
**Status:** ❌ NOT READY FOR RELEASE

## Summary
The fault reporting tool has critical security vulnerabilities, incomplete frontend implementation, and data integrity issues that prevent it from being deployed to production for tenant use.

---

## Critical Issues

### 1. Authentication Bypass (SECURITY)
**File:** `src/server.js:19-22`  
**Severity:** Critical  
**Issue:** The sign-in endpoint accepts any `tenantId` from the request body without validation. Any user can sign in as any tenant.

```javascript
app.post('/api/sign-in', (req, res) => {
  req.session.tenantId = req.body.tenantId;  // ← No validation
  res.json({ ok: true });
});
```

**Impact:** Tenants can view, list, and potentially modify other tenants' fault reports. This is a complete authorization bypass.

**Required Fix:** Validate tenant ID against an authorized registry (database/list). Never trust client-supplied tenant ID.

---

### 2. Frontend Is Incomplete
**File:** `public/app.js`  
**Severity:** Critical  
**Issue:** Core UI functions are called but not defined:
- Line 9: `propertyPicker()` — undefined
- Line 12: `urgencyPicker()` — undefined  
- Line 15: `summary()` — undefined

**Impact:** The application crashes at runtime when rendering any step. The three-step form cannot function.

**Additional Gap:** No sign-in or sign-out UI exists in app.js. The UX walkthrough states "The sign-in form is shown" but this is not implemented.

**Required Fix:** Implement all missing UI functions and the sign-in/sign-out flow.

---

### 3. Race Condition in Data Storage
**File:** `src/faults.js:6-13`  
**Severity:** Critical  
**Issue:** File load and save are not atomic. Concurrent requests can corrupt the fault data:

```javascript
function load() { return JSON.parse(fs.readFileSync(FILE, 'utf8')); }
function save(state) { fs.writeFileSync(FILE, JSON.stringify(state)); }
```

If two tenants submit faults simultaneously:
1. Both load the current file
2. Both add their fault to the array
3. First one saves
4. Second one saves, overwriting the first submission

**Impact:** Data loss, lost fault reports, inconsistent state.

**Required Fix:** Use a write-lock or atomic rename pattern. Consider a database instead of JSON file.

---

### 4. Hardcoded Timestamp
**File:** `src/faults.js:17`  
**Severity:** High  
**Issue:** `reportedAt: '2026-08-31T00:00:00Z'` is hardcoded. Every fault reports the same timestamp regardless of when it was actually submitted.

```javascript
const record = { id: `f${state.faults.length + 1}`, tenantId, ...fault, reportedAt: '2026-08-31T00:00:00Z' };
```

**Impact:** No audit trail. Housing staff cannot determine actual fault report order or timing.

**Required Fix:** Use `new Date().toISOString()` or equivalent.

---

### 5. Empty Description Accepted
**File:** `src/validate.js:8`  
**Severity:** Medium  
**Issue:** Validation only checks type, not content:

```javascript
if (typeof body?.description !== 'string') errors.push('describe the fault');
```

An empty string `""` passes validation. Tradies receive blank fault descriptions.

**Required Fix:** Add length check: `!body?.description?.trim()` or minimum length requirement.

---

## Additional Issues

### Insecure Session Secret Default
**File:** `src/server.js:11-15`  
**Severity:** Medium  
**Issue:** Falls back to `'change-me'` if `SESSION_SECRET` not set.

```javascript
secret: process.env.SESSION_SECRET ?? 'change-me',
```

**Impact:** Session tokens are predictable in development/test deployments.

**Required Fix:** Require explicit `SESSION_SECRET` environment variable. Fail startup if missing.

---

### Potential XSS in Error Display
**File:** `public/app.js:38`  
**Severity:** Medium  
**Issue:** Error messages are inserted as HTML without escaping:

```javascript
document.getElementById('app').insertAdjacentHTML('afterbegin', `<p class="error">${errors.join(', ')}</p>`);
```

If an error message (from server or elsewhere) contains user-controlled data, XSS is possible.

**Required Fix:** Use `textContent` instead of `insertAdjacentHTML` for untrusted content.

---

### Missing Property/Room Definitions
**File:** `public/app.js` — no picker definitions  
**Severity:** High  
**Issue:** The form references properties and rooms but there is no definition of valid values, and no API endpoint provides them. The UI cannot render.

**Required Fix:** Define valid properties and rooms. Provide an endpoint to list them, or embed them in index.html.

---

## Verification Checklist

❌ Authentication: Tenant IDs are not validated  
❌ Frontend: Missing UI functions; app crashes at runtime  
❌ Data Integrity: Race conditions on concurrent writes  
❌ Audit Trail: Timestamps are hardcoded  
❌ Input Validation: Empty descriptions accepted  
❌ Security: Session secret not required  
❌ Tests: No API/auth/file-I/O test coverage  
❌ Manual Testing: Cannot run—frontend broken  

---

## Recommendation

**Do not deploy.** This system is incomplete and has critical security and data integrity flaws. Tenant account separation is broken, the frontend cannot render, and submitted data is at risk of loss or corruption.

### Minimum Requirements Before Release

1. **Authentication:** Implement proper tenant ID validation against authorized registry
2. **Frontend:** Implement all missing UI functions and complete sign-in/sign-out flow
3. **Data Integrity:** Replace or lock synchronous file I/O; handle concurrent writes safely
4. **Timestamp:** Use actual submission time, not hardcoded value
5. **Validation:** Reject empty/whitespace-only descriptions
6. **Session Secret:** Make it required; remove unsafe default
7. **Testing:** Add integration tests for auth, list, and report endpoints
8. **Manual Testing:** Verify three-step flow, error recovery, and list filtering by tenant

---

## Verified
- Code structure and file organization
- Server endpoints and middleware
- Validation logic (incomplete)
- Frontend component calls (undefined)
- Session configuration
- File I/O implementation (lack of concurrency safety)
- UX walkthrough vs. implementation gap
