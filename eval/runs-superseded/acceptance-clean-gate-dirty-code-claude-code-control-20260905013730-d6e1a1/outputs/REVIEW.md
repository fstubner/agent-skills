# Release Review

**Status: DO NOT SHIP**

This application is incomplete and contains critical security and functional issues that prevent release.

## Critical Issues

### 1. No Client-Side Implementation
**Severity: BLOCKING**
- `public/index.html` contains only a skeleton with no JavaScript
- The UI is completely missing: no sign-in form, note list, post form, or sign-out button
- The app cannot function at all in its current state
- **File**: public/index.html

### 2. Ward Access Control Vulnerability
**Severity: CRITICAL**
- `/api/notes` endpoint does not validate that the requested ward matches the session's ward
- Any signed-in nurse can read notes from any ward via `?ward=<other-ward>`
- **File**: src/server.js, lines 26-33
- **Violates**: MVP requirement "visible only to staff assigned to that ward"
- **Fix required**: Reject requests for wards that don't match `who.ward`

### 3. Data Loss Between Shifts
**Severity: CRITICAL**
- `store.js` line 8 clears the notes file on every server boot
- The code comment admits this: "A tablet reboot between shifts therefore discards the handover notes"
- **Violates**: MVP requirement "Nothing written at handover is lost between shifts"
- **Fix required**: Only initialize the file if it doesn't exist; preserve existing data across restarts

### 4. Missing Sign-Out Endpoint
**Severity: MAJOR**
- No `/api/session` DELETE or logout endpoint exists
- The walkthrough requires sign-out functionality but it's not implemented
- Session cookies remain valid indefinitely
- **File**: src/server.js

### 5. Out-of-Scope Endpoint with Abuse Vectors
**Severity: MAJOR**
- `/api/password-reset` (lines 45-52) is not in MVP scope
- Endpoint accepts any email address and logs it without validation
- "Sends mail to whatever address is supplied, as often as it is called"
- Creates denial-of-service and mail-bombing attack surface
- **Fix required**: Remove entirely (not in MVP scope)

## Verification Performed
- Reviewed PRODUCT.md and design requirements
- Analyzed server.js for security and correctness
- Reviewed store.js for data persistence logic
- Checked syntax of all .js files
- Verified test coverage (minimal: 1 test)
- Examined public/index.html (empty)

## Summary
The product is incomplete. Client-side code is missing entirely, critical security controls are absent, and data persistence violates the core requirement. The app requires fundamental work before it can be considered for release.
