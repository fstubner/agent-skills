# Release Review: Report a Fault

**Date:** 2026-09-05  
**Reviewer:** Independent Security & Quality Review

## Summary
The fault reporting tool is **NOT READY for production release**. Three critical issues must be resolved before going live.

---

## Critical Issues (Block Release)

### 1. Missing Frontend Functions (BLOCKS FUNCTIONALITY)
**Severity:** CRITICAL  
**File:** `public/app.js` lines 9, 13, 15  
**Issue:** The application calls `propertyPicker()`, `urgencyPicker()`, and `summary()` functions that are never defined. This causes runtime crashes when users try to report a fault.

**Impact:** The entire report flow is broken. Users will see JavaScript errors instead of the fault reporting form.

**Required Fix:** Implement the three missing functions with UI controls matching the design direction (18px type, 56px tap targets, large and forgiving layout).

---

### 2. Hardcoded Timestamp in Fault Reports (DATA INTEGRITY)
**Severity:** CRITICAL  
**File:** `src/faults.js` line 17  
**Issue:** `reportedAt` is hardcoded to `'2026-08-31T00:00:00Z'` instead of using the current timestamp. All faults will appear to have been reported on the same fixed date.

**Impact:** Housing office cannot track when faults were actually reported. Audit trail is meaningless. SLA tracking is impossible.

**Required Fix:** Use `new Date().toISOString()` to capture the actual report time.

---

### 3. Missing Sign-in Logic (SECURITY & UX)
**Severity:** CRITICAL  
**File:** `public/app.js` lines 1-45 and related  
**Issue:** The application has no sign-in form. The backend expects `req.session.tenantId` after `/api/sign-in`, but the frontend never makes that call. There's no UI to capture the tenancy reference or send it to the server.

**Impact:** Users cannot sign in. The entire application is non-functional. Sessions are not established, so all `/api/` endpoints return 401.

**Required Fix:** Implement a sign-in screen that captures the tenancy reference and POSTs to `/api/sign-in` before showing the fault list or report flow. Return to this screen on sign-out.

---

## Medium Issues (Resolve Before Release)

### 4. Weak Default Session Secret
**Severity:** MEDIUM  
**File:** `src/server.js` line 11  
**Issue:** Session secret defaults to `'change-me'` when `SESSION_SECRET` env var is not set. This is insecure in production.

**Recommendation:** Require an explicit environment variable and fail at startup if not provided. Document in deployment guide.

---

### 5. Property and Room Not Validated
**Severity:** MEDIUM  
**File:** `src/validate.js` lines 5-6  
**Issue:** Property and room fields are only checked for existence (truthy), not validated against a known list. Users can submit any string values.

**Recommendation:** Add a list of valid properties and rooms, validate against it. Consider fetching from a config file or hardcoding if the list is small and stable.

---

### 6. Description Length Not Limited
**Severity:** MEDIUM  
**File:** `src/validate.js` line 8  
**Issue:** Description is only checked to be a string, with no length limits. Users could submit enormous descriptions or malicious payloads.

**Recommendation:** Add maximum length validation (suggest 1000 characters for a phone-based form).

---

### 7. XSS Risk in Error Display
**Severity:** MEDIUM  
**File:** `public/app.js` line 38  
**Issue:** Error messages are inserted using `insertAdjacentHTML()`. While errors come from the server, if the server echoes user input in error messages without escaping, XSS is possible.

**Status:** Low risk currently (errors are simple strings like "choose a property"), but fragile.

**Recommendation:** Use `textContent` instead of `insertAdjacentHTML` for error display, or sanitize server responses.

---

## Low Issues (Nice to Have)

### 8. No Rate Limiting
The API has no rate limiting. A malicious actor could spam fault submissions. Consider adding basic rate limiting middleware for production.

### 9. No No-Cache Headers
Consider adding cache-control headers to prevent browsers from caching sensitive pages (though sessions help here).

### 10. Color Contrast Discrepancy
**File:** `design-tokens.json` vs `design-direction.md`  
The tokens define accent as `#0B6E4F`, but the design direction specifies `#8A2E39`. Clarify which is correct and ensure accessibility (text on background should meet WCAG AA contrast ratio).

---

## Testing Notes

### Tests Pass ✓
The validation logic tests in `test/validate.test.js` all pass, confirming the core validation functions work correctly for basic cases.

### Manual Testing Blocked
The three critical UI issues prevent end-to-end testing. Once those are fixed, verify:
1. Sign-in with a tenancy reference
2. Navigate through all three report steps without losing entered data
3. Submit a valid fault and see it appear in the list
4. Submit an invalid fault and confirm error is retained with resubmission possible
5. Sign out and confirm return to sign-in screen

---

## Deployment Requirements

When issues are resolved:
1. Set `SESSION_SECRET` environment variable to a strong random value
2. Ensure `secure: true` on cookies only works over HTTPS
3. Define the list of valid properties and rooms
4. Document API endpoints and session handling for the housing office team

---

## Release Verdict

**REJECTED — Do not deploy next week.**

**Blockers:**  
1. Missing frontend functions (propertyPicker, urgencyPicker, summary)
2. Hardcoded timestamp breaks audit trail
3. No sign-in UI makes app unusable

**Timeline:** After resolving these three issues and re-testing, estimated for release within 2-3 days of engineering effort.
