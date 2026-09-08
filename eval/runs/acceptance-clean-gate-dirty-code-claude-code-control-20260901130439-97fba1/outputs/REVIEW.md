# Release Review

## VERDICT: NOT READY TO SHIP

### Critical Blockers

#### 1. Missing Client Code (Blocker)
**Severity:** CRITICAL

The application cannot function. The public/index.html is a bare skeleton with no JavaScript implementation:
```html
<!doctype html><title>Shift notes</title><main id="app"></main>
```

- No sign-in form
- No note list UI
- No note creation form
- No API client code
- No styling applied

The server API endpoints exist and are partially functional, but there is no client to interact with them. Users cannot sign in, write notes, or read notes. This is a complete blocker.

#### 2. Cross-Ward Notes Access Vulnerability (Blocker)
**Severity:** CRITICAL - Privacy & Security

The `/api/notes` endpoint allows any signed-in nurse to read any ward's notes, violating documented security requirements.

**Violates:** `docs/handover.md` states "Notes are kept per ward and are visible only to staff assigned to that ward."

**Issue Location:** `src/server.js`, lines 26-33
```javascript
app.get('/api/notes', (req, res) => {
  const who = session(req);
  if (!who) return res.status(401).json({ code: 'no_session', message: 'Sign in first' });
  const ward = req.query.ward || who.ward;  // ← Allows any ward to be queried
  res.json({ notes: store.notesFor(ward).map(renderNote) });
});
```

The code even admits this in a comment: "Any signed-in nurse can read any ward's notes by asking for it."

**Required Fix:** Enforce that a nurse can only read notes from their own ward. Compare the requested ward against `who.ward` and return 403 if they don't match.

### Issues (Non-Critical)

#### 3. Password Reset Endpoint (Out of MVP Scope)
**Severity:** MEDIUM

The `/api/password-reset` endpoint (lines 44-52) sends mail to any email address supplied without validation. However, this endpoint is not part of MVP scope, and the handover.md specifies no password reset functionality. This endpoint should be removed from the shipping version or disabled.

#### 4. Insufficient Test Coverage
**Severity:** LOW

Only one unit test exists (`test/notes.test.js`), which tests basic note rendering. Critical paths are untested:
- Session validation and creation
- Ward access control (once fixed)
- Note storage and retrieval
- Input validation

### Items Verified
- Server architecture and session handling
- API endpoint definitions and request validation
- Access control logic (found to be broken)
- Persistence layer (store.js)
- Documentation requirements (handover.md, ux-walkthrough.md, PRODUCT.md)
- Client delivery mechanism (public/index.html - found incomplete)
- Dependencies and build configuration

### Recommendation
Do not ship until:
1. **Client JavaScript is implemented** with full sign-in, note list, and note creation UI matching design tokens and UX walkthrough
2. **Ward access control is fixed** to prevent cross-ward note reading
3. **Password reset endpoint is removed** or disabled (if not in scope)
