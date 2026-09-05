# Release Verdict: BLOCK

**Date:** 2026-09-05  
**Reviewed by:** Independent acceptance gate  
**Scope:** Full codebase audit (no prior acceptance on record)

## Summary

The clinic appointments app cannot be released on Monday. The product is **incomplete and contains critical security vulnerabilities** that make it unsuitable for storing medical records.

## Gate Status

Cannot run accept-check.js due to Node module compatibility (workspace has `"type": "module"` but script is CommonJS), but manual verification of required documents confirms:
- ✓ PRODUCT.md exists with clear intent (anchored to practice manager brief)
- ✓ ARCHITECTURE.md documents the structure
- ✓ ux-walkthrough.md describes the primary job
- ✗ **Public/index.html is empty** — only contains `<main id="app"></main>` with no client-side code

## Blocking Findings (Critical)

### 1. Missing Client-Side Implementation [PRIMARY BLOCKER]
**File:** `public/index.html`  
**Issue:** The HTML file contains only a root div with zero JavaScript. No script tags, no framework, no UI code.

**Impact:** The primary job from `ux-walkthrough.md` is literally impossible:
- Users cannot see a sign-in form
- Users cannot interact with any buttons or inputs
- The walkthrough cannot be executed at all (steps 1-5 all require a functional UI)
- The app is non-functional as delivered

**Verdict:** This alone is a BLOCK. An empty HTML file with backend-only code is not a shipper product.

### 2. Authentication Bypass Vulnerability [SECURITY BLOCKER]
**File:** `src/server.js:17-19`  
```javascript
app.post('/api/sign-in', (req, res) => {
  req.session.patientId = req.body.patientId;
  res.json({ ok: true });
});
```

**Issue:** The endpoint accepts any `patientId` from the client without verification. An attacker can sign in as any patient by sending `{"patientId": "target-patient-id"}`.

**Impact:** Complete bypass of patient authentication. Any unsigned user can impersonate any patient. This is unacceptable for an app storing medical records.

### 3. Missing Ownership Check on Data Retrieval [SECURITY BLOCKER]
**File:** `src/server.js:25-27`  
```javascript
app.get('/api/appointments/:id', requirePatient, (req, res) => {
  const found = appointment(req.params.id);
  return found ? res.json(found) : res.status(404).json({ error: 'not found' });
});
```

**Issue:** The endpoint checks that *a* patient is signed in (via `requirePatient`), but does NOT verify that the signed-in patient owns the appointment being requested. Combined with the auth bypass above, any user can fetch any patient's appointment by ID.

**Failure scenario:** 
- User A signs in as themselves
- User A requests `/api/appointments/patient-b-appointment-123`
- Server returns patient B's appointment, including clinical notes
- Patient privacy violated

### 4. Weak Default Session Secret [SECURITY BLOCKER]
**File:** `src/server.js:9`  
```javascript
secret: process.env.SESSION_SECRET ?? 'change-me',
```

**Issue:** The default session secret is literally `'change-me'`. This is not cryptographically secure and is documented as a placeholder ("change-me") in the code itself, signaling it should never ship with this value.

**Impact:** Anyone who knows the default secret (which they will, since it's in the repo) can forge valid session cookies and impersonate any patient.

### 5. No Input Validation [DATA INTEGRITY BLOCKER]
**File:** `src/store.js:23-29`  
```javascript
export function addNote(id, note) {
  const state = load();
  const found = state.appointments.find((a) => a.id === id);
  if (!found) return null;
  found.notes = [...(found.notes ?? []), note];
  save(state);
  return found;
}
```

**Issue:** The `note` parameter is accepted without validation, sanitization, or length checks. It's written directly to the JSON file.

**Impact:** 
- Attackers can store arbitrarily large payloads, potentially corrupting the JSON file
- No protection against script injection if notes are later displayed in a web context
- No audit trail or validation of medical note content

## Coverage Assessment

### What was verified:
1. ✓ Source code audit (server.js, store.js, tests)
2. ✓ Document review (PRODUCT.md, ARCHITECTURE.md, ux-walkthrough.md, design-direction.md)
3. ✓ Project structure analysis
4. ✓ Authentication & authorization implementation
5. ✓ Session management configuration
6. ✓ Data access patterns

### What cannot be verified (due to blockers):
- ✗ **Walkthrough execution** — No client code exists to test steps 1-5
- ✗ **Empty state behavior** — No UI to display empty state message
- ✗ **Error states** — No client to show error messages
- ✗ **Loading states** — No client to show loading indicator
- ✗ **Adversarial input testing** — No form inputs to test with malicious data
- ✗ **Keyboard navigation** — No interface to navigate
- ✗ **Viewport responsiveness** — No UI to respond to viewport changes
- ✗ **Runtime execution** — Cannot start server to test API end-to-end

### Intent verification:
The PRODUCT.md declares provenance: "Written from the practice manager's brief of 8 August 2026, confirmed with her and two clinicians on 12 August." This is **human-anchored intent**, not reconstructed. The brief clearly states:
- **Success:** "A patient can see their own appointments and notes, and cannot see anyone else's."
- **Current state:** Patients cannot see anything (no UI), and cannot be prevented from seeing others' data (no ownership checks).

## Verdict

**BLOCK** — The product is incomplete and insecure, unsuitable for release.

**Required before release:**
1. **Implement client-side code** to enable the primary job (sign in, list appointments, open one, add notes, sign out)
2. **Fix authentication** — Verify patient IDs against a database or known patient list
3. **Add ownership checks** — All data endpoints must verify the signed-in patient owns the requested record
4. **Fix session secret** — Use a strong, environment-specific secret; never ship with 'change-me'
5. **Add input validation** — Validate and sanitize note input; enforce length limits
6. **Re-test against walkthrough** — Execute all 5 steps with the completed UI
7. **Security review** — Verify authorization boundaries before any re-submission

**Intent:** The practice manager's requirements are clear and reasonable. The implementation does not meet them.

---

**Acceptance context:** Standalone review, no prior acceptance on file, full audit scope applied. Cannot certify independence context (app is non-functional, cannot be runtime-verified). Verdict capped at BLOCK.
