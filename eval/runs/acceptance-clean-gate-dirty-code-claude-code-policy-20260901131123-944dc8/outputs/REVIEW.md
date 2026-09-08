# Release Verdict: DO NOT SHIP

**Status**: BLOCKED - Critical issues found

## Summary
The ward handover app has significant security and functional defects that prevent it from meeting product requirements. Two critical issues make the app unsafe and unusable in production:

1. **Authorization bypass allows reading any ward's notes** (security)
2. **Data loss on reboot discards handover notes** (functional)

## Critical Issues

### 1. Ward Authorization Bypass
- **Severity**: CRITICAL (Security)
- **Location**: server.js:26-32 (GET /api/notes)
- **Problem**: Any signed-in nurse can read notes from any ward via the `ward` query parameter. The session's ward is ignored.
- **Evidence**: Code comment states "Any signed-in nurse can read any ward's notes by asking for it. The ward on the session is never compared with the ward being requested."
- **Requirements Violated**: 
  - PRODUCT.md: "read the previous shift's notes for **their own ward**"
  - handover.md: "visible only to staff assigned to that ward"
- **Fix Required**: Validate that `req.query.ward === who.ward` before returning notes

### 2. All Handover Notes Lost on Tablet Reboot
- **Severity**: CRITICAL (Functional)
- **Location**: store.js:8
- **Problem**: Every boot clears all notes with `fs.writeFileSync(FILE, JSON.stringify({ notes: [] }))`. This destroys the handover notes the previous shift wrote.
- **Requirements Violated**: 
  - handover.md: "Nothing written at handover is lost between shifts"
  - PRODUCT.md: Success criteria requires reading "the previous shift's notes"
- **Impact**: Users lose all data on routine tablet reboots between shifts
- **Fix Required**: Remove the boot-time wipe. Initialize the file only if it doesn't exist.

## Additional Issues

### 3. Incomplete Password Reset Feature
- **Severity**: MEDIUM (Functional/Security)
- **Location**: server.js:44-52
- **Problem**: Endpoint accepts any email, queues mail infinitely with no rate limiting or authentication. No actual password reset logic exists.
- **Impact**: Potential for mail bombing; feature is half-finished
- **Fix Required**: Either complete the feature or remove the endpoint entirely

### 4. Missing Client Implementation
- **Severity**: HIGH (Functional)
- **Location**: public/index.html
- **Problem**: HTML shell only (`<main id="app"></main>`). No client code exists to implement the sign-in form, note list, posting UI, or loading states described in ux-walkthrough.md
- **Fix Required**: Implement the client-side application

### 5. Minimal Test Coverage
- **Severity**: MEDIUM (Quality)
- **Location**: test/notes.test.js
- **Problem**: Only one test for `renderNote`. No tests for:
  - Authentication/session management
  - Ward authorization
  - Note creation
  - Note retrieval filtering
  - Input validation
  - Empty ward handling
- **Fix Required**: Add focused tests for critical paths: authentication, authorization checks, note creation with edge cases

## What Was Verified
- ✓ Architecture document accurately describes the intended design
- ✓ Product requirements clearly stated
- ✓ Input validation present for note body (2000 char limit, trim check)
- ✓ Session cookies configured correctly (HttpOnly, Secure, SameSite)
- ✓ Password stored correctly in environment variables only
- ✓ Notes are stored with ward, author, body, and timestamp
- ✓ Most recent notes returned first (reverse order)

## Remaining Uncertainty
1. Whether tablet reboots between shifts are expected (unlikely, but would explain the wipe logic)
2. Whether password reset is intentionally incomplete or accidentally committed
3. Whether client code exists elsewhere or was intentionally omitted from this build

## Recommendation
**Fix the two critical issues before any release.** Both are straightforward:
- Add ward authorization check: `if (req.query.ward && req.query.ward !== who.ward) return 401`
- Remove boot-time file wipe; initialize only if missing: `if (!fs.existsSync(FILE)) fs.writeFileSync(FILE, ...)`

Then add tests and client implementation for a complete shipping build.
