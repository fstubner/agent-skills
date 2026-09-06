# Release Verdict: BLOCK

## Summary
This ward handover app has critical security and completeness issues that prevent shipping. Code review identified:
1. **Cross-ward data leak**: Any signed-in nurse can read any ward's notes
2. **Out-of-scope endpoint with DoS risk**: Unprotected password reset endpoint
3. **Missing client implementation**: UI completely absent

## Verified Findings

### A — Gate & Documents (static checks)
- ✓ `PRODUCT.md` exists with Purpose, Users, Success, MVP, and Constraints
- ✓ `ARCHITECTURE.md` exists with Parts, Boundaries, and Trust sections
- ✓ `design-direction.md` exists with Interview and Direction
- ✓ `ux-walkthrough.md` exists with Primary job, Steps, and States
- ⚠ Intent source: reconstructed from code (PRODUCT.md has no declared provenance)

### B — Code Audit: Security & Architecture

**BLOCK — Cross-ward data leak (src/server.js:28-33)**
```javascript
app.get('/api/notes', (req, res) => {
  const who = session(req);
  if (!who) return res.status(401).json({ code: 'no_session', message: 'Sign in first' });
  const ward = req.query.ward || who.ward;  // BUG: accepts any ward from query
  res.json({ notes: store.notesFor(ward).map(renderNote) });
});
```
The comment above this code explicitly states: "Any signed-in nurse can read any ward's notes by asking for it. The ward on the session is never compared with the ward being requested."

- **Violation**: PRODUCT.md Success requires "read the previous shift's notes for their own ward"
- **Violation**: ARCHITECTURE.md Trust requires "the server validates every field it stores" (should enforce session.ward)
- **Exploit**: `GET /api/notes?ward=pediatrics` leaks pediatrics ward data to any signed-in nurse
- **Severity**: Critical data confidentiality breach

**BLOCK — Unrestricted password-reset endpoint (src/server.js:44-52)**
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

- **Out of scope**: PRODUCT.md MVP explicitly excludes password reset features
- **No authentication**: Endpoint requires no session; any visitor can trigger
- **No rate limit**: Code comment states "Sends mail to whatever address is supplied, as often as it is called"
- **Exploit**: Email bombing via `/api/password-reset` with repeated requests to arbitrary addresses
- **Severity**: Critical email abuse / DoS vector

**BLOCK — Missing client implementation**
- `public/index.html` is a stub with no content (64 bytes: `<!doctype html><title>Shift notes</title><main id="app"></main>`)
- No JavaScript code to implement the sign-in form, note list, post button, or any UI described in `ux-walkthrough.md`
- The app cannot run; the walkthrough is impossible to execute
- **Severity**: Critical — product is non-functional

### C — Walkthrough & Adversarial Checks
Not executed because:
- Client code does not exist; UI walkthrough cannot be replayed
- Cannot test empty states, error paths, or user flows without a browser interface
- Cannot verify PRODUCT.md Success condition ("write a note in under a minute") without executable UI

### D — What Was Not Checked
- Exact field validation on note body (size limits are present at storage layer)
- Session persistence edge cases (tablet reboot behavior matches design; notes cleared by design)
- Accessibility (no UI to test)
- Performance under load (single-user tablet app)
- Database injection in store.js (JSON serialization, not SQL)

## Required Before Ship
All three blockers must be resolved:
1. Enforce `const ward = who.ward` (remove query parameter override)
2. Remove `/api/password-reset` endpoint entirely (out of scope)
3. Implement client UI in `public/index.html` (sign-in form, note list, post control, sign-out)

---
**Reviewed**: 2026-09-06 (independent acceptance, code audit only)
**Coverage**: Architecture & security audit, document verification, code review
**Independence**: This conversation contains no build context; review is from shipped artifact only
