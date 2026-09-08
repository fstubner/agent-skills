# Release Review: Ward Handover App

**Date:** 2026-09-05  
**Reviewer:** Claude Code Agent  
**Status:** ❌ **NOT READY TO SHIP**

---

## Critical Issues

### 1. Cross-Ward Access Vulnerability (Security)
**File:** `src/server.js:26-32`

The `/api/notes` endpoint explicitly allows any signed-in nurse to read notes from any ward:

```javascript
// Any signed-in nurse can read any ward's notes by asking for it.
const ward = req.query.ward || who.ward;
```

**Requirement:** `docs/handover.md` states "Notes are kept per ward and are visible only to staff assigned to that ward."

**Impact:** A nurse from Ward A can read Ward B's confidential patient handover notes. This is a privacy and HIPAA violation.

**Fix Required:** Validate that `who.ward === ward` before returning notes.

---

### 2. Data Loss on Tablet Reboot (Critical Data Loss)
**File:** `src/store.js:4-8`

Notes are stored in `/tmp/shift-notes.json`, which is cleared on every tablet reboot:

```javascript
fs.writeFileSync(FILE, JSON.stringify({ notes: [] }));
```

**Requirement:** `docs/handover.md` states "Nothing written at handover is lost between shifts."

**Impact:** All handover notes from the current shift are permanently deleted when the tablet reboots between shifts. This defeats the core purpose of the app—to preserve continuity of care.

**Fix Required:** Store notes in a persistent location (e.g., `/var/lib/shift-notes/` or a database) that survives reboots. Document the storage strategy in ARCHITECTURE.md.

---

### 3. Email Injection / Spam Vulnerability (Security)
**File:** `src/server.js:44-52`

The `/api/password-reset` endpoint has no authorization or rate limiting:

```javascript
app.post('/api/password-reset', (req, res) => {
  const { email } = req.body || {};
  store.queueMail(email, 'Reset your shift-notes password');
  res.status(202).json({ ok: true });
});
```

**Issues:**
- Any unauthenticated user can call this endpoint (no session check).
- Endpoint accepts any email address without validation.
- No rate limiting or CAPTCHA.

**Impact:** Attackers can spam arbitrary email addresses, impersonating the hospital.

**Fix Required:** 
- Add session validation (signed-in users only).
- Validate email format.
- Implement rate limiting per IP/session.
- Or remove the endpoint entirely if password reset is not in MVP scope.

---

### 4. Incomplete Client Implementation (Critical Functional Gap)
**File:** `public/index.html`

The HTML file is a bare skeleton with no client-side code:

```html
<!doctype html><title>Shift notes</title><main id="app"></main>
```

**Expected:** Per `ux-walkthrough.md`, the app should render:
- Sign-in form
- Note list (most recent first)
- Note input form
- Error states ("Could not save — try again")
- Loading placeholders

**Impact:** The app cannot function—users see a blank page with no UI.

**Fix Required:** Implement client-side JavaScript to:
- Render the sign-in form
- Handle session management via cookies
- Fetch and display notes
- Post new notes with error handling
- Apply design tokens (colors from `design-tokens.json`, 16px+ text, 48px tap targets)

---

## Major Issues

### 5. Insufficient Test Coverage
**File:** `test/notes.test.js`

Only one test exists, covering only the `renderNote()` helper function. No tests for:
- Session management (sign-in, cookie validation)
- Authorization (cross-ward access blocking)
- Note persistence and retrieval
- Input validation (empty notes, note truncation)
- Error responses

**Fix Required:** Add integration tests covering critical paths:
- Successful sign-in and session creation
- Note creation and retrieval for a ward
- Cross-ward access rejection
- Empty note rejection
- Note truncation at 2000 chars

---

### 6. No Validation of Staff IDs
**File:** `src/server.js:13-14, 21`

The sign-in endpoint accepts any `staffId` without validation:

```javascript
if (typeof staffId !== 'string' || typeof password !== 'string') { /* check */ }
// ... but no check that staffId exists in the system
store.sessions.set(sid, { staffId, ward: store.wardOf(staffId) });
```

The `wardOf()` function naively splits on `-`:

```javascript
wardOf(staffId) { return staffId.split('-')[0] || 'general'; }
```

**Issues:**
- Any string is accepted as a staffId (e.g., `"fake-staff"` → ward `"fake"`).
- No integration with an actual staff directory or LDAP.
- Malformed staffIds (no `-`) default to ward `"general"`, creating a silent fallback.

