# Release Verdict: NOT READY

**Date:** 2026-09-02  
**Status:** ❌ Do not deploy  
**Recommendation:** Halt deployment; significant work required before food bank use.

---

## Executive Summary

The volunteer shifts tool is incomplete and not fit for production. Core functionality required by the MVP is missing: volunteers cannot see available shifts or sign themselves up. The UI is unimplemented, authentication is absent, and critical authorization checks are missing. The tool cannot serve the stated purpose of enabling volunteers to fill gaps independently.

---

## Critical Blocking Issues

### 1. **User-Facing API Mismatches MVP Requirements**

**Problem:** The API restricts shift visibility and assignment to coordinators only.

- `/api/shifts` endpoint requires `requireCoordinator` middleware (line 25)
- `/api/shifts/:id/assign` requires `requireCoordinator` (line 29)
- Volunteers have no endpoint to view available shifts
- Volunteers have no endpoint to sign themselves up for shifts
- Volunteers cannot cancel their own sign-ups (unassign requires coordinator role, line 34)

**Why this matters:** Product spec (PRODUCT.md) states:
> "A volunteer can see which shifts still need cover and sign up for one themselves"

The current implementation contradicts this. Only coordinators can interact with shifts via the API.

**Evidence:** 
- Line 25-27 in src/server.js: shift data only accessible with coordinator role
- No volunteer sign-up endpoint exists
- No volunteer self-service unassign endpoint exists

---

### 2. **Empty UI Implementation**

**Problem:** `public/index.html` contains only a title and placeholder div.

```html
<!doctype html><title>Volunteer shifts</title><main id="app"></main>
```

No interactive elements, forms, or shift display. The design direction specifies phone-optimized UI with 56px tap targets and 18px minimum type, but no HTML or JavaScript implements this.

**Why this matters:** Users (volunteers on phones, coordinator on laptop) have nothing to click. The tool is non-functional from a user perspective.

---

### 3. **No Authentication Mechanism**

**Problem:** Sign-in endpoint trusts client-supplied credentials without validation.

```javascript
// src/server.js, lines 19-22
app.post('/api/sign-in', (req, res) => {
  req.session.userId = req.body.userId;
  req.session.role = req.body.role === 'coordinator' ? 'coordinator' : 'volunteer';
  res.json({ ok: true });
});
```

Any client can:
- Claim any userId
- Claim coordinator role by sending `role: "coordinator"` in the request body
- Access all protected endpoints (shifts, assign, unassign) without verification

**Why this matters:** A volunteer can impersonate the coordinator and make unauthorized assignments/unassignments. There is no trust boundary enforcement.

---

### 4. **Missing Input Validation at Trust Boundary**

**Problem:** No validation of `userId` or `volunteerId` before writing to state.

The assign function (line 31) writes any `volunteerId` the client sends directly to the datastore. Combined with the authentication gap, this allows malformed or malicious data.

---

## Major Issues

### 5. **Test Suite Doesn't Clean Up State**

**Problem:** Tests in `test/shifts.test.js` don't reset data between runs.

```javascript
test('a volunteer cannot be assigned to two shifts at the same time', () => {
  assign('sh1', 'v9');  // Mutates global state
  const state = needingCover();
  assert.ok(!state.some((s) => s.id === 'sh1'));
  unassign('sh1');      // Cleanup at end of test
});
```

The second test calls `assign('sh1', 'v9')` and `unassign('sh1')` to clean up, but:
- If a test fails partway through, cleanup doesn't run
- Tests depend on initial state (seeded in `seed()` function)
- Running tests multiple times can leave stale `.data/shifts.json`

**Why this matters:** Test results are unreliable. A failing test may appear to pass on retry.

---

### 6. **Cookie Security Setting Incompatible with Development**

**Problem:** Session cookies set `secure: true` (line 12), requiring HTTPS.

```javascript
cookie: { httpOnly: true, sameSite: 'lax', secure: true },
```

In local development or over HTTP, browsers reject the cookie. This breaks the application during testing and initial use.

**Fix:** Use `secure: process.env.NODE_ENV === 'production'` or similar.

---

### 7. **Shift Conflict Logic Lacks Validation**

**Problem:** The clash detection at line 35 compares `s.startsAt` string values:

```javascript
const clash = state.shifts.some((s) => s.assignedTo === volunteerId && s.startsAt === shift.startsAt);
```

If `startsAt` is malformed or varies in format (e.g., `"2026-09-02T09:00"` vs `"2026-09-02T09:00:00"`), the clash detection may fail silently. The code does not validate `startsAt` format.

---

## Minor Issues

### 8. **No CSRF Protection**

State-changing endpoints (assign, unassign, sign-out) use POST but have no CSRF token validation. An attacker could forge requests from another domain.

### 9. **Incomplete Error Handling**

- Unassign returns 404 if shift not found but assign returns 409 for conflicts. Error codes are inconsistent.
- No logging of errors or state changes.
- No error messages in responses to help debugging.

### 10. **Architecture and Product Requirements Misalignment**

The ARCHITECTURE.md states:
> "Assignment is a coordinator action. Volunteers do not write to the rota."

But PRODUCT.md requires:
> "A volunteer can see which shifts still need cover and sign up for one themselves"

These are contradictory. The architecture assumes volunteers are passive, but the product requires self-service sign-up.

---

## What Works Well

- **Datastore choice:** JSON file is appropriate for one food bank with ~3 shifts/day
- **Shift conflict detection:** Core logic correctly prevents double-booking at the same time
- **Session configuration:** httpOnly and sameSite flags are correct security practice (except for secure flag issue)
- **Code organization:** src/ and test/ structure is clear; single-writer pattern for `.data/` is sound

---

## Verification Performed

✓ Reviewed PRODUCT.md requirements against API endpoints  
✓ Analyzed authentication and authorization flows  
✓ Inspected data validation and persistence logic  
✓ Examined test suite design and isolation  
✓ Checked UI/HTML implementation status  
✓ Verified cookie security settings  
✓ Traced shift conflict detection algorithm  
✓ Compared ARCHITECTURE.md against product requirements  

---

## Required Work Before Deployment

**Blocker (must fix):**
1. Implement full UI in `public/index.html` with volunteer sign-up and self-service unassign
2. Add volunteer-facing API endpoints for shift discovery and self-assignment
3. Implement real authentication (e.g., PIN-based or pre-shared keys per volunteer)
4. Add input validation for userId, volunteerId, and shiftId
5. Fix cookie secure flag for development environments

**High Priority:**
6. Fix test suite with proper state cleanup between tests
7. Add CSRF token validation to state-changing endpoints
8. Implement logging for all state mutations
9. Validate and normalize `startsAt` format across all operations

**Medium Priority:**
10. Add comprehensive error messages to API responses
11. Add volunteer-facing UI for "no available shifts" state
12. Document authentication mechanism for deployment
13. Add end-to-end test covering volunteer sign-up workflow

---

## Recommendation

**Do not deploy.** The tool lacks core user-facing functionality, has significant security gaps, and is untested in realistic conditions. The gap between product requirements (self-service volunteer sign-up) and implementation (coordinator-only control) is fundamental, not an incremental fix.

Estimated effort to production-ready: 3–4 days of focused development (UI, authentication, volunteer API, test suite overhaul, security fixes).
