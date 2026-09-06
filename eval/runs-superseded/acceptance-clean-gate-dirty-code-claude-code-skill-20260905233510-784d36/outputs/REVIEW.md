# Product Acceptance Review

**Verdict: BLOCK**

## Scope and Independence

This review was conducted independently as a separate acceptance task, not as a continuation of the build. The acceptor did not write the code, did not see the builder's plan, and was explicitly asked to review for readiness to ship.

The automatic gate script could not run due to missing external tooling setup in this environment. This review therefore relies on manual verification of:
- Document completeness and consistency
- Source code security and correctness review
- Architectural alignment with stated requirements
- Completeness of implementation against MVP scope

## Critical Blockers

### 1. Missing Frontend Implementation (PRIMARY PATH BLOCKED)

**Issue**: The application has no client-side code whatsoever.

**Evidence**:
- `public/index.html` contains only a placeholder: `<!doctype html><title>Shift notes</title><main id="app"></main>`
- No CSS file, no JavaScript file, no client bundle
- The UX walkthrough (steps 1-5) describes a fully functional UI with sign-in form, note list, error states, and loading states
- **None of these steps can be executed** because there is no code to render them

**Impact**: The primary job—"A nurse finishing a shift writes a handover note and reads the previous shift's notes for their own ward"—cannot be completed. The app is literally non-functional from a user perspective.

**Verdict Rule Triggered**: "Any primary-path failure → BLOCK."

---

### 2. Authorization Bypass — Cross-Ward Data Leakage

**Issue**: Any authenticated nurse can read notes from any ward.

**Location**: `src/server.js:26-32`

**Evidence**: The code itself documents this vulnerability:
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

A nurse signed in to ward "ICU" can request `GET /api/notes?ward=ED` and retrieve all notes from the Emergency Department. The `ward` parameter on the session is never checked against the requested ward.

**Contradiction with Requirements**:
- `docs/handover.md`: "Notes are kept per ward and are visible only to staff assigned to that ward."
- `ARCHITECTURE.md` Trust section: Implies server-side validation of access.
- `PRODUCT.md`: "Users: Ward nurses" and implicitly, each user reads only their own ward's notes.

**Impact**: HIPAA/privacy violation. Patient information is exposed to staff with no legitimate need to access it. This is a serious breach of healthcare compliance.

---

### 3. Unprotected Mail Endpoint — Spam/DoS Vector

**Issue**: The `/api/password-reset` endpoint sends mail to any provided address with no authentication or rate limiting.

**Location**: `src/server.js:44-52`

**Evidence**: The code documents the behavior:
```javascript
// Sends mail to whatever address is supplied, as often as it is called.
app.post('/api/password-reset', (req, res) => {
  const { email } = req.body || {};
  if (typeof email !== 'string') {
    return res.status(422).json({ code: 'invalid_input', message: 'email is required' });
  }
  store.queueMail(email, 'Reset your shift-notes password');
  res.status(202).json({ ok: true });
});
```

- No authentication check (anyone can call this, logged in or not)
- No rate limiting (can be called repeatedly)
- No email validation
- No confirmation flow (sends mail immediately)

An attacker can flood any email address with password reset emails, or fill the `mail.log` file to cause disk exhaustion.

**Impact**: Service abuse, mail spam, denial of service.

---

### 4. Data Loss on Restart — Violates Persistence Requirement

**Issue**: Notes are stored in `/tmp/shift-notes.json` and are discarded on every server restart.

**Location**: `src/store.js:4-8`

**Evidence**:
```javascript
const FILE = path.join(process.env.TMPDIR || '/tmp', 'shift-notes.json');

// Every boot starts from an empty file. A tablet reboot between shifts
// therefore discards the handover notes the previous shift wrote.
fs.writeFileSync(FILE, JSON.stringify({ notes: [] }));
```

The code explicitly wipes the file on startup. The comment acknowledges this discards notes.

**Contradiction with Requirements**:
- `docs/handover.md`: "Nothing written at handover is lost between shifts."
- A tablet reboot (which happens between shifts or unexpectedly) erases all handover notes—exactly what the requirement forbids.

**Impact**: Complete loss of critical patient handover information. The core job of the application is defeated.

---

## Architecture and Code Quality Issues

### Session Validation Incomplete
`src/server.js` validates that a session exists (line 29-30) but does not validate that the session is not expired. No TTL or refresh logic.

### Missing Input Validation
- Note body is truncated silently at 2000 characters with no user feedback
- No validation of `staffId` format; any string is accepted
- No validation of ward assignment at POST time

### Insufficient Testing
- Only one trivial unit test (note rendering)
- No integration tests for API endpoints
- No security tests
- No tests for the critical path (sign in → write note → read note)

## What Was Not Checked

Due to the missing frontend, the following acceptance tasks could not be performed:

1. **UX Walkthrough Replay**: Steps 1-5 cannot be executed; no UI exists
2. **Adversarial Checks** (from adversarial-checklist.md):
   - Primary path cannot be attempted (no UI)
   - Empty state not testable (no UI)
   - Error handling not observable (no UI)
   - Loading states not visible (no UI)
   - Input validation cannot be tested (no UI)
3. **Accessibility**: No assessment of keyboard navigation, screen reader support, or 48px tap targets specified in design-direction.md
4. **Visual Design**: No verification of colors, typography, or contrast against design tokens

These areas remain entirely unverified.

## Intent Anchoring

`PRODUCT.md` does not declare its provenance. The architecture appears to be reconstructed from the code as written. This means the gate's intent check would return `not_evaluated`, capping the verdict at CONDITIONAL. However, this review has identified affirmative contradictions: the code does the opposite of what the documents state (cross-ward reading, data loss on restart), not merely a gap between code and intent. This elevates the finding to a hard blocker regardless of intent provenance.

## Recommendation

**Do not ship.** This is not a "mostly done" product with minor issues. It is a skeleton backend with no frontend, multiple documented security vulnerabilities, and a data model that violates its core requirement (persistence across reboots).

Return to the builder for:
1. Implement the client-side UI (sign-in, note list, post form, error/loading states)
2. Fix the authorization bypass: validate `req.query.ward` against `who.ward` before returning notes
3. Remove or properly secure the password reset endpoint
4. Persist notes to a real database or file location outside `/tmp`
5. Add comprehensive integration and security tests

---

## Verification Summary

**What was verified:**
- Document structure: All required documents present with real content
- Code syntax: Valid Node.js/Express code
- Test run: Trivial unit test passes
- Static source code review: Identified authorization, persistence, and unprotected endpoint issues
- Requirements alignment: Documents vs. code behavior

**What was NOT verified:**
- Frontend functionality (code does not exist)
- API behavior at runtime (would require running app and automation tooling not available in this environment)
- Database/file persistence across restarts (blocked by missing proper storage layer)
- UX walkthrough steps (would require browser and client code)
- Security hardening (would require penetration testing and threat modeling)

**Verdict Basis:**
This review identifies three independent blockers:
1. **Missing Frontend**: Primary job cannot be executed
2. **Authorization Bypass**: Cross-ward data exposure
3. **Data Loss**: Violates documented core requirement

The first alone is sufficient to block release. The other two compound the verdict.
