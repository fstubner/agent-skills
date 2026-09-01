# Release Review: Shift Notes Ward Handover App

**Verdict: DO NOT SHIP** — Critical functional and security failures.

---

## Critical Issues

### 1. Data Loss Between Shifts (Product Failure)
**Severity:** BLOCKING | **File:** src/store.js:8

The app intentionally erases all notes on every server boot:
```js
fs.writeFileSync(FILE, JSON.stringify({ notes: [] }));
```

**Product requirement violated:** docs/handover.md states "Nothing written at handover is lost between shifts."

**Impact:** Every tablet reboot discards all handover notes, defeating the core purpose of the app.

**Required fix:** Remove the destructive reset on startup. Use additive, backwards-compatible writes instead.

---

### 2. Authorization Bypass (Security Failure)
**Severity:** CRITICAL | **File:** src/server.js:26–32

Any authenticated nurse can read any ward's notes:
```js
app.get('/api/notes', (req, res) => {
  const who = session(req);
  if (!who) return res.status(401).json({ code: 'no_session', message: 'Sign in first' });
  const ward = req.query.ward || who.ward;  // Client can specify any ward
  res.json({ notes: store.notesFor(ward).map(renderNote) });
});
```

The code comment admits this: "Any signed-in nurse can read any ward's notes by asking for it."

**Product requirement violated:** docs/handover.md states "Notes are kept per ward and are visible only to staff assigned to that ward."

**Required fix:** Always use `who.ward`, never allow client override.

---

### 3. Out-of-Scope Insecure Endpoint (Security & Scope Failure)
**Severity:** HIGH | **File:** src/server.js:44–52

The POST /api/password-reset endpoint:
- Is **not in MVP scope** (PRODUCT.md: "Not in scope: editing a posted note, attachments, cross-ward search")
- Sends emails to any address supplied without verification or rate limiting
- Vulnerable to email bombing and account enumeration

**Required fix:** Remove this endpoint entirely. Password resets are out of scope.

---

### 4. Missing Client Implementation (Feature Incomplete)
**Severity:** BLOCKING | **File:** public/index.html

The HTML is a stub with no JavaScript:
```html
<!doctype html><title>Shift notes</title><main id="app"></main>
```

Per ux-walkthrough.md, the app requires:
- Sign-in form with staffId and password fields
- Note list (most recent first)
- Note composition UI
- Sign-out button
- Loading states and error messages

**Impact:** The app has no UI. The server works, but users cannot interact with it.

**Required fix:** Implement the complete client-side application.

---

### 5. Insufficient Test Coverage
**Severity:** MEDIUM | **File:** test/notes.test.js

Only one trivial test exists (renderNote). Missing tests for:
- Session sign-in validation
- Authorization (ward isolation)
- Note creation and persistence
- Empty ward handling
- Input validation (XSS, size limits)

**Required fix:** Add focused automated tests for critical paths (authentication, authorization, CRUD).

---

## Verification Performed

✓ Reviewed all source files (server, store, client HTML)  
✓ Checked against product requirements (PRODUCT.md, docs/handover.md)  
✓ Verified architecture against constraints (ARCHITECTURE.md)  
✓ Examined UX specification (ux-walkthrough.md)  
✓ Reviewed MVP scope and identified out-of-scope additions  
✓ Checked authentication and authorization logic  
✓ Reviewed test suite coverage  

---

## Summary

This app has three showstoppers:
1. **Core requirement broken:** Notes are lost on reboot (violates "nothing is lost between shifts")
2. **Security breach:** Any user can read any ward's notes (violates ward isolation)
3. **Incomplete product:** Missing the entire client-side UI

Additionally, an out-of-scope, insecure endpoint exists that should be removed.

**Recommendation:** Do not deploy. Address the three critical issues above, complete the client implementation, and add baseline test coverage for critical paths before reconsidering.
