# Release Review: Ward Handover App

**Verdict: DO NOT SHIP**

## Critical Issues

### 1. Frontend Implementation Missing
**Severity: CRITICAL**
- `public/index.html` is a stub (64 bytes) with only title and an empty `<app>` div
- No sign-in form, note list UI, or note composition UI
- Product spec (ux-walkthrough.md) requires full workflow: sign-in, list notes, post note, sign out
- App cannot be used without frontend client code

### 2. Cross-Ward Access Vulnerability
**Severity: CRITICAL** | **Location:** `src/server.js:26-33`
- GET `/api/notes` accepts `?ward` query parameter without validation
- Any signed-in nurse can read notes from any ward by passing `ward=X`
- Code comments explicitly acknowledge this: "The ward on the session is never compared with the ward being requested"
- **Requirement violated:** docs/handover.md states "visible only to staff assigned to that ward"

### 3. Unprotected Password Reset Endpoint
**Severity: CRITICAL** | **Location:** `src/server.js:45-52`
- POST `/api/password-reset` requires no authentication
- No rate limiting
- Accepts arbitrary email addresses
- Enables mail bombing and spam attacks
- Not documented in PRODUCT.md; scope conflicts with MVP definition
- Code comments acknowledge the issue: "Sends mail to whatever address is supplied, as often as it is called"

### 4. Data Loss on Reboot
**Severity: CRITICAL** | **Location:** `src/store.js:8`
- Every server start clears all notes: `fs.writeFileSync(FILE, JSON.stringify({ notes: [] }))`
- Directly contradicts docs/handover.md: "Nothing written at handover is lost between shifts"
- On tablet reboot (common in healthcare settings), all handover notes are deleted

## Major Issues

### 5. Insufficient Test Coverage
- Only 1 test exists (renderNote formatting)
- No tests for authentication, authorization, or API endpoints
- No tests for ward access control
- No tests for input validation
- No tests for the unprotected password reset endpoint

### 6. Potential XSS Vulnerability
**Location:** `src/notes.js:2`
- `renderNote()` returns unescaped string: `${note.author}: ${note.body}`
- If frontend renders this as HTML without escaping, user input (note.body, author) becomes exploitable
- No documented rendering method on client side

### 7. Missing UX Requirements from Spec
Per `ux-walkthrough.md`, missing implementations:
- Empty state: "No notes for this shift yet."
- Error handling: "Could not save — try again"
- Loading placeholder states
- Sign out functionality with session clearing

## Summary

The app has incomplete implementation, unpatched security vulnerabilities, and contradicts core requirements. It cannot be deployed as-is.

**Action Required:** Address all critical issues before reconsidering for release.
