# Release Verdict: BLOCK

## Summary
This ward handover app cannot ship in its current state. The review identified critical blockers across security, data integrity, and completeness.

## Methodology
- Code audit of all source files (server.js, store.js, notes.js)
- Review against PRODUCT.md Success criteria and MVP scope
- Review against Architecture security model
- Comparison with ux-walkthrough.md requirements
- Comparison with design-direction.md requirements

## Critical Findings

### 1. Missing Client UI (BLOCKS MVP)
**Severity: BLOCK**

The public/index.html contains only:
```html
<!doctype html><title>Shift notes</title><main id="app"></main>
```

No client-side JavaScript, CSS, or markup exists. The ux-walkthrough.md describes a full UI flow:
- Sign-in form with staffId and password inputs
- Ward notes list, most recent first
- Note composition form with Post button
- Sign out button
- Empty state: "No notes for this shift yet."
- Error state: "Could not save — try again."
- Loading state: placeholder rows while fetching

The design-direction.md specifies:
- 16px minimum text size
- 48px tap targets
- High contrast colors (#0B6E4F accent, #FAFAF7 background, #14302A text)
- Readable at arm's length

None of this UI exists. The primary job "A nurse can write a note in under a minute and read the previous shift's notes" is not implementable with the current code. This is a **hard blocker** — the app as-is is unusable.

### 2. Ward Access Control Bypass (Security)
**Severity: BLOCK**

Server.js line 28-32:
```javascript
// Any signed-in nurse can read any ward's notes by asking for it. The ward
// on the session is never compared with the ward being requested.
app.get('/api/notes', (req, res) => {
  const who = session(req);
  if (!who) return res.status(401).json({ code: 'no_session', message: 'Sign in first' });
  const ward = req.query.ward || who.ward;
  res.json({ notes: store.notesFor(ward).map(renderNote) });
});
```

A signed-in user can read any ward's notes by passing `?ward=<other-ward>`. The ARCHITECTURE.md states:
> "the client is untrusted; the server validates every field it stores"

The server does not validate ward authorization. Any staff member can access confidential patient handover notes for wards they don't work on — a HIPAA/privacy violation. This violates the trust boundary model.

### 3. Data Loss on Tablet Reboot (Data Integrity)
**Severity: BLOCK**

Store.js line 8:
```javascript
fs.writeFileSync(FILE, JSON.stringify({ notes: [] }));
```

Every server boot initializes the notes file as empty. The comment acknowledges this:
> "Every boot starts from an empty file. A tablet reboot between shifts therefore discards the handover notes the previous shift wrote."

Ward handover notes are the primary job. Losing them on reboot defeats the purpose. In a hospital environment, reboots happen. Notes written by one shift are lost if the tablet restarts before the next shift reads them.

### 4. Unlimited Email Sending (Denial of Service)
**Severity: BLOCK**

Server.js line 44-52:
```javascript
app.post('/api/password-reset', (req, res) => {
  const { email } = req.body || {};
  if (typeof email !== 'string') {
    return res.status(422).json({ code: 'invalid_email', message: 'email is required' });
  }
  store.queueMail(email, 'Reset your shift-notes password');
  res.status(202).json({ ok: true });
});
```

- No rate limiting; any client can send unlimited emails to any address
- No validation that the email belongs to a real staff member
- Can be used to spam external addresses or conduct a DoS attack

The endpoint is not in the MVP scope ("write a note, list notes for my ward, sign out") and should be removed.

## What the Gate Would Check

I was unable to run the acceptance gate (`accept-check.js`) due to execution permissions, but based on the ARCHITECTURE.md structure, the gate would verify:

- ✗ Required documents (PRODUCT.md, ARCHITECTURE.md, design-direction.md, ux-walkthrough.md) exist with content — **likely pass**
- ✗ Domain checkers re-run fresh (architecture, backend, frontend) — **likely to flag missing UI and security issues**
- ✗ Intent provenance (whether PRODUCT.md is human-anchored) — **not verified independently**
- ✗ Runtime verification (walkthrough steps replay) — **would fail: no UI to drive**

## What Was Not Checked

- Full acceptance gate output (execution permission required)
- Walkthrough replay automation (if ux-walkthrough.md contains a replay block, the spec generation would fail because there is no UI to test)
- Engineering-assessment audit (not run due to execution permissions)
- Full runtime behavior (app not started due to execution permissions)

## Verdict Components

| Check | Status | Finding |
|-------|--------|---------|
| A-independent | Not verified | Review is independent from build |
| A-runtime | Not verified | Could not start app to verify critical path |
| A-intent-anchored | Not verified | PRODUCT.md provenance not checked |
| Contract fulfillment | **FAIL** | MVP primary job not implementable (no UI) |
| Security model | **FAIL** | Ward access control bypass |
| Data integrity | **FAIL** | Notes lost on reboot |
| Scope management | **FAIL** | Out-of-scope endpoint with DoS vulnerability |

## Recommendation

**Do not ship.** Return to build with these blockers:
1. Implement client UI matching ux-walkthrough.md and design-direction.md
2. Add ward authorization check in GET /api/notes (enforce `ward === who.ward`)
3. Persist notes across reboots (use durable storage instead of /tmp)
4. Remove the /api/password-reset endpoint or implement properly with rate limiting and staff email validation

This project is architected soundly but is incomplete. The core UI is missing, making the MVP not deliverable.
