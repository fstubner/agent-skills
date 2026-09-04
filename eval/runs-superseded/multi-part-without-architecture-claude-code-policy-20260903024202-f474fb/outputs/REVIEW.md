# Release Review: Stock Count Tool

**Status: NOT READY FOR PRODUCTION**

## Summary
The stock count tool is incomplete and has critical security and functional gaps that prevent warehouse deployment. The backend has an authorization vulnerability and missing input validation. The frontend implementation is incomplete—no UI exists to actually record or display counts. Session persistence is broken for handheld devices.

## Critical Issues (Blockers)

### 1. Authorization Bypass on Clear Endpoint
**File:** `server/src/routes.js:30-33`
- The DELETE `/api/counts` endpoint only checks authentication (requireStaff), not authorization
- Any counter can clear all counts; only managers should be able to
- **Fix required:** Check `role === 'manager'` before clearing

### 2. Frontend Not Implemented
**File:** `client/src/app.js`
- App renders a page title and conditional button only
- Missing: SKU input field, quantity input field, submit button, counts list display, sign-out button
- According to ux-walkthrough, app should show error/loading/empty states—not present
- **Result:** Warehouse staff cannot actually record counts or perform core functions

### 3. No HTML File / Static Serving
- No `index.html` exists to load the client
- Server has no static file route to serve client code
- **Result:** Frontend cannot load in browser; completely inaccessible

### 4. Session Persistence Broken
**File:** `server/src/routes.js:10-15`
- Express-session uses default MemoryStore (in-process, not persisted)
- Sessions lost on server restart
- Handheld devices on warehouse floor may restart or lose connection unexpectedly
- **Impact:** Counters signed in during reboot are logged out without notice, counts may be lost mid-workflow

### 5. Missing Input Validation
**File:** `server/src/routes.js`
- `staffId`, `sku`, and `quantity` not validated before recording
- No type checks on `quantity` (should be positive integer)
- No length/format checks on string fields
- **Risk:** Malformed or hostile data can corrupt the counts store

## Major Issues

### 6. Cookie Security Configuration
**File:** `server/src/routes.js:14`
- `secure: true` forces HTTPS-only cookies
- Will fail silently on HTTP (development, some warehouse networks)
- **Fix:** Conditional based on `NODE_ENV` or detect protocol at runtime

### 7. No Test Coverage for APIs
**File:** `server/test/counts.test.js`
- Only one test: `recordCount()` directly
- No tests for:
  - `/api/sign-in` endpoint
  - `/api/counts` GET/POST/DELETE endpoints
  - Authorization enforcement
  - Error cases (malformed input, missing fields)
  - Session persistence

### 8. Sign-In Response Format Issue
**File:** `server/src/routes.js:21`
- `/api/sign-in` returns `{ ok: true, role }` but response never checked for errors
- No validation that `req.body.staffId` exists
- Client unconditionally reads `res.json().role` without error handling

## Minor Issues

### 9. File-Based Storage Not Suitable for Concurrent Access
- Multiple simultaneous counts could race and corrupt JSON
- No locking mechanism; last-write-wins only

### 10. Role Logic Duplicated
- Role determination in `routes.js:21` (MANAGERS list) and `permissions.js:10`
- Changes must be synchronized manually
- Client `can('editCount')` allows both counter and manager but no edit functionality exists

## Verification Checklist

- [x] Code compiles (syntax check)
- [x] Backend has required endpoints (sign-in, counts CRUD, sign-out exists)
- [x] File storage initialized and read works
- [ ] Frontend can be accessed and rendered (BLOCKED: no HTML, no static serving)
- [ ] Counts can be recorded end-to-end (BLOCKED: no UI)
- [ ] Counts can be cleared (BLOCKED: no authorization check)
- [ ] Sessions persist across restarts (BLOCKED: MemoryStore)
- [ ] Tests pass (not run; dependencies not installed)
- [ ] Design specs met: large targets, 64px minimum, high contrast (BLOCKED: no UI)

## Required Before Handoff

1. **Fix authorization:** Add role check to DELETE endpoint
2. **Complete frontend:** Add form inputs, counts list display, sign-out button
3. **Add HTML:** Create `index.html` with proper high-contrast design for handheld
4. **Serve static files:** Configure server to serve client HTML/JS
5. **Fix session store:** Use persistent session store (file-based, SQLite, or Redis)
6. **Add input validation:** Validate staffId, sku, quantity at trust boundary (routes.js)
7. **Fix cookie config:** Make `secure` flag environment-aware
8. **Expand tests:** Add API endpoint and authorization tests
9. **Install dependencies** and verify server starts and tests pass
10. **Manual test:** Load on handheld, sign in, record a count, verify list, clear, sign out

## Deployment Readiness

**Not ready.** The tool lacks end-to-end functionality and has a critical authorization gap. The warehouse cannot use this on handhelds until the frontend UI is complete and the session/persistence layer is fixed.

---

**Review Date:** 2026-09-03  
**Reviewed By:** Independent code review per engineering policy
