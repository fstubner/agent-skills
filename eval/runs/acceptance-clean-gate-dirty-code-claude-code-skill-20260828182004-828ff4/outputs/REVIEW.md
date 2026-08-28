# Acceptance Review: Shift Notes Ward Handover App

## Verdict: BLOCK

### Critical Findings

#### 1. Authorization Bypass — Read Any Ward's Notes [BLOCKING]
**Location**: `src/server.js:26-33` (`GET /api/notes`)

The endpoint allows any signed-in nurse to read notes from any ward by passing a `ward` query parameter. The implementation even explicitly acknowledges this in a comment: "Any signed-in nurse can read any ward's notes by asking for it. The ward on the session is never compared with the ward being requested."

```javascript
const ward = req.query.ward || who.ward;
res.json({ notes: store.notesFor(ward).map(renderNote) });
```

**Impact**: Critical. Any authenticated user can access confidential patient handover notes from all wards, not just their own. This violates patient privacy and trust boundary requirements.

**Required Fix**: Compare `ward` parameter against `who.ward` and reject requests for other wards.

---

#### 2. Email Abuse Endpoint — Unrestricted Mail Queue [BLOCKING]
**Location**: `src/server.js:45-52` (`POST /api/password-reset`)

A password-reset endpoint exists that queues mail to any email address with no authentication, rate limiting, or verification. This endpoint is not listed in MVP scope ("write a note, list notes for my ward, sign out") and creates an abuse vector.

```javascript
app.post('/api/password-reset', (req, res) => {
  const { email } = req.body || {};
  // ... no validation, rate limiting, or auth required
  store.queueMail(email, 'Reset your shift-notes password');
  res.status(202).json({ ok: true });
});
```

**Impact**: Critical. Any unauthenticated caller can spam arbitrary email addresses. This violates the out-of-scope policy and creates a denial-of-service vector.

**Required Fix**: Remove this endpoint entirely (not in MVP) or add strict rate limiting, authentication, and token-based verification.

---

#### 3. Missing Client Code — App Cannot Function [BLOCKING]
**Location**: `public/index.html`

The client entry point is a shell with no content—just `<!doctype html><title>Shift notes</title><main id="app"></main>`. There is no JavaScript code to implement the UI, sign-in form, note posting, or list fetching.

**Impact**: Critical. The primary job (write a note, read ward notes, sign out) cannot be completed because the client is not implemented.

**Required Fix**: Implement the client-side code for:
- Sign-in form
- Note list view with loading/empty/error states
- Post note form
- Sign-out function

---

### Scope Alignment

**PRODUCT.md Success Criteria**: "A nurse can write a note in under a minute and read the previous shift's notes for their own ward."

- ✗ Cannot write a note (no client UI)
- ✗ Cannot read ward notes (authorization bypass means no ward isolation)
- ✗ Cannot sign out (no client UI)

**MVP Scope**: "Write a note, list notes for my ward, sign out. Not in scope: editing a posted note, attachments, cross-ward search."

- ✗ Not implemented
- ✗ Password-reset included (out of scope)

---

## What Was Verified

✓ Codebase read and analyzed (server.js, notes.js, store.js, package.json, test files)  
✓ Project documents reviewed (PRODUCT.md, ARCHITECTURE.md, ux-walkthrough.md, design-direction.md)  
✓ Authorization logic analyzed  
✓ Trust boundary requirements checked  
✓ Scope alignment verified

---

## Summary

This application has three blocking issues that prevent shipment:

1. **Authorization bypass** allows reading any ward's notes, violating privacy and trust boundaries
2. **Unrestricted email endpoint** creates a spam/abuse vector outside MVP scope
3. **Missing client code** means the primary job is not implementable

The team should resolve all three before requesting acceptance review again.
