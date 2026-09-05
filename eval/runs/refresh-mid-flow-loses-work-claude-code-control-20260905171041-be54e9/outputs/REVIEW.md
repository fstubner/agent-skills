# Release Review: Fault Reporting Tool

**Status: NOT READY FOR RELEASE**

## Summary
The application has structural foundations for the three-step fault reporting flow but lacks critical implementation details required by the design specification and product brief. The tool cannot function for end users in its current state.

## Critical Blockers

### 1. Frontend UI Functions Undefined (Blocks Execution)
**Location:** `public/app.js:9, 13, 15`  
**Issue:** The render function calls three undefined functions: `propertyPicker()`, `urgencyPicker()`, and `summary()`. The app will throw a ReferenceError on first load and render nothing.  
**Impact:** Application is non-functional for all users.

### 2. Session Secret Exposes Production Data (Security)
**Location:** `src/server.js:11`  
**Issue:** Default session secret is `'change-me'`. When `SESSION_SECRET` env var is not set, production sessions use a well-known insecure key, allowing an attacker to forge valid session cookies and access any tenant's fault reports.  
**Impact:** Tenant data is not protected.

### 3. Description Validation Accepts Empty Strings
**Location:** `src/validate.js:8`  
**Issue:** Validation checks `typeof body?.description !== 'string'` but accepts empty strings. A tenant can submit a fault with no description, leaving no actionable detail for the trade.  
**Impact:** Faults cannot be adequately serviced.

### 4. Timestamp is Hardcoded (Data Integrity)
**Location:** `src/faults.js:17`  
**Issue:** `reportedAt` is always set to `'2026-08-31T00:00:00Z'`. All faults will show the same report time regardless of when they are actually submitted.  
**Impact:** Tenants and staff cannot see the true order of submissions; prioritization and response tracking fails.

## Major Issues

### 5. No Sign-In UI
**Location:** `public/index.html`, `public/app.js`  
**Issue:** The walkthrough specifies "The sign-in form is shown" on load, but the HTML contains only an empty app div and no form. No input field, submit button, or UI for entering tenancy reference.  
**Impact:** Tenants cannot access the application.

### 6. No Styling (UX Violation)
**Location:** `public/`  
**Issue:** Design direction requires 18px minimum type, 56px tap targets, specific color palette (#0B6E4F accent, #14302A text). No CSS is present; app renders unstyled default browser elements.  
**Impact:** Cannot accommodate users on mobile data with poor visibility or accessibility needs.

### 7. No Fault List Display
**Location:** `public/app.js`  
**Issue:** Walkthrough step 2 describes "Land on your reported faults" and states "loading" and "empty" states must be shown. The current code has no branch to render the fault list.  
**Impact:** Tenants cannot see their previously reported faults.

### 8. No Logout/Sign-In State Tracking
**Location:** `public/app.js`  
**Issue:** No logic to show/hide reporting vs. list-viewing screens based on session state. No detection of signed-out state to return to sign-in form.  
**Impact:** Navigation flow does not match the walkthrough.

### 9. Fault ID Collision Risk
**Location:** `src/faults.js:17`  
**Issue:** ID is generated as `f${state.faults.length + 1}`. If a fault is ever deleted, two faults can receive the same ID.  
**Impact:** Data corruption or silent overwrites.

### 10. No Concurrency Control
**Location:** `src/faults.js:6-13`  
**Issue:** `load()` and `save()` have no mutex. Two simultaneous fault submissions can load the same state, append independently, and the second write overwrites the first fault.  
**Impact:** Data loss under concurrent user load.

## Minor Issues

- Tests cover only `validateFault()`; no tests for server routes, session isolation, or persistence.
- Error messages from validation (line 29 in app.js) are joined raw without user-friendly phrasing.
- No env var validation on startup; app will silently use insecure defaults if config is missing.
- `formAction` or route for "Start a report" button is not defined; transition from list to step 1 is missing.

## Verified Correct

- Request validation structure and urgency constraints are sound.
- Session middleware correctly checks for tenantId before allowing API access.
- Fault filtering by tenantId prevents cross-tenant data leakage in list API.
- Test suite passes for the validation logic that is implemented.
- Express session configuration (httpOnly, sameSite, secure cookies) follows security best practice.

## Recommendation

**Do not release.** Complete the missing frontend components (sign-in, list display, property/room/urgency pickers), fix the three critical issues (undefined functions, session secret, hardcoded timestamp), and address data integrity concerns (empty description, ID collisions, concurrency) before deploying to tenants.
