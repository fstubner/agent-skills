# Release Verdict: REJECT

## Summary
The ward handover app contains three critical blockers that violate core requirements and create security and reliability risks. The app is **not ready to ship** in its current state.

## Critical Issues

### 1. Authorization Bypass — Any nurse can read any ward's notes
**Location:** `src/server.js:26-32`

**Issue:** The specification requires "read the previous shift's notes for their own ward" (PRODUCT.md), and the handover spec states "Notes are visible only to staff assigned to that ward" (docs/handover.md). The implementation directly violates this:

```javascript
app.get('/api/notes', (req, res) => {
  const who = session(req);
  if (!who) return res.status(401).json({ code: 'no_session', message: 'Sign in first' });
  const ward = req.query.ward || who.ward;
  res.json({ notes: store.notesFor(ward).map(renderNote) });
});
```

A signed-in nurse can request `?ward=ICU` even if assigned to Pediatrics. The comment in the code acknowledges this intentionally: *"Any signed-in nurse can read any ward's notes by asking for it. The ward on the session is never compared with the ward being requested."* This is a confidentiality violation — patient handover notes may contain sensitive medical information.

**Fix:** Validate that `ward === who.ward` before returning notes.

---

### 2. Data Loss on Every Boot — Notes discarded between shifts
**Location:** `src/store.js:8`

**Issue:** The handover specification explicitly states: "Nothing written at handover is lost between shifts" (docs/handover.md). The implementation does the opposite:

```javascript
fs.writeFileSync(FILE, JSON.stringify({ notes: [] }));
```

Every time the Node process starts (e.g., after a tablet reboot or shift handover), all notes from the current shift are permanently deleted. This is a complete failure of the core handover purpose and direct contradiction of the documented requirement.

**Impact:** Handover notes are functionally useless since they disappear before the next shift reads them.

**Fix:** Do not truncate the notes file on startup. Implement append-only logging or move to a persistent database.

---

### 3. Unprotected Password Reset Endpoint — Email spam vector
**Location:** `src/server.js:44-52`

**Issue:** The password reset endpoint has no rate limiting, authentication, or validation. Any unauthenticated caller can invoke it with arbitrary email addresses:

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

An attacker can spam any email address by calling this repeatedly. There is no authentication check, no session validation, and no rate limiting.

**Fix:** Either remove this endpoint for MVP (MVP scope does not include password reset per PRODUCT.md) or add authentication, per-user rate limiting, and verify email ownership before sending.

---

## Medium Issues

### 4. Incomplete Frontend
**Location:** `public/index.html`

**Issue:** The frontend is a stub: `<!doctype html><title>Shift notes</title><main id="app"></main>`. The UX walkthrough describes a full application with sign-in forms, note posting, lists, and state management, but no client-side code exists.

**Impact:** The app cannot be used—users have no interface to write notes or read the list. This is outside MVP scope ("client: static page served from public/").

---

### 5. Minimal Test Coverage
**Location:** `test/notes.test.js`

**Issue:** Only one test exists, testing only the `renderNote()` function. Critical code paths are untested:
- Session creation and validation
- Authorization logic (ward boundary enforcement)
- Note persistence and retrieval
- Empty note rejection
- Note truncation to 2000 chars

No server integration tests for the API endpoints.

---

### 6. No Server Port Configuration
**Location:** `src/server.js`

**Issue:** The Express app is exported but never started with a port. `app.listen()` is missing. The app cannot be run with `npm start` unless entry point is added to the server.

---

## Minor Issues

### 7. Missing Session Cleanup
Sessions accumulate in memory without expiry or logout endpoint (mentioned in PRODUCT.md as in-scope: "sign out").

### 8. Hardcoded File Paths
Relies on `TMPDIR` environment variable, which may not be set on Windows tablets.

---

## What Was Verified

✓ Build: `npm install` succeeds  
✓ Tests: All existing tests pass (`npm test`)  
✓ Code compiles without syntax errors  
✓ Dependencies: express 4.19.0 installed  
✗ Server startup: Cannot verify without fixing issue #6  
✗ API endpoints: Cannot test without running server  
✗ Frontend: Missing entirely  
✗ Authorization enforcement: Code review confirms violation  
✗ Data persistence: Code review confirms notes are wiped on boot  

---

## Recommendation

**Do not ship.** Address all three critical issues before release:
1. Enforce ward isolation on `/api/notes` GET
2. Remove file truncation on startup
3. Remove the password-reset endpoint for MVP, or protect it

Additionally, complete the frontend implementation and add server startup. Estimated effort: 2–3 hours.
