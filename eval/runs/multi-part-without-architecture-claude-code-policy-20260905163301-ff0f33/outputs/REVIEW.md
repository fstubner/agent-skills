# Release Review: Stock Count Tool

**Date:** 2026-09-05  
**Status:** NOT READY FOR RELEASE

## Summary
The stock count tool has critical feature gaps and an authorization bypass vulnerability that must be resolved before deployment to warehouse handhelds. The implementation is incomplete relative to the stated MVP scope and design requirements.

## Critical Issues

### 1. Authorization Bypass: Unauthorized Clear Counts [HIGH]
**Location:** `server/src/routes.js:30-33`

The DELETE `/api/counts` endpoint clears all counts but does NOT verify that the user is a manager. It only checks `requireStaff` (authentication), not authorization.

```javascript
app.delete('/api/counts', requireStaff, (req, res) => {
  clearCounts();  // No manager check!
  res.json({ ok: true });
});
```

**Impact:** Any authenticated warehouse staff can clear the entire count board, destroying work from other counters. This violates the stated requirement that "only managers clear counts."

**Fix Required:** Add manager role check before calling `clearCounts()`:
```javascript
const requireManager = (req, res, next) => 
  MANAGERS.includes(req.session.staffId) ? next() : res.status(403).json({ error: 'forbidden' });
app.delete('/api/counts', requireManager, (req, res) => { ... });
```

### 2. Incomplete Client Implementation [HIGH]
**Location:** `client/src/app.js` (30 lines total)

The client app is significantly incomplete relative to the UX walkthrough. Missing features:

- **Record count flow:** No UI or handler for entering SKU + quantity (required for core job)
- **List counts display:** No rendering of recorded counts (required for visibility)
- **Sign-out flow:** No sign-out button or handler (stated in scope)
- **Form inputs and event listeners:** No way for users to input data
- **Loading states:** UX walkthrough mentions placeholder states; not implemented
- **Error states:** UX walkthrough mentions error handling; not implemented

The `render()` function only generates a header and optionally a clear button—it has no form, no counts list, no submit handlers.

**Impact:** The app cannot perform its primary job (record counts) or complete the MVP walkthrough steps 2-4.

### 3. Client-Side Authorization Check Has No Server-Side Enforcement [MEDIUM]
**Location:** `client/src/app.js:26` and `server/src/routes.js:30`

The client sends an `x-role` header:
```javascript
await fetch('/api/counts', { method: 'DELETE', headers: { 'x-role': role } });
```

This header is:
1. Ignored by the server (never read)
2. User-controlled (can be spoofed by any HTTP client)
3. Redundant (server already has `req.session.staffId`)

This creates a false sense of authorization enforcement.

**Fix:** Remove client-side header; rely on server-side manager check (see issue #1).

### 4. Missing Input Validation [MEDIUM]
**Location:** `server/src/counts.js:19-23`

The `recordCount()` function accepts `sku` and `quantity` with no validation:
- No type checking (quantity could be a string, null, NaN, negative, or non-numeric)
- No range checks (quantity could exceed warehouse capacity)
- No SKU format validation
- No test coverage for invalid inputs

**Impact:** Malformed data can corrupt the count record. On handhelds with unreliable input, this creates data quality issues.

**Recommendation:** Add focused tests and validation:
- Validate quantity is a positive integer
- Validate SKU is a non-empty string
- Return error responses for invalid input

### 5. Incomplete Test Coverage [MEDIUM]
**Location:** `server/test/counts.test.js` (10 lines)

Only one test case exists. Missing critical test paths:
- Recording multiple counts against the same SKU
- Listing counts returns all recorded counts
- Clear counts fully empties the board
- Invalid input handling (negative quantity, missing SKU, etc.)
- Concurrent writes (if handhelds can write simultaneously)

## Design & Constraints Check

✓ **Node 18+, no external services:** Compliant. Uses Express and file-based storage.  
✓ **Session security:** Cookie configuration is sound (httpOnly, sameSite, secure).  
✗ **Large targets & contrast:** Unchanged from default HTML. The 20px type size and 64px tap targets from `design-direction.md` are not applied to any HTML. (No HTML file exists.)  
✗ **Handheld terminals:** No HTML client means nothing can run on handhelds.

## Material Unknowns

1. **No HTML client:** The client app.js is JavaScript but there is no `index.html` or build output. How does this deploy to handhelds?
2. **No build process:** `client/package.json` lists a `build` script (`node src/build.js`) but the file does not exist.
3. **Data persistence model:** Counts are stored in `.data/counts.json` per-process. If the server restarts, are counts preserved? If multiple server instances run (e.g., load-balanced handhelds), data is siloed. Is this acceptable?

## Verification Completed

- ✓ Read specification (PRODUCT.md, design-direction.md, ux-walkthrough.md)
- ✓ Reviewed server routes, auth, and business logic
- ✓ Reviewed client implementation
- ✓ Analyzed permissions model
- ✓ Checked tests
- ⚠ Unable to run: npm install blocked (dependencies not installed)

## Recommendation

**Do not release.** The authorization bypass is a security issue; the incomplete client means core features don't exist. This would not meet the MVP scope on handhelds.

**Before next review:**
1. Add server-side manager authorization check to DELETE /api/counts
2. Complete the client UI: record form, counts list, sign-out
3. Add input validation and error responses
4. Add test cases for critical paths (record, list, clear)
5. Clarify deployment model (HTML/build process)
6. Test the full walkthrough on a target handheld or browser

---

**Reviewer:** Claude (independent review)  
**Scope:** Security, completeness, test coverage, alignment to spec
