# Release Review: Ward Handover App

**Recommendation: DO NOT SHIP**

This app has critical blockers that prevent it from functioning as specified. Multiple issues violate the product requirements, architecture contract, and introduce data loss and authorization failures.

---

## Critical Issues (Blockers)

### 1. Missing Client Implementation
**Severity: Blocker**

The public/index.html contains only a bare skeleton with no client-side code:
```html
<!doctype html><title>Shift notes</title><main id="app"></main>
```

There is no:
- Sign-in form
- Note composition UI
- Note list display
- API client
- State management
- Error handling UI

**Impact:** The app cannot be used at all. Users cannot sign in or interact with any functionality.

**Required:** Implement the full client-side application with forms and API integration per the UX walkthrough (ux-walkthrough.md).

---

### 2. Authorization Bypass: Cross-Ward Note Access
**Severity: Blocker | Security**

File: src/server.js, lines 26-33

```javascript
app.get('/api/notes', (req, res) => {
  const who = session(req);
  if (!who) return res.status(401).json({ code: 'no_session', message: 'Sign in first' });
  const ward = req.query.ward || who.ward;
  res.json({ notes: store.notesFor(ward).map(renderNote) });
});
```

Any signed-in nurse can read notes from any ward by passing `?ward=different-ward`. The code comment acknowledges this: "Any signed-in nurse can read any ward's notes by asking for it."

**Requirement violated:** handover.md states: "Notes are kept per ward and are visible only to staff assigned to that ward."

**Impact:** Complete authorization failure. Wards lose confidentiality of their handover notes. Staff can read sensitive information from other wards they are not assigned to.

**Fix:** Enforce `ward === who.ward` in the /api/notes GET handler. Remove the `?ward=` parameter override.

---

### 3. Data Loss Between Shifts
**Severity: Blocker**

File: src/store.js, lines 8

```javascript
fs.writeFileSync(FILE, JSON.stringify({ notes: [] }));
```

Every server boot initializes the notes file as empty. The comment states: "Every boot starts from an empty file. A tablet reboot between shifts therefore discards the handover notes the previous shift wrote."

**Requirement violated:** handover.md states: "Nothing written at handover is lost between shifts."

**Impact:** All notes written during a shift are lost when the tablet reboots (which is standard between shifts). The core use case—reading the previous shift's notes—fails entirely.

**Fix:** Only initialize the file if it doesn't already exist:
```javascript
if (!fs.existsSync(FILE)) {
  fs.writeFileSync(FILE, JSON.stringify({ notes: [] }));
}
```

---

### 4. Out-of-Scope Unauthenticated Password Reset
**Severity: High | Security**

File: src/server.js, lines 44-52

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

**Issues:**
- Not in MVP scope (PRODUCT.md does not mention password reset)
- No authentication required (any client can call it)
- No rate limiting (can be called unlimited times to spam any email address)
- Endpoint logs email addresses to a world-readable file

**Impact:** Email bombing attack vector. Attack surface introduced without justification.

**Fix:** Either remove entirely (not in MVP), or if needed: require authentication, add rate limiting, and restrict to authenticated user's own email.

---

## Medium Issues

### 5. Insufficient Test Coverage
**Severity: Medium**

File: test/notes.test.js

The test suite has only 1 test (for renderNote) and covers none of the critical paths:
- Sign-in flow and session creation
- Authorization (ward filtering)
- Note creation
- Note retrieval
- Session validation
- Invalid input handling

**Policy violation:** "Add focused automated tests for critical behavior and failure paths."

**Required:** Add tests for:
- POST /api/session with valid/invalid credentials
- GET /api/notes returns only the requesting user's ward
- POST /api/notes creates notes with correct ward assignment
- Note text truncation at 2000 chars
- Empty note rejection

---

### 6. Note Text Truncation Not Validated
**Severity: Low**

File: src/server.js, line 40

```javascript
store.addNote({ ward: who.ward, author: who.staffId, body: body.slice(0, 2000) });
```

The 2000-character limit is enforced silently with no feedback to the user. The client cannot know a note was truncated.

**Impact:** User writes 2500 characters, server silently discards the last 500 without notification.

**Fix:** Either reject notes over 2000 chars with a 422 error, or document the behavior clearly in the API contract.

---

### 7. Session Token Format Predictable
**Severity: Low**

File: src/store.js, line 13-14

```javascript
const sid = `${staffId}-${store.nextSession++}`;
```

Session tokens are sequential and include the staffId. An attacker can predict future or past session tokens.

**Suggestion:** Use cryptographic randomness:
```javascript
const sid = require('crypto').randomBytes(32).toString('hex');
```

---

## Verification Summary

**What was verified:**
- ✓ Architecture document accuracy (client-server split, trust boundaries)
- ✓ Product requirements alignment (scope, constraints)
- ✓ Source code review (server logic, store implementation, client completeness)
- ✓ Security posture (authentication, authorization, input validation)
- ✓ Test coverage assessment
- ✓ Data persistence strategy

**What cannot be verified (blocker):**
- Cannot run app (no client code exists)
- Cannot test integration (dependencies not installed, client not built)
- Cannot validate UX (no UI to test)
- Cannot verify handoff experience (requires tablet deployment)

---

## Summary

This app is a skeleton implementation with the core server logic present but **critical gaps** in the client, authorization, and data persistence. It cannot be deployed in its current state.

**Ship gate: FAIL**
