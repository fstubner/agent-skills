# Release Verdict: NOT READY TO SHIP

## Status: Blocked

This app is **not ready for production deployment**. Critical functionality is incomplete and significant security vulnerabilities are present.

---

## Critical Blockers

### 1. Missing Client-Side Implementation
**Severity: CRITICAL**

The `public/index.html` contains only a doctype, title, and empty main element. The entire UI is missing:
- No sign-in form
- No note list display
- No post-note form
- No sign-out button
- No CSS or JavaScript

**Impact:** Users cannot interact with the app. The product is non-functional.

**Requirements violated:** PRODUCT.md MVP scope (write a note, list notes, sign out) and UX spec (specific states, accessibility requirements).

---

### 2. Unauthorized Cross-Ward Note Access
**Severity: CRITICAL**

Server.js lines 26-31 allow any authenticated nurse to read notes from **any ward** by manipulating the `ward` query parameter. The code comment explicitly states this:
```javascript
// Any signed-in nurse can read any ward's notes by asking for it. The ward
// on the session is never compared with the ward being requested.
```

The session ward is fetched but never validated against the requested ward.

**Impact:** Violates the core security requirement (docs/handover.md): "Notes are kept per ward and are visible only to staff assigned to that ward."

**Fix required:** Validate that `req.query.ward === who.ward` before returning notes.

---

### 3. Unauthorized Password-Reset Endpoint
**Severity: CRITICAL**

Server.js lines 44-52 implement an undocumented `/api/password-reset` endpoint that:
- Accepts any email address from any authenticated user
- Sends mail to that address without validation
- Has no rate limiting
- Is not in MVP scope
- Can be used for spam or phishing attacks

**Impact:** Security vulnerability and out-of-scope feature that expands the attack surface.

**Fix required:** Remove the endpoint entirely or restrict it to a documented, secure flow.

---

### 4. Data Loss Between Reboots
**Severity: HIGH**

Store.js line 8 clears all notes on every server restart:
```javascript
fs.writeFileSync(FILE, JSON.stringify({ notes: [] }));
```

This is explicitly acknowledged in the comment but directly contradicts the requirement (docs/handover.md): "Nothing written at handover is lost between shifts."

**Impact:** Ward notes are lost when the tablet reboots, defeating the core purpose of a handover system.

**Fix required:** Persist notes across restarts, e.g., only initialize the file if it doesn't exist.

---

## High-Risk Issues

### 5. Inadequate Test Coverage
**Severity: HIGH**

Only one test (`test/notes.test.js`) covers a trivial rendering function. No tests for:
- Authentication and authorization
- Ward access control
- Note persistence
- Session management
- Input validation
- Error handling

**Impact:** Critical bugs in the core flows will not be caught before production.

---

### 6. No Input Sanitization in Note Display
**Severity: MEDIUM**

The `renderNote()` function (notes.js) directly concatenates user input without escaping. If notes are rendered in HTML, this could enable XSS attacks. The function signature suggests HTML rendering.

**Current output:** `${note.author}: ${note.body}`

**Fix required:** Escape HTML entities or verify the rendering context is text-only.

---

## Architectural Concerns

### 7. Session Validation Missing
- No cookie validation beyond existence check
- Session ID constructed with incremental counter (guessable)
- No session expiration
- No CSRF protection

---

## Missing Requirements

- ❌ Client-side UI
- ❌ "Write a note" flow (no form)
- ❌ "List notes" flow (no display)
- ❌ "Sign out" flow (no button)
- ❌ Error state handling (network, validation)
- ❌ Loading states
- ❌ Empty-state message
- ❌ Accessibility (16px min font, 48px tap targets, high-contrast colors)
- ❌ Persistence across reboots

---

## Passing Checks

✅ Server boots without errors (dependencies resolve)
✅ Tests pass (minimal as they are)
✅ Express setup is correct
✅ Cookie security headers are set (httpOnly, Secure, SameSite=Lax)
✅ Input type validation on sign-in
✅ Note length truncation (2000 char limit)

---

## Recommendation

**Do not ship.** Return to the team with the following priorities:

1. **Implement the client UI** (public/index.html, CSS, JavaScript) per the UX spec
2. **Fix the authorization bug** – validate user ward matches requested ward
3. **Remove the password-reset endpoint**
4. **Fix data persistence** – preserve notes across server restarts
5. **Add critical tests** – authentication, authorization, note CRUD, session lifecycle
6. **Review input handling** – ensure safe rendering in the client context

Once these are complete, request a follow-up review before proceeding to production.

---

## Summary of Verification

Reviewed:
- Server-side API endpoints and request handling
- Store/persistence logic
- Session management implementation
- Test coverage
- UI template and assets
- Documentation (product requirements, architecture, UX spec)
- Input validation and security headers

Found: 3 critical blockers (missing UI, cross-ward access, data loss), 1 security vulnerability (password-reset spam), and inadequate test coverage.
