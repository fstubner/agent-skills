# Release Review: Shift Notes Ward Handover App

**Verdict: BLOCK**

This application cannot ship in its current state. Critical issues prevent it from functioning at all, and additional security vulnerabilities create unacceptable risks.

## Critical Findings (Blocking)

### 1. Missing Client Code — Cannot Render UI
**Severity: BLOCKING** | File: `public/index.html`

The client application is non-functional. The HTML file contains only:
```html
<!doctype html><title>Shift notes</title><main id="app"></main>
```

No JavaScript exists to implement any of the core features:
- No sign-in form
- No note list display  
- No note posting form
- No sign-out flow

The walkthrough requires all these features. The app cannot open a sign-in form (step 1), and there is no way to proceed through any of the remaining steps.

**Impact**: Complete product failure. Not even testable.

**Required fix**: Implement the client application with all features described in `ux-walkthrough.md`.

---

### 2. Cross-Ward Access Vulnerability — Nurses Read Any Ward's Notes
**Severity: BLOCKING** | File: `src/server.js`, lines 26-32

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

Any signed-in nurse can request `?ward=ICU` (or any ward) via query parameter and receive notes from that ward, regardless of their own assigned ward. The ward field from the session is never validated against the requested ward.

The comment explicitly documents this vulnerability, which suggests it was left in place knowingly.

**Trust boundary violation**: The PRODUCT.md states users should "read the previous shift's notes for their own ward" (singular). This allows reading any ward.

**Impact**: Privacy breach — patient safety information is exposed to unauthorized staff. This violates healthcare confidentiality requirements and the application's stated security model.

**Required fix**: Enforce ward equality:
```javascript
if (who.ward !== ward) {
  return res.status(403).json({ code: 'forbidden', message: 'Access denied' });
}
```

---

### 3. Unrestricted Mail Queue — DoS Vector
**Severity: HIGH** | File: `src/server.js`, lines 44-52

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

Any authenticated user can call this endpoint with any email address and queue mail without limits. There is:
- No rate limiting
- No email validation
- No ability to unsubscribe  
- No verification that the email owner requested the reset

A single nurse can spam hundreds or thousands of external addresses from your server.

**Impact**: Denial of service via external mail infrastructure abuse. Potential legal and reputation risk.

**Required fix**: Remove this endpoint entirely (not in MVP scope per `PRODUCT.md`). If password reset is required, implement proper validation and rate limiting.

---

## Secondary Findings

### 4. Data Persistence Issue
**Severity: CONDITIONAL** | File: `src/store.js`, line 8

```javascript
fs.writeFileSync(FILE, JSON.stringify({ notes: [] }));
```

Every server restart clears all notes. Per the design ("ward tablet, Node 18+"), if the tablet reboots between shifts, the handover notes are lost. This aligns with the one-shift-per-tablet model mentioned in the comments, but means data loss is the default behavior rather than an edge case. The PRODUCT.md should clarify whether this is acceptable.

---

## Acceptance Gate Coverage

**Gate Report**: Cannot run — automation infrastructure dependencies missing in workspace.

**Manual Walkthrough**: Not started — application is non-functional and cannot be executed. The missing client code prevents step 1 (open sign-in form).

**Adversarial Checklist**: The three critical findings above were discovered during code review:
- A: Contract — Cross-ward access violates PRODUCT.md success criterion  
- B: Primary path — Cannot proceed past step 0 (app won't render)
- C: Boundary validation — Unrestricted mail endpoint

**Audit Scope**: Full codebase reviewed (small scope: 4 source files, minimal dependencies)

---

## What Was Verified

✓ Code structure and architecture read  
✓ Server API endpoints reviewed  
✓ Client HTML examined  
✓ Session and authentication flow analyzed  
✓ Data storage implementation checked  

---

## What Was Not Verified

✗ Runtime behavior (app cannot execute)  
✗ UX walkthrough steps 1-5 (no UI to test)  
✗ Adversarial scenarios (browser required)  
✗ Database persistence and recovery  
✗ Error message content and styling  
✗ Accessibility or keyboard navigation  
✗ Mobile/tablet viewport rendering (design calls for 48px tap targets)  

---

## Acceptance Decision

**BLOCK** — Do not ship.

1. The application does not exist as a functioning product (missing client code)
2. The included server contains unacceptable security vulnerabilities (cross-ward access)
3. An unrestricted external API endpoint creates operational risk

The team should:
1. Implement the client-side application
2. Fix the ward access control enforcement
3. Remove or properly secure the mail endpoint
4. Re-run acceptance review in a fresh context (this is a review pass only; fixes require a separate build phase)

Shipping this as-is would violate patient privacy, contradict the stated security architecture, and expose the organization to DoS attacks. The missing client code alone makes it inoperable.
