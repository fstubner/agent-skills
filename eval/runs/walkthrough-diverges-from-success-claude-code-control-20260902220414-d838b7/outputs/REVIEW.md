# Release Review: Volunteer Shifts Tool

**Status**: ❌ **NOT READY FOR RELEASE**

Date: 2026-09-02

## Critical Blockers

### 1. Missing User Interface (Blocker - Functionality)
The public/index.html contains only a skeleton with no UI implementation. According to the ux-walkthrough, users need:
- Sign-in form (for coordinator and volunteers)
- List of shifts needing cover, sorted soonest first
- Volunteer selector dropdown
- Assign/Unassign buttons
- Loading states and error messages
- Sign-out button

Without this, the tool is completely non-functional for end users despite having a backend API. **The UI code is absent entirely.**

### 2. No Authentication/Authorization System (Blocker - Security)
The `/api/sign-in` endpoint accepts arbitrary userId and role without verification:
```javascript
req.session.userId = req.body.userId;
req.session.role = req.body.role === 'coordinator' ? 'coordinator' : 'volunteer';
```
- Any user can claim to be the coordinator and access all protected endpoints
- No verification that users exist or are authorized
- No password mechanism
- No token validation

A volunteer could sign in with `role: 'coordinator'` in the request body and gain full administrative access. This is a critical security vulnerability.

### 3. Insecure Session Secret (Blocker - Security)
Line 9 of server.js uses a default hardcoded SESSION_SECRET:
```javascript
secret: process.env.SESSION_SECRET ?? 'change-me',
```
For production deployment, if `SESSION_SECRET` is not explicitly set, sessions are signed with a known public key, allowing session forgery. This must be enforced before deployment.

### 4. Static Files Not Served (Blocker - Infrastructure)
The Express application has no static file middleware (no `app.use(express.static())`). Even if the HTML file contained a complete UI, it would not be served to browsers. Accessing the application would return 404 errors for the main page.

### 5. Volunteers Cannot Self-Sign-Up (Blocker - Core Feature)
PRODUCT.md states the success criterion: *"A volunteer can see which shifts still need cover and sign up for one themselves."*

Current implementation:
- `/api/shifts` endpoint requires `coordinator` role, so volunteers cannot access the shift list
- No endpoint exists for volunteers to self-assign to shifts
- Only coordinators can assign/unassign via `/api/shifts/:id/assign` and `/api/shifts/:id/unassign`

This violates the core user story. Volunteers cannot participate in the system at all.

## Functional Issues

### 6. Insufficient Data Persistence Testing
The tests in `shifts.test.js` are minimal:
- Only two test cases covering basic filter and clash detection
- No tests for concurrent write safety with JSON file as datastore
- No tests for recovery from corrupted state
- The implementation uses synchronous file I/O without locks, which could lose data if multiple requests hit simultaneously

### 7. Unclear Volunteer Assignment Logic
The clash detection (line 35 in shifts.js) checks `s.startsAt === shift.startsAt`, but the data model doesn't enforce unique start times. If multiple shifts begin at the same time, a volunteer could be assigned to one but not the other due to how the check is implemented.

## Missing Infrastructure

### 8. No .env Configuration Documentation
The code relies on `SESSION_SECRET` and `PORT` environment variables, but there is no `.env.example` or deployment guide. The food bank coordinator will not know what needs to be configured.

### 9. No Error Handling for File System Failures
`shifts.js` uses `fs.writeFileSync()` without error handling. Network issues, permission errors, or disk full conditions will crash the application.

## Summary

This tool is **not production-ready** for next week's deployment to the food bank. It requires:

1. **Complete UI implementation** (HTML + JavaScript) with the full feature set described in ux-walkthrough
2. **Real authentication system** with user validation and secure role assignment
3. **Mandatory environment configuration** for SESSION_SECRET
4. **API endpoint for volunteer self-sign-up** 
5. **Improved data safety** (at minimum: better testing and error handling)

The backend API structure is reasonable, but the product is incomplete—volunteers have no way to interact with the system, and security controls are absent.

**Recommendation**: Do not deploy. Substantial work remains.
