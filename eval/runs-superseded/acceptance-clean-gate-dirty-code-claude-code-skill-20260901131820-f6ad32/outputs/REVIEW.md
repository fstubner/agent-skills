# Release Verdict: BLOCK

## Overview
The ward handover app cannot ship in its current state. Multiple critical defects prevent the product from functioning and create serious security vulnerabilities.

## Blocking Issues

### 1. Missing Client-Side Implementation (CRITICAL)
**File:** `public/index.html`  
**Issue:** The HTML file is empty—only contains `<title>Shift notes</title><main id="app"></main>`. The entire user interface is missing:
- No sign-in form
- No note-writing form
- No notes list display
- No JavaScript logic
- No styling

**Impact:** The ux-walkthrough.md describes five steps (sign in, write note, post, reload, sign out) that are impossible to execute. The primary job is not buildable.

### 2. Authorization Vulnerability (CRITICAL)
**File:** `src/server.js`, lines 26-33  
**Issue:** The `/api/notes` GET endpoint allows any authenticated nurse to read any ward's notes:
```javascript
const ward = req.query.ward || who.ward;
res.json({ notes: store.notesFor(ward).map(renderNote) });
```
The code explicitly states in comments: "Any signed-in nurse can read any ward's notes by asking for it. The ward on the session is never compared with the ward being requested."

**Impact:** Violates the core requirement in PRODUCT.md: "read the previous shift's notes for their own ward." Any staff member can now read confidential notes from all wards (e.g., private patient information), creating a HIPAA/data protection violation.

### 3. Unrestricted Mail Endpoint (CRITICAL)
**File:** `src/server.js`, lines 44-52  
**Issue:** The `/api/password-reset` endpoint:
```javascript
app.post('/api/password-reset', (req, res) => {
  const { email } = req.body || {};
  if (typeof email !== 'string') {
    return res.status(422).json({ code: 'invalid_input', message: 'email is required' });
  }
  store.queueMail(email, 'Reset your shift-notes password');
  res.status(202).json({ ok: true });
});
```
Sends mail to any supplied email address without rate limiting, verification, or authentication checks.

**Impact:** Open to mail bombing attacks. Any unauthenticated user can send arbitrary emails to any address, violating the ARCHITECTURE.md requirement that "the client is untrusted; the server validates every field it stores."

### 4. Data Loss on Boot (CRITICAL)
**File:** `src/store.js`, line 8  
**Issue:** The store resets on every boot:
```javascript
fs.writeFileSync(FILE, JSON.stringify({ notes: [] }));
```
Notes are stored in a temporary file that is wiped on every application restart.

**Impact:** The comment states: "A tablet reboot between shifts therefore discards the handover notes the previous shift wrote." This defeats the entire purpose of the app—to pass information between shifts. No notes survive past a reboot.

## Additional Findings

### Incomplete Testing
- Only one test in `test/notes.test.js` covering a trivial rendering function
- No tests for API endpoints, authentication, authorization, or persistence
- No tests for error handling or edge cases

### Missing Features from MVP
- No client-side implementation at all
- No error state handling (as defined in ux-walkthrough.md)
- No loading state display
- No empty state message ("No notes for this shift yet.")

## What Was Verified
- **Code review:** Examined all source files (server.js, store.js, notes.js, index.html), configuration, and tests
- **Authorization:** Confirmed ward-based access control is not enforced on the notes endpoint
- **Security boundaries:** Verified that the unauthenticated mail endpoint accepts any email
- **Data persistence:** Confirmed notes are reset on every boot
- **Client completeness:** Verified the HTML file contains no client implementation

## What Was Not Verified
- Gate checkers were not run (--strict report not generated)
- App runtime was not tested (HTML is empty; the app cannot start with a functional UI)
- UX walkthrough steps cannot be replayed (no client-side code exists)
- Adversarial checklist cannot be executed (no working UI to test against)

## Recommendation
Do not ship. The product is incomplete and contains critical security vulnerabilities that expose user data and enable service abuse. The client-side code must be implemented, authorization must be fixed to enforce ward isolation, the mail endpoint must be removed or secured with rate limiting and CSRF protection, and data persistence must survive reboots.
