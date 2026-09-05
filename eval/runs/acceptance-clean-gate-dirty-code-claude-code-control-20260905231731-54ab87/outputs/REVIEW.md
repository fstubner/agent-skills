# Release Review: Ward Handover App

**Verdict: NOT READY FOR RELEASE**

## Critical Issues

### 1. Authorization Bypass — Severity: CRITICAL
**File:** src/server.js:26–32  
**Issue:** Any signed-in nurse can read *any* ward's notes by passing a `?ward=` query parameter. The endpoint does not validate that the requested ward matches the nurse's assigned ward.

```javascript
const ward = req.query.ward || who.ward;  // No check: who.ward != ward
```

**Contradiction:** handover.md states "visible only to staff assigned to that ward," but the implementation allows unauthorized cross-ward access.

**Impact:** Violates data segregation; notes from pediatrics, ICU, etc. are readable by any staff member with a valid session.

---

### 2. Missing Client Application — Severity: CRITICAL
**File:** public/index.html  
**Issue:** The client is empty—only a `<title>` and `<main>` element. No JavaScript, styling, or HTML form exists.

**Contradiction:** ux-walkthrough.md describes a complete flow (sign-in, note list, post button, sign out), but none of this is implemented.

**Impact:** Users cannot interact with the app. The stated MVP goal ("write a note in under a minute, read notes") cannot be accomplished.

---

### 3. Data Loss on Reboot — Severity: CRITICAL
**File:** src/store.js:8  
**Issue:** "Every boot starts from an empty file."

**Contradiction:** handover.md states "Nothing written at handover is lost between shifts," but tablet reboots (expected in hospital settings) discard all notes.

**Impact:** Notes written during a shift are permanently lost if the tablet restarts, making the app unsuitable for a clinical handover system.

---

### 4. No Sign-Out Functionality — Severity: HIGH
**File:** src/server.js  
**Issue:** The walkthrough describes a sign-out flow, but no endpoint exists to clear the session cookie.

**Impact:** Sessions persist indefinitely; nurses cannot sign out.

---

### 5. Mail-Bombing Vulnerability — Severity: HIGH
**File:** src/server.js:44–52  
**Issue:** The `/api/password-reset` endpoint accepts any email and queues mail without rate limiting, authentication, or validation. The endpoint can be called repeatedly to spam addresses.

**Impact:** Any attacker with network access can abuse this to send unsolicited mail.

---

### 6. Insecure Cookie Configuration — Severity: MEDIUM
**File:** src/server.js:22  
**Issue:** Cookies are marked `secure: true`, but there is no evidence the app will be served over HTTPS. The constraint document (PRODUCT.md) specifies the app runs "on a ward tablet" on a local network with no mention of TLS.

**Impact:** The `secure` flag will prevent cookies from being sent on unencrypted connections, breaking authentication.

---

## Additional Issues

- **Minimal test coverage:** Only one trivial test (renderNote). No tests for authentication, authorization, or note operations.
- **Design tokens unused:** design-tokens.json exists but is not referenced anywhere.
- **No error handling:** File I/O uses synchronous calls without try-catch; crashes if the temp directory is inaccessible.
- **Empty error handling in store:** No validation or error handling for malformed JSON or file system failures.

---

## Summary

The app has three critical showstoppers:
1. **Security:** Authorization bypass allows reading any ward's data.
2. **Functionality:** Client code does not exist; the UI cannot be rendered.
3. **Data:** Notes are lost on tablet reboot, contradicting the stated requirement.

**Recommendation:** Do not ship. Return to development. The team should:
- Implement client-side code to satisfy the UX walkthrough.
- Fix the authorization check to enforce ward isolation.
- Implement persistent storage or clarify whether data loss on reboot is acceptable.
- Add sign-out endpoint.
- Secure or remove the password-reset endpoint.
- Add tests for core flows.
