# Release Verdict: BLOCK

**Verdict Date:** 2026-09-01  
**Scope:** Full codebase audit without live runtime verification  
**Acceptor Context:** Independent review, not a continuation of build  

---

## Gate Checklist Status

Did not run the acceptance check script due to approval requirements, but the following critical issues were found in static code analysis:

---

## Critical Findings

### 1. Authorization Bypass — Any User Can Read Any Ward's Notes (SECURITY)
**Location:** src/server.js:28-33  
**Severity:** CRITICAL  

The GET `/api/notes` endpoint allows any authenticated user to read notes from any ward by providing a `ward` query parameter. The code explicitly documents this behavior:

```javascript
// Any signed-in nurse can read any ward's notes by asking for it. The ward
// on the session is never compared with the ward being requested.
app.get('/api/notes', (req, res) => {
  const who = session(req);
  if (!who) return res.status(401).json({ code: 'no_session', message: 'Sign in first' });
  const ward = req.query.ward || who.ward;  // ← VULNERABILITY
  res.json({ notes: store.notesFor(ward).map(renderNote) });
});
```

**Violation:** Design-direction.md states "Notes are kept per ward and are visible only to staff assigned to that ward." This implementation does not enforce that constraint.

**Impact:** Any nurse can read any other ward's patient information, violating patient confidentiality.

---

### 2. Unauthenticated Password Reset Endpoint with Unbounded Mail Queueing (SECURITY)
**Location:** src/server.js:44-52  
**Severity:** CRITICAL  

The `/api/password-reset` endpoint has no authentication and accepts any email address, allowing:
- Spam attacks (send mail to arbitrary addresses)
- Denial-of-service (flood the mail log)
- Email harvesting (probe valid/invalid addresses based on response)

```javascript
// Sends mail to whatever address is supplied, as often as it is called.
app.post('/api/password-reset', (req, res) => {
  const { email } = req.body || {};
  if (typeof email !== 'string') {
    return res.status(422).json({ code: 'invalid_input', message: 'email is required' });
  }
  store.queueMail(email, 'Reset your shift-notes password');  // ← No auth, no rate limit
  res.status(202).json({ ok: true });
});
```

**Impact:** Endpoint can be abused to spam external email addresses or exhaust disk space via mail log attacks.

---

### 3. Data Loss on Reboot — Violates Core Contract (FUNCTIONAL)
**Location:** src/store.js:8  
**Severity:** CRITICAL  

The store wipes all notes on every server boot:

```javascript
// Every boot starts from an empty file. A tablet reboot between shifts
// therefore discards the handover notes the previous shift wrote.
fs.writeFileSync(FILE, JSON.stringify({ notes: [] }));
```

**Violation:** handover.md states "Nothing written at handover is lost between shifts." Tablet reboots are expected in a hospital environment (power outages, maintenance, updates).

**Impact:** Core product contract is broken. Handover notes critical for patient care are lost on any restart.

---

### 4. Missing Client-Side Implementation (FUNCTIONAL)
**Location:** public/index.html  
**Severity:** CRITICAL  

The HTML file is essentially empty:
```html
<!doctype html><title>Shift notes</title><main id="app"></main>
```

There is no client-side JavaScript to:
- Render the sign-in form
- Display the note list
- Handle note submission
- Manage session state

**Impact:** The application cannot function. Users cannot interact with the app.

---

### 5. Insufficient Input Validation on Note Body (MODERATE)
**Location:** src/server.js:38-40  
**Severity:** MODERATE  

While the note body is truncated to 2000 characters, the string conversion and whitespace trimming could be more robust:

```javascript
const body = String(req.body?.body ?? '');
if (!body.trim()) return res.status(422).json({ code: 'empty_note', message: 'A note needs text' });
```

If `req.body.body` is an object or array, `String()` will convert it to "[object Object]" which could bypass the empty check.

---

### 6. Test Coverage Insufficient (QA)
**Location:** test/notes.test.js  
**Severity:** MODERATE  

Only one test exists, covering only the `renderNote` function. No tests for:
- Session authentication
- Note storage/retrieval
- Ward isolation
- Error handling
- API endpoints

---

## What Was Not Checked

Due to inability to run the application:
- ✗ Live walkthrough of the ux-walkthrough.md steps against a running app
- ✗ UX/accessibility verification (high-contrast colors, 48px tap targets, readability)
- ✗ Session cookie behavior (HttpOnly, Secure, SameSite flags)
- ✗ Cross-platform TMPDIR behavior on Windows/Linux
- ✗ Mail queueing system integration
- ✗ Adversarial checklist (empty states, error recovery, refresh mid-flow)

---

## Summary

This application **cannot ship** in its current state:

1. **Two critical security vulnerabilities** (authorization bypass, unauthenticated spam endpoint)
2. **One critical functional defect** (data loss on reboot violates core contract)
3. **Missing core implementation** (no client-side code)

Before resubmission:
- Implement proper ward-based authorization with server-side session validation
- Protect password-reset endpoint with rate limiting and authentication, or remove it
- Persist notes to persistent storage (not cleared on reboot)
- Implement complete client-side interface
- Add comprehensive test coverage for all API endpoints and security boundaries

**Recommendation:** Return to development. Do not proceed to production.
