# Release Review - Shift Notes App

**Status: ❌ DO NOT SHIP**

## Critical Issues

### 1. Missing Client Application
- **Severity**: BLOCKER
- **Location**: `public/index.html`
- **Issue**: The client application code does not exist. The index.html is a bare HTML file with only a title tag and empty main element. No JavaScript, no UI components, no form to sign in or write notes.
- **Requirement Violated**: PRODUCT.md states "Runs on a ward tablet" and the architecture describes a client that communicates with the server. The client does not exist.

### 2. Ward Data Privacy Breach
- **Severity**: CRITICAL SECURITY
- **Location**: `src/server.js:26-33` (`GET /api/notes` endpoint)
- **Issue**: Any signed-in nurse can read any ward's notes by passing `?ward=other-ward` in the query string. The code explicitly states: "Any signed-in nurse can read any ward's notes by asking for it. The ward on the session is never compared with the ward being requested." The server does not validate that the requested ward matches the user's assigned ward.
- **Requirement Violated**: `docs/handover.md` requires "Notes are kept per ward and are visible only to staff assigned to that ward."
- **Fix Required**: Compare `req.query.ward` with `who.ward` and reject requests for other wards.

### 3. Data Loss Between Shifts
- **Severity**: CRITICAL FUNCTIONAL
- **Location**: `src/store.js:8`
- **Issue**: `fs.writeFileSync(FILE, JSON.stringify({ notes: [] }))` runs on every server boot, discarding all notes. The comment acknowledges this: "A tablet reboot between shifts therefore discards the handover notes the previous shift wrote."
- **Requirement Violated**: `docs/handover.md` requires "Nothing written at handover is lost between shifts."
- **Fix Required**: Only initialize the file if it doesn't exist; preserve existing notes across reboots.

### 4. Email Abuse Vulnerability
- **Severity**: SECURITY/SCOPE
- **Location**: `src/server.js:45-52` (`POST /api/password-reset` endpoint)
- **Issues**: 
  - This endpoint is not in MVP scope (PRODUCT.md lists "Sign in, write note, list notes for my ward, sign out")
  - `store.queueMail()` sends email to any address, as often as called, with no rate limiting or validation
- **Fix Required**: Either remove this endpoint or restrict it to authorized use with proper rate limiting.

### 5. Minimal Test Coverage
- **Severity**: MEDIUM
- **Location**: `test/notes.test.js`
- **Issue**: Only one test exists, for the `renderNote` function. No tests for API endpoints, authentication flow, ward filtering, or session management.
- **Fix Required**: Add tests for sign-in, note creation, ward access control, and session invalidation.

## Summary

The app cannot ship because:
1. The user interface does not exist
2. A critical security vulnerability exposes notes across wards
3. Notes are lost on each tablet reboot, violating core product requirements
4. Out-of-scope endpoints with security risks are exposed

**Action**: Return to development. Fix the three critical issues and implement the client before reconsidering for release.