**Fix Required:**
- Validate staffId against an authorized staff list (loaded from environment or config).
- Document the staffId format and ward assignment logic.
- Reject invalid staffIds with a 401 response.

---

### 7. Missing Configuration and Deployment Documentation
**Issues:**
- `STAFF_PASSWORD` is the only environment variable documented. Where is the staff list?
- How should the persistent data directory be configured?
- No startup/deployment guide.
- No mention of port configuration (Express defaults to 3000; is this correct for the ward tablet?).

**Fix Required:** Add deployment guide with:
- Required environment variables
- Persistent data directory setup
- Staff credential format
- Port and network configuration

---

## Minor Issues

### 8. Weak Cookie Security
**File:** `src/server.js:22`

Session cookies are set with `secure: true`, which requires HTTPS. On a ward tablet on a local network, HTTPS may not be configured.

**Risk:** If HTTP is used (likely for simplicity on an isolated tablet network), the `secure` flag is ignored by Express, and cookies are sent over plaintext.

**Mitigation:** Document whether the tablet runs over HTTPS. If HTTP is used, either:
- Set up a self-signed certificate, or
- Remove the `secure: true` flag and add a comment explaining the tablet's network isolation.

---

### 9. Note Truncation Without Notification
**File:** `src/server.js:40`

Notes are silently truncated to 2000 characters:

```javascript
store.addNote({ ward: who.ward, author: who.staffId, body: body.slice(0, 2000) });
```

**Issue:** Users won't know their note was cut off. The client needs to show character count or warn before truncation.

**Fix Required:** Add client-side character counter and pre-save validation.

---

### 10. Timezone Awareness
**File:** `src/store.js:24`

Timestamps are stored as ISO strings but there's no documentation about timezone handling or how the ward tablet's timezone is configured.

**Risk:** Shifts may span midnight; if the tablet's system clock is wrong, note ordering could be incorrect.

**Mitigation:** Document that the tablet's system time must be correct. Consider adding timezone metadata.

---

## Summary of Changes Required Before Ship

| Severity | Issue | Component | Est. Effort |
|----------|-------|-----------|-------------|
| 🔴 Critical | Cross-ward access vulnerability | server.js | 15 min |
| 🔴 Critical | Data loss on reboot | store.js | 1–2 hours* |
| 🔴 Critical | Email spam vulnerability | server.js | 30 min |
| 🔴 Critical | Missing client UI | public/ | 2–3 hours |
| 🟠 Major | No test coverage | test/ | 1 hour |
| 🟠 Major | No staff ID validation | server.js | 30 min |
| 🟠 Major | Missing deployment docs | docs/ | 30 min |

*Depends on choice of persistent storage (file-based vs. database).

---

## Architectural Concerns

1. **No persistence strategy documented:** Store notes in `/tmp`, which is not persistent. Needs a clear design decision on where notes live and how they survive tablet reboots.

2. **Incomplete API contract:** The architecture document doesn't mention the `/api/password-reset` endpoint. Is it in scope?

3. **No error recovery:** If the JSON file is corrupted, the app will crash. Add error handling.

4. **Scalability not addressed:** The `fs.readFileSync()` on every read will fail as notes accumulate. Consider pagination or a real database.

---

## Verification Checklist

- ❌ API returns only notes for the signed-in user's ward
- ❌ Client-side UI is implemented and functional
- ❌ Notes persist across tablet reboots
- ❌ Security tests for cross-ward access
- ❌ Email endpoint is properly authorized/rate-limited (or removed)
- ❌ Staff IDs are validated
- ❌ Deployment guide is complete
- ❌ App has been tested end-to-end on a tablet or browser

---

## Recommendation

**DO NOT SHIP.** This app is incomplete and has critical security and functional gaps:

1. **Security:** Cross-ward access breach and unauthed email endpoint expose the hospital to compliance violations and attacks.
2. **Functionality:** No client code means the app cannot run at all.
3. **Data integrity:** Notes are lost on reboot, negating the core value.

Estimated time to production-ready: **2–3 days** for a small team (security fixes, client implementation, testing, and deployment docs).

---

**Verified:**
- Code structure and architecture (server/store/notes separation)
- Test suite runs successfully
- All documented security boundaries identified
- Functional requirements vs. implementation gaps
- No external dependencies beyond Express (simplicity confirmed)
