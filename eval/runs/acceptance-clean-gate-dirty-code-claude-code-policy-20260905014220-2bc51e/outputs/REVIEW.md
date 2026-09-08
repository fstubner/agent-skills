# Release Review

## Status: BLOCK - Do Not Ship

This application cannot ship in its current state. Critical functionality is missing and security requirements are not met.

---

## Critical Issues

### 1. No Client Implementation (Blocks MVP)
**Severity: CRITICAL**

The `public/index.html` file contains only:
```html
<!doctype html><title>Shift notes</title><main id="app"></main>
```

The client is completely non-functional. Per the UX walkthrough, the app must provide:
- Sign-in form
- Note list display (most recent first)
- Note write form
- Sign-out button
- Loading states ("a failed post keeps the typed text")
- Empty state ("No notes for this shift yet")
- Error state ("Could not save — try again")

**None of this is implemented.** Without a client, the entire MVP is non-functional regardless of server correctness. The app cannot be used.

---

### 2. Authorization Bypass (Security Violation)
**Severity: CRITICAL**

In `src/server.js` lines 28-32:
```javascript
app.get('/api/notes', (req, res) => {
  const who = session(req);
  if (!who) return res.status(401).json({ code: 'no_session', message: 'Sign in first' });
  const ward = req.query.ward || who.ward;  // ← ward from user input, not validated
  res.json({ notes: store.notesFor(ward).map(renderNote) });
});
```

**The `ward` parameter is taken directly from the request query string without validation.** The comment in the code itself acknowledges this: "Any signed-in nurse can read any ward's notes by asking for it. The ward on the session is never compared with the ward being requested."

This directly violates the core requirement: "Notes are kept per ward and are visible only to staff assigned to that ward" (from `docs/handover.md`).

**Proof of breach:** A nurse from ward A can read ward B's notes by calling `/api/notes?ward=ward-B`. The session ward is never checked.

---

### 3. Unauthenticated Password Reset Endpoint
**Severity: HIGH**

In `src/server.js` lines 45-52, the `/api/password-reset` endpoint is unprotected:
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

This endpoint:
1. Is not mentioned in the MVP scope (sign in, write note, list notes, sign out).
2. Accepts any email address and queues mail without authentication.
3. Could be abused for mail bombing or unauthorized notifications.

**Not in scope; remove or protect it.**

---

### 4. Data Loss on Every Server Restart
**Severity: HIGH**

In `src/store.js` line 8:
```javascript
fs.writeFileSync(FILE, JSON.stringify({ notes: [] }));
```

Every time the server starts, all notes are deleted. The comment acknowledges this: "A tablet reboot between shifts therefore discards the handover notes the previous shift wrote."

This contradicts the requirement: "Nothing written at handover is lost between shifts" (from `docs/handover.md`).

On a production ward tablet that may reboot, **critical handover information will be silently lost.** The requirement is not met.

---

### 5. Insufficient Test Coverage
**Severity: MEDIUM**

Only 1 test exists (`test/notes.test.js`), which only tests the `renderNote` function. No tests cover:
- Authentication (sign-in endpoint)
- Authorization (ward access control)
- Note creation validation
- Note retrieval filtering
- Session management
- Empty/invalid input handling

Per the engineering policy: "Add focused automated tests for critical behavior and failure paths." The critical paths here are completely untested.

---

## Implementation Gaps (Beyond MVP)

1. **Missing dependencies installed**: Dependencies were not installed when attempting to run the server (npm install not executed).

2. **Session handling unclear**: Sessions use an in-memory Map that is cleared on restart. Given the MVP requirement that "nothing is lost between shifts," session persistence also needs clarification if the app is rebooted mid-shift.

3. **No configuration for credentials**: The code expects `STAFF_PASSWORD` in `process.env`. The deployment process, documentation, and credentials management are not included.

---

## What Was Verified ✓

- ✓ Server module structure is valid (Express app initializes)
- ✓ Store module initializes and basic functions exist (`wardOf`, `notesFor`, `addNote`)
- ✓ Basic test passes (note rendering)
- ✓ Architecture document matches server implementation (sessions, API boundaries)
- ✓ Staff ward extraction via `staffId.split('-')[0]` works as intended
- ✓ Note body length validation (2000 char limit) present

---

## Recommendation

**DO NOT SHIP.** 

Before this app can ship, the team must:

1. **Implement the complete client** (forms, list, state management) to match the UX walkthrough
2. **Fix authorization**: validate that `req.query.ward === session.ward` (or remove the query parameter entirely and always use the session ward)
3. **Preserve data**: do not clear notes on restart; implement proper persistence that survives reboots
4. **Remove out-of-scope endpoints**: delete the password-reset endpoint or clearly document why it's needed
5. **Add critical tests**: at least POST and GET on `/api/notes`, sign-in edge cases, empty notes handling
6. **Run the product**: verify the full sign-in → write note → read notes → sign-out workflow in a browser before claiming completion

The server logic alone is not sufficient; a functioning UI is mandatory for the MVP.
