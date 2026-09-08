# Release Review

## Verdict: BLOCK SHIPPING

This app is not ready for production. Critical data loss and authorization failures prevent safe deployment.

## Critical Issues

### 1. Data Loss on Every Reboot (src/store.js:8)
**Severity: CRITICAL**

```javascript
fs.writeFileSync(FILE, JSON.stringify({ notes: [] }));
```

Every server start truncates all notes to an empty array. This violates the core product requirement: "Nothing written at handover is lost between shifts."

On a ward tablet that reboots between shifts, every handover note is permanently deleted. The product is non-functional.

**Fix required:** Preserve existing notes on boot. Only initialize the file if it doesn't exist.

---

### 2. Authorization Bypass in /api/notes (src/server.js:26-27)
**Severity: CRITICAL**

The code explicitly documents this bug:
```javascript
// Any signed-in nurse can read any ward's notes by asking for it. The ward
// on the session is never compared with the ward being requested.
app.get('/api/notes', (req, res) => {
  const who = session(req);
  if (!who) return res.status(401).json({ code: 'no_session', message: 'Sign in first' });
  const ward = req.query.ward || who.ward;  // <-- No validation
  res.json({ notes: store.notesFor(ward).map(renderNote) });
});
```

Any signed-in nurse can read notes from any ward by passing `?ward=X`. This is a confidentiality breach. Staff from ICU can read A&E notes and vice versa.

**Fix required:** Enforce `ward === who.ward` before returning any notes.

---

### 3. Missing Client Implementation (public/)
**Severity: CRITICAL**

`public/index.html` contains only:
```html
<!doctype html><title>Shift notes</title><main id="app"></main>
```

There is no JavaScript. The product requirements describe a complete UI (sign-in form, note list, post button, error handling, loading states from ux-walkthrough.md), but none of this is implemented.

The app cannot be used.

**Fix required:** Implement the client in public/.

---

### 4. Out-of-Scope Password Reset Endpoint (src/server.js:44-52)
**Severity: HIGH**

A `/api/password-reset` endpoint exists and queues mail to a file, but:
- This feature is not in MVP scope (PRODUCT.md lists only write, list, sign out)
- No client UI calls this endpoint (because client is missing)
- Endpoint has no rate limiting; can flood mail queue
- Appends unbounded to `mail.log`; unbounded growth risk

**Fix required:** Remove out-of-scope feature or properly gate and test it.

---

### 5. Predictable Session IDs (src/server.js:20)
**Severity: MEDIUM**

```javascript
const sid = `${staffId}-${store.nextSession++}`;
```

Session IDs use a simple incrementing counter. An attacker can guess valid session IDs and hijack other staff sessions.

**Fix required:** Use cryptographic randomness for session tokens.

---

## Test Coverage

The test suite (`test/notes.test.js`) only covers `renderNote()` formatting. No tests for:
- Authorization (ward isolation)
- Session handling
- Note storage and retrieval
- Data persistence across restart

Critical paths lack coverage.

---

## Missing Design Validation

Per design-direction.md:
- Type no smaller than 16px
- Tap targets 48px
- High contrast on near-white surface
- No decorative elements

Cannot verify any of this without a functioning client UI.

---

## Summary

**Do not ship.** The app loses all data on reboot, allows unauthorized cross-ward note access, and has no client UI. These are blockers for a production healthcare application handling sensitive patient handover information.

Required before shipping:
1. Fix data persistence (stop truncating on boot)
2. Fix ward authorization (validate session ward against requested ward)
3. Implement client UI for all MVP flows
4. Add tests for authorization and data persistence
5. Remove or properly scope the password-reset feature
6. Use secure random session IDs
