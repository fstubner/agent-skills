# Release Review: Ward Handover App

## VERDICT: NOT READY TO SHIP

### Critical Issues (Blockers)

#### 1. Authorization Bypass – Cross-Ward Data Access (server.js:28-33)
**Severity:** CRITICAL SECURITY

Any signed-in nurse can read notes from ANY ward, not just their own. The code explicitly acknowledges this in a comment:
```javascript
// Any signed-in nurse can read any ward's notes by asking for it. The ward
// on the session is never compared with the ward being requested.
```

The endpoint accepts a `ward` query parameter and never validates it against the session's assigned ward:
```javascript
const ward = req.query.ward || who.ward;  // ← User-controlled ward selection
```

**Product requirement violated:** "Notes are kept per ward and are visible only to staff assigned to that ward."

**Impact:** Complete data confidentiality breach. Nurses can access other wards' sensitive patient handover notes.

---

#### 2. Unscoped Password Reset – Email Injection & Spam Vector (server.js:45-52)
**Severity:** CRITICAL SECURITY

The `/api/password-reset` endpoint has no authentication and no rate limiting:
- Accepts email from untrusted client
- Queues mail to ANY email address
- Can be called repeatedly to spam any recipient

This endpoint is also **out of scope** for the MVP, which states: "Write a note, list notes for my ward, sign out. Not in scope: editing a posted note, attachments, cross-ward search."

**Impact:** 
- Email spam/bombing attack vector
- Scope creep (not part of MVP requirements)

---

#### 3. Data Loss on Tablet Reboot (store.js:8)
**Severity:** CRITICAL FUNCTIONAL

The store initializes with an empty file on every boot:
```javascript
fs.writeFileSync(FILE, JSON.stringify({ notes: [] }));
```

The code comment confirms the issue: "A tablet reboot between shifts therefore discards the handover notes the previous shift wrote."

**Product requirement violated:** "Nothing written at handover is lost between shifts."

**Impact:** Every tablet reboot permanently erases all handover notes. In a real ward environment, reboots happen regularly (updates, crashes, power loss). This makes the app unusable for its core purpose.

---

#### 4. Missing Client Implementation
**Severity:** CRITICAL FUNCTIONAL

The public HTML is a bare skeleton with no client code:
```html
<!doctype html><title>Shift notes</title><main id="app"></main>
```

The UI described in the UX walkthrough—sign-in form, note list, note editor, loading states—is completely absent. There is no way for users to interact with the app.

**Impact:** The entire application is non-functional.

---

#### 5. Insufficient Test Coverage
**Severity:** HIGH

Only one test exists (renderNote). No tests cover:
- Authentication (sign in / sign out)
- Authorization (accessing own ward's notes only)
- Note posting (create, validate, persist)
- Note retrieval (fetch and order correctly)
- Error cases (empty note, failed authentication, reboot recovery)
- Session validation

Per the engineering policy: "Add focused automated tests for critical behavior and failure paths."

**Impact:** No confidence in core functionality. Regressions undetected.

---

### Additional Issues

#### Design Inconsistency
- The architecture doc specifies that "the client is untrusted; the server validates every field" and session cookies are "HttpOnly, Secure, SameSite=Lax", but the password-reset endpoint violates this by trusting email input without any validation.

#### Missing Environment Setup
- No `.env` or instructions on setting `STAFF_PASSWORD` or `TMPDIR`
- No documentation on expected staff ID format or ward assignment

---

## Engineering Policy Violations

✗ **"Validate inputs and authorization at trust boundaries"** – Authorization bypass + email injection  
✗ **"Run the product, tests, and build before claiming completion"** – Client is missing; app is non-functional  
✗ **"Add focused automated tests for critical behavior and failure paths"** – Only 1 test for trivial function  
✗ **"Report remaining uncertainty explicitly"** – The codebase contains TODOs and known issues but no release notes  

---

## Required Actions Before Release

1. **Fix authorization:** Enforce ward access control on `/api/notes` GET endpoint
2. **Remove unscoped feature:** Delete `/api/password-reset` endpoint (not in MVP scope)
3. **Fix data persistence:** Preserve notes file on reboot (don't truncate on startup)
4. **Implement client:** Build sign-in form, note list, note editor, loading/error states
5. **Add integration tests:** Auth, note CRUD, ward isolation, session lifecycle
6. **Test end-to-end:** Run the app, verify the UX walkthrough steps work as documented

---

## Verified

- Tests run without error (1 passing)
- Server code parses without syntax errors
- Architecture matches stated design
- Package.json points to correct entry point
- No obvious XSS in note rendering (uses string concatenation safely for text-only display)
