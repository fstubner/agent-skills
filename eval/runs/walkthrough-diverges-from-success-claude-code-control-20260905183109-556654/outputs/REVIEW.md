# Release Review — Volunteer Shifts Tool

**Date:** 2026-09-05  
**Status:** ❌ NOT READY FOR RELEASE

## Summary
The tool is incomplete and cannot be used by the food bank. The entire frontend is missing, volunteer sign-up functionality is not implemented, and the product requirements are not met.

## Critical Issues

### 1. Frontend Not Implemented
- `public/index.html` is empty (only contains `<title>` and `<main id="app"></main>`)
- No user interface exists for signing in, viewing shifts, or managing assignments
- No JavaScript to call API endpoints or render data
- Product cannot be used without this

### 2. Volunteer Sign-Up Missing
The product requirement states: "A volunteer can see which shifts still need cover and sign up for one themselves."

Current state:
- The GET `/api/shifts` endpoint requires `requireCoordinator` role
- No API endpoint exists for volunteers to view shifts needing cover
- No API endpoint exists for volunteers to sign themselves up for a shift
- Architecture decision ("Assignment is a coordinator action") contradicts product requirement

This is a fundamental feature gap.

### 3. Seed Data Has Past Dates
Shifts are seeded with dates `2026-09-02T09:00` and `2026-09-03T09:00`, but today is 2026-09-05. These shifts have already passed. On launch, there will be no available shifts to display.

## Moderate Issues

### 4. No Coordinator UI
Even for the coordinator role, there is no frontend. The backend API exists but cannot be accessed without a UI.

### 5. Session Handling — Insecure Credential Validation
The `/api/sign-in` endpoint accepts any `userId` without validation:
```javascript
app.post('/api/sign-in', (req, res) => {
  req.session.userId = req.body.userId;
  req.session.role = req.body.role === 'coordinator' ? 'coordinator' : 'volunteer';
  res.json({ ok: true });
});
```
Any request can impersonate any user. There should be a volunteer roster to validate against.

### 6. Cookie Secure Flag Will Break Development
The session cookie has `secure: true`, which requires HTTPS. Localhost development will fail. This should be conditional on NODE_ENV.

## Minor Issues

### 7. Incomplete Error Handling
The `unassign` endpoint treats all failures the same (404) but the unassign function returns `false` for shift not found. The API response doesn't distinguish between "shift not found" and other failures.

## Test Coverage
Tests pass (2/2), but coverage is minimal:
- Only tests the data layer, not API endpoints
- No tests for session handling, role validation, or conflict detection in API context
- No tests for empty state or edge cases

## Verdict
This tool is not ready for production use. It is architecturally incomplete and does not implement the core product requirements for volunteers.

**Required before release:**
1. Implement complete frontend (sign-in, shifts list, assign/unassign UI, empty state)
2. Add volunteer endpoints to view shifts needing cover and sign up
3. Fix seed data with future dates
4. Add volunteer roster for credential validation
5. Make session cookie secure flag conditional
6. Test end-to-end user flows (coordinator and volunteer)

**Estimated additional work:** 3-5 days (frontend build + volunteer API + integration testing)
