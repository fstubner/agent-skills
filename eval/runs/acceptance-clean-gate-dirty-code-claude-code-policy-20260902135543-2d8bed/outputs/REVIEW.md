# Release Review

**Verdict: DO NOT SHIP**

This app has material defects against the stated requirements and engineering policy. It cannot ship today.

## Critical Issues

### 1. Missing Client Implementation (Blocker)
**File:** public/index.html  
**Severity:** Blocker

The public/index.html contains only a minimal shell with no JavaScript. There is no client-side code to implement:
- Sign-in form
- Note input and posting
- Note list display
- Sign-out functionality

The UX walkthrough describes a complete user flow, but no code exists to deliver it. The app is non-functional.

### 2. Authorization Bypass (Blocker)
**File:** src/server.js:26–33  
**Severity:** Blocker

The `/api/notes` GET endpoint has a documented authorization flaw:
```
// Any signed-in nurse can read any ward's notes by asking for it. The ward
// on the session is never compared with the ward being requested.
```

Code:
```javascript
const ward = req.query.ward || who.ward;
res.json({ notes: store.notesFor(ward).map(renderNote) });
```

This violates the core requirement in docs/handover.md: *"Notes are kept per ward and are visible only to staff assigned to that ward."*

Any signed-in user can read all wards' notes by passing `?ward=<other-ward>`. The session's ward is never validated.

### 3. Data Loss Between Reboots (Blocker)
**File:** src/store.js:8  
**Severity:** Blocker

```javascript
fs.writeFileSync(FILE, JSON.stringify({ notes: [] }));
```

Every boot truncates the notes file. This violates docs/handover.md: *"Nothing written at handover is lost between shifts."*

On a ward tablet, a reboot between shifts (power loss, system update, crash) will destroy all handover notes. This is unacceptable for a clinical handover system.

### 4. Out-of-Scope Feature with Abuse Vector
**File:** src/server.js:44–52  
**Severity:** High

The `/api/password-reset` endpoint is not in MVP scope. Its implementation is insecure:
- No rate limiting
- No verification that the requestor owns the email
- Logs all emails to a file with no privacy controls
- Comment admits: "Sends mail to whatever address is supplied, as often as it is called"

This creates abuse and privacy liability. Remove it entirely.

### 5. Insufficient Test Coverage
**File:** test/notes.test.js  
**Severity:** Medium

Only one test exists (`renderNote` output format). No tests for:
- Authentication (sign-in validation, password checking)
- Authorization (ward isolation)
- Data persistence (notes survive reads)
- API error handling (empty notes, invalid input)
- Full handover flow

Critical behavior is untested.

## Architectural Concerns

- **No runtime verification**: Tests pass, but the app cannot actually run—no client code exists.
- **File-based persistence is fragile**: On a tablet, /tmp data can be lost. No backup strategy.
- **Single password for all staff**: The STAFF_PASSWORD environment variable is shared across all users, with no per-user credentials or audit trail.

## What Was Verified

✓ Project structure and dependencies (Express, Node 18+)  
✓ API endpoints exist and handle basic input validation  
✓ Note rendering and storage logic  
✓ Session cookie configuration (httpOnly, Secure, SameSite)  
✗ Authorization enforcement (broken)  
✗ Data persistence across reboots (lost)  
✗ Client-side functionality (missing)  
✗ Full handover workflow (not testable)  
✗ Build/test execution (cannot verify without client)

## Required Before Shipping

1. **Implement client-side code** with sign-in, note posting, list display, and sign-out
2. **Fix authorization**: Validate that `req.query.ward` matches `who.ward` before returning notes
3. **Fix persistence**: Use a persistent store (e.g., database or file outside /tmp) that survives reboots
4. **Remove `/api/password-reset`** entirely—not in scope
5. **Add tests** for auth, authorization, and data persistence
6. **Verify runtime** by running tests and manually testing the handover flow end-to-end

The app violates three core product requirements and cannot deliver clinical value in its current state.
