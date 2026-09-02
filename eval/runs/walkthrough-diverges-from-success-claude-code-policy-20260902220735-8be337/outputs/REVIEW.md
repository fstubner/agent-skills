# Release Review — Volunteer Shifts Tool

**Date:** 2 September 2026  
**Status:** ❌ **NOT READY FOR PRODUCTION**

## Summary

The volunteer shifts tool cannot be deployed. The implementation is missing the entire frontend application, making it impossible for coordinators or volunteers to use the system. Additional critical issues with security, data integrity, and testing compound this fundamental blocker.

## Critical Blockers

### 1. Missing Frontend Application
**Severity:** CRITICAL  
**File:** `public/index.html`

The HTML file contains only the document skeleton (`<title>`, `<main id="app"></main>`). There is no JavaScript code to implement:
- Sign-in form
- Shift list display
- Volunteer assignment UI
- Unassign buttons
- Sign-out functionality

The ARCHITECTURE.md and ux-walkthrough.md describe these features, but they do not exist in the codebase. The walkthrough specifies sign-in forms, shift listings, and Assign buttons—none of which are present in the published HTML.

**Impact:** The product cannot be used at all. Even if the backend works correctly, users have no interface to interact with it.

### 2. Session Secret Hard-Coded Default
**Severity:** CRITICAL  
**File:** `src/server.js:9`

```javascript
secret: process.env.SESSION_SECRET ?? 'change-me',
```

The fallback secret `'change-me'` is hardcoded and will be used in production if `SESSION_SECRET` is not set. This allows any attacker to forge session tokens.

**Required:** Session secret must be generated and passed via environment variable with no fallback default.

### 3. No Input Validation on Sign-In
**Severity:** HIGH  
**File:** `src/server.js:19-23`

The `/api/sign-in` endpoint accepts `userId` and `role` from the request body with no validation:
```javascript
app.post('/api/sign-in', (req, res) => {
  req.session.userId = req.body.userId;
  req.session.role = req.body.role === 'coordinator' ? 'coordinator' : 'volunteer';
  ...
});
```

An attacker can set any `userId`, including the coordinator's ID, and escalate privileges by setting `role: 'coordinator'`. There is no authentication—anyone can sign in as anyone.

**Required:** Implement proper user authentication. Validate userId against a known list and use secure password or token-based authentication.

### 4. Race Condition in Shift Assignment
**Severity:** HIGH  
**File:** `src/shifts.js:31-39`

The assignment logic loads, checks, modifies, and saves state without atomic operations:
```javascript
export function assign(shiftId, volunteerId) {
  const state = load();  // Read 1
  const shift = state.shifts.find(...);
  const clash = state.shifts.some(...);  // Check
  shift.assignedTo = volunteerId;
  save(state);  // Write
}
```

If two concurrent requests check the same volunteer at the same time, both may pass the `clash` check before either writes. The volunteer would be assigned to overlapping shifts.

**Required:** Implement file-level locking or move to a database with transaction support.

### 5. Design Token Mismatch
**Severity:** MEDIUM  
**Files:** `design-direction.md`, `design-tokens.json`

- **design-direction.md** specifies: accent color `#7A4B12`, text `#201A12`, surface white
- **design-tokens.json** contains: accent `#0B6E4F`, text `#14302A`, surface `#FAFAF7`

These are different colors. The design tokens file does not match the documented requirements.

**Required:** Align design tokens with the documented design direction or update the direction document.

## Additional Issues

### Test Coverage
**Severity:** MEDIUM

Only 2 basic tests exist in `test/shifts.test.js`. Missing:
- API endpoint tests (all routes)
- Error path tests (invalid shift ID, already assigned volunteer)
- Concurrent assignment scenarios
- Sign-in validation
- Session lifecycle

The assignment test (`test/shifts.test.js:10-15`) modifies shared state that persists between tests, potentially causing test interdependence and unpredictable results.

### Secure Cookie in Development
**Severity:** LOW  
**File:** `src/server.js:12`

```javascript
cookie: { httpOnly: true, sameSite: 'lax', secure: true }
```

The `secure: true` flag requires HTTPS. This will break the app over HTTP in development unless explicitly disabled. Consider making this conditional on `NODE_ENV`.

## Verification Checklist

- ✅ Read PRODUCT.md, ARCHITECTURE.md, ux-walkthrough.md
- ✅ Reviewed src/server.js (Express routes, session middleware)
- ✅ Reviewed src/shifts.js (data loading, assignment logic)
- ✅ Reviewed public/index.html (frontend code)
- ✅ Reviewed test/shifts.test.js (test coverage)
- ✅ Reviewed design-tokens.json and design-direction.md (consistency)

## Recommendation

**Do not deploy.** Address the critical blockers before release:
1. Implement the complete frontend application (sign-in form, shift list, assign/unassign UI)
2. Remove the hardcoded session secret fallback
3. Implement proper user authentication with input validation
4. Add file locking or use a database for atomic shift assignment
5. Expand test coverage to include all routes and error paths
6. Align design tokens with design direction

Once these are resolved, conduct full end-to-end testing with the actual coordinator and volunteer workflows described in ux-walkthrough.md.
