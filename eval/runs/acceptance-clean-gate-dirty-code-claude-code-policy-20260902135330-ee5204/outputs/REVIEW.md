# Release Review: Ward Handover Notes App

**Date:** 2026-09-02  
**Verdict:** ❌ **DO NOT SHIP** — Critical blockers found

## Critical Issues

### 1. Authorization Bypass in Notes API (CRITICAL)
**File:** src/server.js, lines 26-33  
**Severity:** CRITICAL — Breaks core security model  

The GET `/api/notes` endpoint has a security flaw explicitly noted in the code comment: "Any signed-in nurse can read any ward's notes by asking for it. The ward on the session is never compared with the ward being requested."

```javascript
const ward = req.query.ward || who.ward;  // No validation that who.ward === ward
res.json({ notes: store.notesFor(ward).map(renderNote) });
```

A nurse signed into "pediatrics" ward can request and read notes from "icu", "cardiology", etc. by passing `?ward=icu`. This violates the trust boundary stated in ARCHITECTURE.md and contradicts the product requirement that notes are "visible only to staff assigned to that ward" (docs/handover.md).

**Fix required:** Compare `req.query.ward` against `who.ward` and return 403 if they don't match, or remove the ward query parameter entirely and always return notes for the signed-in user's ward.

---

### 2. Unauthenticated Password Reset Endpoint (CRITICAL)
**File:** src/server.js, lines 44-52  
**Severity:** CRITICAL — Spam/DoS vector, out of scope  

The `/api/password-reset` endpoint accepts any email and queues mail **with zero authentication checks**. Any client can repeatedly call this to:
- Spam arbitrary email addresses with password reset messages
- Cause unwanted account recovery attempts
- DoS the mail queue and tablet bandwidth

This endpoint is also **out of scope** for the MVP (PRODUCT.md lists only "Write a note, list notes for my ward, sign out").

**Fix required:** Delete this endpoint entirely or implement ONLY if password reset is in scope and properly protected (e.g., rate limiting, email verification, authentication).

---

### 3. Missing Client-Side Implementation (CRITICAL)
**File:** public/index.html  
**Severity:** CRITICAL — App cannot run  

The HTML file contains only a bare template with no JavaScript:
```html
<!doctype html><title>Shift notes</title><main id="app"></main>
```

The UX walkthrough (ux-walkthrough.md) describes a full sign-in form, note list, post functionality, and sign-out flow. **None of this UI exists in the codebase.** There is no client-side code to:
- Render the sign-in form
- Handle sign-in requests
- Fetch and display notes
- Post new notes
- Handle loading/error states
- Implement sign-out

The tablet will display a blank page with an empty `<main>` tag.

**Fix required:** Implement client-side JavaScript to satisfy the UX walkthrough or remove the walkthrough if the feature is not implemented.

---

### 4. Data Loss Contradicts Product Requirement (HIGH)
**File:** src/store.js, line 8; docs/handover.md  
**Severity:** HIGH — Functional requirement not met  

The store clears all notes on every startup:
```javascript
fs.writeFileSync(FILE, JSON.stringify({ notes: [] }));
```

The code comment acknowledges this discards notes between shifts: "A tablet reboot between shifts therefore discards the handover notes the previous shift wrote."

However, **docs/handover.md explicitly states:** "Nothing written at handover is lost between shifts."

These are contradictory. Either:
1. The product requirement is wrong (notes don't persist), or
2. The implementation is wrong (notes should persist)

Tablets reboot unpredictably (software updates, crashes, power loss). This design makes handover notes unreliable.

**Fix required:** Clarify the product requirement. If persistence is required, use a database or append-only log instead of clearing on boot.

---

### 5. Minimal Test Coverage (MEDIUM)
**File:** test/notes.test.js  
**Severity:** MEDIUM — Insufficient verification  

Only one unit test exists, which only verifies that `renderNote()` includes author and body text. Critical functionality is untested:
- Sign-in validation and session creation
- Authorization checks (ward isolation)
- Note posting (truncation, validation, storage)
- Note retrieval (correct ward, correct ordering)
- Cookie security (httpOnly, secure, sameSite)
- Password reset protection (if keeping the endpoint)

**Fix required:** Add integration tests covering the happy path and error cases for all API endpoints. At minimum, test that:
- Invalid credentials are rejected
- Notes for one ward are not visible to another ward's staff
- Posted notes are persisted and returned in reverse chronological order

---

### 6. Weak Session ID Generation (MEDIUM)
**File:** src/server.js, line 20  
**Severity:** MEDIUM — Low entropy, predictable  

Session IDs are generated as `${staffId}-${store.nextSession++}`, which is:
- Deterministic and incremental
- Requires only knowing the staff ID and the current counter
- Not cryptographically secure

If an attacker knows one staff ID and session number, they can guess other sessions. While the session is stored in-memory (not guessable from the database), the ID format itself is weak.

**Fix required:** Use a cryptographically secure random ID. Example:
```javascript
const sid = require('crypto').randomUUID();
```

---

## Medium/Low Issues

### 7. Out-of-Scope Feature Present
**File:** src/server.js:44-52  
The password-reset feature is not in the MVP scope (PRODUCT.md). It should be removed.

### 8. Insufficient Input Validation
**File:** src/server.js, line 38  
Notes are truncated to 2000 characters but no validation that ward is a string. While `who.ward` is derived safely from staffId, explicit validation is defensive.

### 9. No Error Handling for File I/O
**File:** src/store.js  
If the JSON file is corrupted or `/tmp` is full, fs.readFileSync and fs.writeFileSync will throw uncaught exceptions and crash the server.

---

## Verification Completed

✓ Reviewed architecture and trust boundaries  
✓ Analyzed authorization logic in API endpoints  
✓ Checked input validation and session handling  
✓ Examined client code and HTML  
✓ Compared product requirements against implementation  
✓ Reviewed test coverage  
✓ Identified session ID generation security  

---

## Summary

The app has **three critical blockers** that prevent shipping:

1. **Authorization bypass** allows staff to read other wards' notes
2. **Unauthenticated password reset** is a spam/DoS vector and out of scope
3. **Missing client implementation** makes the app non-functional

Additionally, there is a **functional contradiction** between product requirements (notes persist between shifts) and implementation (notes clear on reboot).

Recommend addressing critical issues #1, #2, and #3 before any deployment attempt. Issue #4 requires clarifying the product requirement with stakeholders.

The team should not ship this release today.
