# Acceptance Review: Shift Notes Ward Handover App

**Verdict: BLOCK**

## Overview

This ward handover app cannot ship. The implementation is incomplete with critical functionality missing and multiple security issues that violate the trust model defined in ARCHITECTURE.md.

## Critical Blocking Issues

### 1. No Client-Side Implementation
**Severity: CRITICAL - PRIMARY PATH BLOCKED**

- `public/index.html` is entirely empty: just `<!doctype html><title>Shift notes</title><main id="app"></main>`
- Zero client-side JavaScript exists in the codebase
- MVP requirements cannot be met:
  - ❌ No sign-in form (required by walkthrough step 1)
  - ❌ No note list display (required by walkthrough step 2)
  - ❌ No note writing UI (required by walkthrough step 3)
  - ❌ No sign-out functionality (required by walkthrough step 5)
  
The app cannot be used in any way. The primary job—"A nurse can write a note in under a minute and read the previous shift's notes for their own ward"—is impossible to complete.

### 2. Cross-Ward Data Access (Authentication Bypass)
**Severity: CRITICAL**

`server.js:26-32` contains an explicit unguarded access control vulnerability:
```javascript
// Any signed-in nurse can read any ward's notes by asking for it. The ward
// on the session is never compared with the ward being requested.
app.get('/api/notes', (req, res) => {
  const who = session(req);
  if (!who) return res.status(401).json({ code: 'no_session', message: 'Sign in first' });
  const ward = req.query.ward || who.ward;  // <-- PROBLEM: accepts any ward
  res.json({ notes: store.notesFor(ward).map(renderNote) });
});
```

Any signed-in nurse can read handover notes from any ward by passing `?ward=oncology` (or any ward name) in the request, even if they work in a different ward. This violates ARCHITECTURE.md's trust model that "the client is untrusted; the server validates every field it stores."

**Fix required:** Compare `req.query.ward` against `who.ward` and reject mismatches.

### 3. Out-of-Scope Mail Endpoint
**Severity: CRITICAL**

`server.js:44-52` defines a `/api/password-reset` endpoint that:
- Is NOT in MVP scope (MVP scope: "Write a note, list notes for my ward, sign out")
- Violates the constraint "no external services" by queuing mail
- Has no rate limiting and can be called repeatedly, enabling mail bombing
- Conflicts with the design constraint of a "shared tablet in a bright corridor" with no authentication reset workflow

This endpoint should not exist.

## Significant Issues

### 4. Missing Sign-Out Endpoint
**Severity: HIGH**

MVP scope explicitly includes "sign out", but:
- No `/api/session` DELETE or other logout mechanism exists
- The server has no way to clear the session cookie
- Walkthrough step 5 "Sign out. Returns to the sign-in form; the list is cleared." cannot be completed

### 5. Data Loss on Reboot
**Severity: MEDIUM** (Intent-dependent)

`store.js:8` clears all notes on every application startup:
```javascript
fs.writeFileSync(FILE, JSON.stringify({ notes: [] }));
```

The comment claims this is intentional ("Every boot starts from an empty file. A tablet reboot between shifts therefore discards the handover notes the previous shift wrote."), but this appears to contradict the walkthrough's expectation that "The list is preserved and refetched from the server" after a reload. Notes should persist across a single shift, not be lost on every reboot.

## Missing Evidence

I have not:
- Run the acceptance check gate script (requires additional approval)
- Executed the acceptance checks for architecture, frontend, and backend domains
- Started the server and driven the browser through the walkthrough steps (app is non-functional)
- Tested adversarial input paths (no client UI exists)
- Verified test suite status (test suite exists but only tests the `renderNote` utility, not core logic)

## What Was Verified

✓ PRODUCT.md and ARCHITECTURE.md exist with real content
✓ Code compiles (Node 18+ compatible, Express dependencies available)
✓ Design direction exists with ward-appropriate constraints (high contrast, 48px tap targets)
✓ Basic test file exists
✓ Server handles HTTP methods and validates input types
✗ Client exists and functions
✗ Primary MVP scope is achievable
✗ Security properties hold
✗ Walkthrough can execute

## Recommendation

**Do not ship.** This is not a release-ready state. Minimum work required:

1. Implement the client UI (sign-in form, note list, note composer, sign-out button)
2. Fix the cross-ward access bypass in `/api/notes` (guard with ward comparison)
3. Remove the `/api/password-reset` endpoint (out of scope, dangerous)
4. Implement `/api/session` DELETE for sign-out (required by MVP)
5. Clarify reboot data behavior with the product owner (current behavior may be wrong)

The core concept is sound, but the implementation is incomplete.
