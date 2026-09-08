# Release Review — Volunteer Shifts Tool

**Date:** 5 September 2026  
**Verdict:** ❌ **NOT READY FOR PRODUCTION**

## Critical Issues

### 1. Authentication Missing (Security Critical)
**File:** `src/server.js:19-23`  
**Severity:** CRITICAL

The `/api/sign-in` endpoint accepts `userId` and `role` directly from the request body without any validation, authentication, or credential verification. Any HTTP client can claim to be the coordinator by sending `{"role": "coordinator"}`.

```javascript
app.post('/api/sign-in', (req, res) => {
  req.session.userId = req.body.userId;
  req.session.role = req.body.role === 'coordinator' ? 'coordinator' : 'volunteer';
  res.json({ ok: true });
});
```

**Impact:** Unauthorized access to coordinator functions (assign/unassign shifts). The entire authorization model fails.

**Required Fix:** Implement proper authentication (e.g., password verification, pre-registered users, or external identity service).

---

### 2. Missing User Interface
**File:** `public/index.html`  
**Severity:** CRITICAL

The HTML is a 69-byte shell with no implementation:
```html
<!doctype html><title>Volunteer shifts</title><main id="app"></main>
```

No JavaScript is present to:
- Render the sign-in form
- Display shifts needing cover
- Handle volunteer sign-ups/cancellations
- Display coordinator view with volunteer names
- Make API calls

**Impact:** The product is non-functional. Users cannot interact with it.

**Required Fix:** Implement the complete UI as specified in `ux-walkthrough.md` and `design-direction.md`.

---

### 3. Incomplete Volunteer Feature Implementation
**File:** `src/server.js` (missing endpoints)  
**Severity:** HIGH

The server only provides endpoints for coordinator operations. According to PRODUCT.md MVP scope, volunteers should:
1. See which shifts still need cover
2. Sign up for shifts themselves
3. Cancel their own sign-ups

Current endpoints only support coordinator assignment. There are no volunteer-facing endpoints or UI.

**Required Fix:** Add endpoints for:
- `GET /api/shifts` (volunteer view: only uncovered shifts, no names)
- `POST /api/shifts/:id/volunteer-sign-up` with volunteer userId
- `POST /api/shifts/:id/volunteer-cancel`

---

## Major Issues

### 4. HTTPS Requirement Not Documented
**File:** `src/server.js:12`  
**Severity:** MEDIUM

The session cookie is set with `secure: true`, which requires HTTPS. The product will not work over HTTP.

**Current State:** No deployment docs mention HTTPS requirement.

**Impact:** Local development and HTTP deployments will fail silently (sessions won't persist).

**Required Fix:** Add deployment documentation requiring HTTPS in production. For development, make secure configurable.

---

### 5. File-Based Datastore Race Conditions
**File:** `src/shifts.js`  
**Severity:** MEDIUM

The JSON file datastore is not transactional. Multiple concurrent requests can:
- Read stale data (load → load → modify → save → save, losing the first modification)
- Corrupt the file state

With only 3 shifts per day, concurrent requests are possible when multiple volunteers/coordinators access the system.

**Current State:** No locking mechanism.

**Impact:** Lost assignments or unassignments under concurrent load.

**Required Fix:** Implement file locking or use an in-memory cache with synchronous file I/O, or migrate to a proper database.

---

## Minor Issues

### 6. No Error Handling in Datastore
**File:** `src/shifts.js:7`  
**Severity:** LOW

The `load()` function silently falls back to seeded data if the JSON file is invalid or corrupted. This masks problems and could result in data loss without the operator knowing.

**Required Fix:** Log errors and fail explicitly on corrupt state.

---

### 7. Tests Are Insufficient
**File:** `test/shifts.test.js`  
**Severity:** LOW

Only 2 tests exist:
- Verify unassigned shifts are listed
- Verify double-booking prevention

Missing test coverage:
- Server endpoints (HTTP status codes, error responses)
- Authorization enforcement (coordinator-only check)
- Sign-in/sign-out flows
- Full assignment workflow
- UI functionality (no tests at all)

**Impact:** Cannot verify core workflows work end-to-end.

---

## Verification Summary

✅ **Verified Working:**
- Backend server syntax and basic routing structure
- Unit tests for shift conflict detection pass
- JSON persistence mechanism (file I/O works)

❌ **NOT Verified (Missing Implementation):**
- Sign-in authentication
- Volunteer-facing UI and API
- Coordinator UI and workflows
- End-to-end user journeys
- Session security
- Deployment readiness

---

## Recommendation

**Do not deploy.** The tool is architecturally incomplete:
1. No authentication means coordinators can be impersonated
2. No UI means users cannot access any features
3. Volunteer self-service (core MVP feature) is not implemented

Priority remediation:
1. Implement authentication (CRITICAL)
2. Build the UI for both volunteer and coordinator views (CRITICAL)
3. Add volunteer-facing API endpoints (CRITICAL)
4. Fix datastore concurrency issues (MEDIUM)
5. Improve test coverage (MEDIUM)
6. Document HTTPS deployment requirement (LOW)

**Estimated work:** 2-3 weeks for a production-ready release, starting with security and UI.
