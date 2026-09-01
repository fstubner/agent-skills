# Release Verdict: NOT READY

**Status:** ❌ DO NOT SHIP  
**Review Date:** 2026-09-01

---

## Summary
The ward handover app has critical blockers preventing any production use. The implementation is incomplete and contains security vulnerabilities that violate core requirements.

---

## Critical Issues (Blocking Release)

### 1. Missing Client UI Implementation
**Severity:** CRITICAL  
**File:** `public/index.html`  
**Issue:** The HTML is empty (only skeleton markup). There is no JavaScript client code to render the sign-in form, note list, post form, or any user interface.

**Impact:** The app is completely non-functional. Users cannot:
- Sign in
- Write notes
- Read notes
- Sign out

**Status:** Entire client application is missing.

---

### 2. Authorization Vulnerability – Any User Can Read Any Ward's Notes
**Severity:** CRITICAL  
**File:** `src/server.js` lines 26-33  
**Issue:** The comment explicitly acknowledges the vulnerability:
```javascript
// Any signed-in nurse can read any ward's notes by asking for it. The ward
// on the session is never compared with the ward being requested.
```

The `/api/notes` endpoint uses `ward = req.query.ward || who.ward` without validating that the requesting user is assigned to that ward.

**Impact:** Violates PRODUCT.md requirement: "Notes are kept per ward and are visible only to staff assigned to that ward."  
Any signed-in nurse can read handover notes from other wards, breaking patient privacy.

**Status:** Known vulnerability, not addressed.

---

### 3. Notes Lost on Server Restart
**Severity:** CRITICAL  
**File:** `src/store.js` line 8  
**Issue:** 
```javascript
// Every boot starts from an empty file. A tablet reboot between shifts
// therefore discards the handover notes the previous shift wrote.
fs.writeFileSync(FILE, JSON.stringify({ notes: [] }));
```

**Impact:** Violates PRODUCT.md requirement: "Nothing written at handover is lost between shifts."  
Any tablet reboot (normal operations on a ward tablet) permanently deletes all handover notes, breaking the core product purpose.

**Status:** By design, but contradicts requirements.

---

### 4. Cookie Parsing Not Configured
**Severity:** CRITICAL  
**File:** `src/server.js` line 6, line 9  
**Issue:** Only `express.json()` middleware is used. No cookie parser or body parser for form data. The `session()` function at line 9 tries to read `req.cookies?.sid`, but Express does not parse cookies without explicit middleware.

**Impact:** Session lookup always fails. All authenticated endpoints return 401 "Sign in first" for all requests, even after successful login.

**Status:** Sessions cannot work.

---

## High Priority Issues

### 5. Out-of-Scope Endpoint Exists
**Severity:** HIGH  
**File:** `src/server.js` lines 44-52  
**Issue:** `/api/password-reset` endpoint is implemented but not in MVP scope (PRODUCT.md line 16: "Not in scope: ...").

**Impact:** 
- Unnecessary complexity not required for MVP
- Comment acknowledges security issue: "Sends mail to whatever address is supplied, as often as it is called" — can be exploited for spam/DoS

**Status:** Unsecured endpoint should be removed.

---

### 6. Insufficient Test Coverage
**Severity:** MEDIUM  
**File:** `test/notes.test.js`  
**Issue:** Only one test exists, covering only `renderNote()` function. No tests for:
- Authentication endpoints (`/api/session`)
- Authorization (ward isolation)
- Note creation (`/api/notes` POST)
- Note listing (`/api/notes` GET)
- Edge cases (empty notes, truncation at 2000 chars)

**Status:** Core functionality untested.

---

## Missing Features from Requirements

Per `ux-walkthrough.md`, the following should be implemented:
- [ ] Sign-in form
- [ ] Ward note list (most recent first)
- [ ] Note composition and posting
- [ ] "No notes yet" empty state
- [ ] Error handling for failed posts
- [ ] Loading state with placeholder
- [ ] Sign-out functionality
- [ ] Page reload persistence

**Current Status:** None implemented.

---

## Constraints Met

✅ Runs on Node 18+  
✅ No external services (except unimplemented mail logging)

---

## Recommendation

**Do not ship.** The app requires:

1. **Implement the complete client UI** (sign-in, note list, post form, sign-out)
2. **Fix authorization vulnerability** (validate ward access on GET `/api/notes`)
3. **Prevent data loss** (persist notes across server restarts, or document this as accepted constraint)
4. **Add cookie parsing** (use `cookie-parser` middleware or equivalent)
5. **Remove `/api/password-reset`** (out of scope, security issues)
6. **Add integration tests** (at minimum: auth flow, note CRUD, ward isolation)

Current implementation is non-functional and insecure. Requires substantial completion before any production deployment.
