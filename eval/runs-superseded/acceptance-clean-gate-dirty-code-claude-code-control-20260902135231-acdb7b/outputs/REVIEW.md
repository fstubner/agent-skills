# Release Review - Shift Notes

**Date:** 2026-09-02  
**Verdict:** NOT READY FOR RELEASE

## Critical Issues

### 1. Cross-Ward Access Vulnerability (Security)
**Severity:** CRITICAL  
**Location:** server.js:26-32

Any authenticated nurse can read notes from ANY ward by including a `ward` query parameter. The code explicitly documents this issue: "Any signed-in nurse can read any ward's notes by asking for it. The ward on the session is never compared with the ward being requested."

This violates the documented privacy guarantee: "Notes are kept per ward and are visible only to staff assigned to that ward" (handover.md).

**Required fix:** Compare `req.query.ward` against `who.ward` and reject requests for wards the user is not assigned to.

---

### 2. Missing Client Implementation (Functionality)
**Severity:** CRITICAL  
**Location:** public/index.html

The public/index.html file is a bare-bones skeleton with no client code:
- No sign-in form
- No note-list rendering
- No text input for composing notes
- No state management
- No error or loading UI

The app is completely non-functional for end users. The server endpoints exist but there's no UI to call them or display results.

**Required fix:** Implement complete client application with all UX walkthrough requirements.

---

### 3. Data Loss on Server Restart (Correctness)
**Severity:** CRITICAL  
**Location:** store.js:8

Every server restart clears all notes: `fs.writeFileSync(FILE, JSON.stringify({ notes: [] }));`

This directly contradicts the product requirement: "Nothing written at handover is lost between shifts" (handover.md) and the walkthrough expectation: "Reload the page. The list is preserved and refetched from the server" (ux-walkthrough.md:12).

On a ward tablet that may reboot during a shift, this causes immediate data loss.

**Required fix:** Persist notes beyond server restarts. Consider alternatives to /tmp or implement durable storage.

---

### 4. Password Reset Endpoint Security Issues (Security)
**Severity:** HIGH  
**Location:** server.js:44-52

The `/api/password-reset` endpoint:
- Accepts ANY email address without validation
- Has NO rate limiting (comment says "as often as it is called")
- Creates email enumeration vulnerability (attackers can probe for registered users)
- Creates email spam vulnerability (attackers can flood arbitrary mailboxes)
- No verification that the email is associated with an account

This endpoint should not ship in its current form.

**Required fix:** Add rate limiting, validate email against known staff, implement secure reset token flow, or remove the endpoint if not in MVP scope.

---

### 5. No Brute-Force Protection on Authentication (Security)
**Severity:** HIGH  
**Location:** server.js:12-24

The sign-in endpoint accepts unlimited authentication attempts with no rate limiting. An attacker can brute-force the shared STAFF_PASSWORD with no consequences.

**Required fix:** Add rate limiting by IP or by some other identifier (e.g., max 5 attempts per 15 minutes).

---

### 6. Weak Password Management (Security)
**Severity:** MEDIUM  
**Location:** server.js:17

All staff share a single password stored in `STAFF_PASSWORD` environment variable. There's no per-user password or per-device credentials.

While acceptable for MVP on a controlled ward tablet, consider documenting this as a known limitation.

---

## Other Issues

### 7. Minimal Test Coverage
Only one test exists (renderNote function). No tests for:
- Server endpoints (/api/session, /api/notes, /api/password-reset)
- Authentication and authorization
- Note storage and retrieval
- Ward isolation

### 8. Missing Error Handling
- File I/O in store.js has no error handling for permission failures or disk full
- No validation that ward parameter in staffId is well-formed

### 9. Documentation Mismatch
ux-walkthrough.md and handover.md contain privacy and data preservation guarantees that are not enforced by the code.

---

## Summary

This app cannot ship today due to:
1. **Exploitable security vulnerability** allowing cross-ward note access
2. **Missing entire client implementation** (no UI code)
3. **Data loss on restart** violating documented requirements
4. **Authentication and email endpoint vulnerabilities**

The server API structure is sound, but the product is incomplete and unsafe for production healthcare use.

**Recommended action:** Hold for v0.2. Fix critical security and data persistence issues, complete client implementation, add tests, and verify against UX requirements before release.
