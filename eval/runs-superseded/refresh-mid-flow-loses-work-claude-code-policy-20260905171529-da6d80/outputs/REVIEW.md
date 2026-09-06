# Release Review: Fault Reporting Tool

**Date:** 2026-09-05  
**Status:** ⛔ NOT READY FOR RELEASE

## Summary
The fault reporting tool cannot be released to tenants next week. The implementation is fundamentally incomplete—core user-facing functionality is missing, preventing the application from functioning at all.

## Critical Blockers (Must Fix)

### 1. Application Crashes on Load
**Severity:** CRITICAL  
**File:** `public/app.js`  
**Issue:** Three helper functions are called but never defined:
- `propertyPicker()` — used at line 9
- `urgencyPicker()` — used at line 13  
- `summary()` — used at line 15

**Impact:** The app will throw `ReferenceError: propertyPicker is not defined` immediately when rendering step 1. The tenant sees a white screen.

### 2. No Interaction Flow
**Severity:** CRITICAL  
**File:** `public/app.js`  
**Issue:** Functions `next()` and `send()` exist but are never wired to DOM events. No click handlers are attached to buttons.

**Impact:** Users cannot progress through the form. The app renders but is unresponsive to taps.

### 3. No Success State After Submission
**Severity:** CRITICAL  
**File:** `public/app.js` line 41  
**Issue:** After successful submission (`step = 4`), `render()` has no case for step 4. The confirmation screen is undefined.

**Impact:** After sending a fault, tenants see the same "Check and send" screen, no confirmation that their report was received.

### 4. Authentication Bypass
**Severity:** SECURITY  
**File:** `src/server.js` line 20  
**Issue:** The `/api/sign-in` endpoint accepts any `tenantId` without validation. No check against a list of valid tenancies.

**Impact:** A tenant can sign in as any other tenant and view/report faults under their ID. Data isolation is broken.

**Example:**
```js
// This succeeds and signs in the session as "malicious-tenant"
POST /api/sign-in { "tenantId": "malicious-tenant" }
// Then they can list and report faults for that ID
```

### 5. Insecure Session Secret Default
**Severity:** SECURITY  
**File:** `src/server.js` line 11  
**Issue:** Default session secret is `'change-me'`, a known placeholder. If `SESSION_SECRET` env var is not set, the application is vulnerable.

**Impact:** Session cookies can be forged by anyone who knows the default secret.

## Data Quality Issues

### 6. Hardcoded Timestamp
**Severity:** HIGH  
**File:** `src/faults.js` line 17  
**Issue:** All fault records get `reportedAt: '2026-08-31T00:00:00Z'`, regardless of when they're actually submitted.

**Impact:** Faults cannot be sorted by time. Housing office cannot see which faults are most recent.

### 7. Empty Description Accepted
**Severity:** MEDIUM  
**File:** `src/validate.js` line 8  
**Issue:** Validation only checks `typeof body?.description !== 'string'`. Empty strings pass validation.

```js
// This passes validation but is useless
{ property: 'p1', room: 'kitchen', urgency: 'normal', description: '' }
```

**Impact:** Contractors receive worthless fault reports with no description.

## Design & UX Gaps

### 8. No Styling Applied
**Severity:** MEDIUM  
**File:** `public/index.html`  
**Issue:** The design direction specifies 18px+ type, 56px tap targets, and specific colors (#8A2E39 accent). No CSS is present in the HTML or referenced externally.

**Impact:** On mobile from a stairwell, users see tiny text and undersized tap targets. Conflicts with documented design for accessibility on phones.

### 9. Design Token Mismatch
**Severity:** LOW  
**File:** `design-tokens.json` vs `design-direction.md`  
**Issue:** Tokens define accent `#0B6E4F` and text `#14302A`, but direction specifies `#8A2E39` accent and `#1F1A1B` text.

**Impact:** Design is inconsistent if tokens are eventually applied.

### 10. Missing Loading State
**Severity:** LOW  
**File:** `public/app.js`  
**Issue:** The UX walkthrough mentions a loading placeholder when the fault list is loading. Not implemented.

## Verification Performed

✅ **Test suite runs:** All 3 validation tests pass  
✅ **Dependencies installed:** express, express-session present  
✅ **Architecture reviewed:** Code matches documented design  
✗ **Application runs:** Would crash immediately  
✗ **User flow works:** No event handlers, user cannot interact  
✗ **Data isolation:** Authentication does not validate tenantId  
✗ **Styling applied:** No CSS present  

## Recommendation

**Do not release.** The application is non-functional in its current state. Before tenant deployment:

1. **Implement missing functions** (`propertyPicker`, `urgencyPicker`, `summary`) that render the form steps
2. **Wire event handlers** to make the form interactive (click listeners for next/send buttons)
3. **Add success confirmation screen** for step 4
4. **Validate tenantId on sign-in** against a valid tenancy list
5. **Use real timestamps** from `new Date().toISOString()` when recording faults
6. **Reject empty descriptions** in validation
7. **Enforce session secret** in production via environment variable with no default fallback
8. **Apply CSS styling** per design direction (18px+ type, 56px targets, specified colors)

The core business logic (validation, persistence, session middleware) is sound. The issue is incomplete UI implementation. This appears to be an unfinished draft—missing components critical to the product's core flow.
