# Release Verdict

**Status: NOT APPROVED FOR RELEASE**

The stock count tool has incomplete implementation and critical security issues that prevent warehouse deployment.

## Critical Issues

### 1. Missing Frontend Delivery
The application cannot run on handhelds. Client files exist (`app.js`, `permissions.js`) but there is no HTML entry point and no static file serving. The server's `createApp()` only defines API routes. There is no build process (referenced `client/src/build.js` does not exist) and no mechanism to serve the front-end to users.

**Impact**: Handhelds cannot access the application at all.

### 2. Unauthenticated Sign-In
The `/api/sign-in` endpoint accepts any `staffId` without validation or authentication:
```javascript
app.post('/api/sign-in', (req, res) => {
  req.session.staffId = req.body.staffId;
  // ...
});
```
Users can impersonate any staff member, including managers, by providing any staffId.

**Impact**: Authorization system is bypassed. Counters can clear the board; unauthorized users can pose as managers.

### 3. Authorization Not Enforced Server-Side
The `/api/counts` DELETE endpoint lacks role verification:
```javascript
app.delete('/api/counts', requireStaff, (req, res) => {
  clearCounts();
  res.json({ ok: true });
});
```
Only `requireStaff` middleware is used; there is no check that the user is a manager. The client-side permission check is the only guard, and the `x-role` header sent by the client cannot be trusted.

**Impact**: Any signed-in counter can clear all warehouse counts, violating the requirement that only managers can perform this operation.

### 4. Hardcoded Session Secret
```javascript
secret: process.env.SESSION_SECRET ?? 'change-me',
```
The default session secret 'change-me' is a well-known placeholder. Sessions are not cryptographically secure if the environment variable is not set.

**Impact**: Sessions can be forged. Attackers can impersonate any user if SESSION_SECRET is not provided.

## Major Issues

### 5. No Input Validation
- `recordCount()` accepts any quantity (negative, non-numeric, etc.) without validation.
- No SKU format validation.
- Server does not validate `req.body.quantity` or `req.body.sku` before recording.

**Impact**: Corrupted data in counts; no guarantee of data integrity.

### 6. Fragile ID Generation
```javascript
state.counts.push({ id: `c${state.counts.length + 1}`, ... });
```
ID generation assumes counts array never loses items. Manual edits, bugs, or corruption could cause duplicate IDs.

**Impact**: Unreliable count tracking; difficult to diagnose data issues.

### 7. No Error Handling in Client
Fetch calls in `app.js` do not check response status or handle errors:
```javascript
const res = await fetch('/api/sign-in', ...);
role = (await res.json()).role; // Assumes success
```
Failed requests will throw or silently fail.

**Impact**: Silent failures; users won't know if their action succeeded.

### 8. Incomplete Client Initialization
The client renders immediately but has no sign-in form or count entry UI. The `app.js` only sets up a basic scaffold without any interactive elements needed for the MVP (sign-in form, count input, list display).

**Impact**: Users cannot sign in or record counts.

### 9. Session Storage Not Persistent
Express-session defaults to memory storage. Sessions are lost on server restart. Handheld terminals may restart or disconnect unpredictably.

**Impact**: Users must re-sign-in after any restart; poor UX for warehouse floor work.

## Summary Against MVP Requirements

| Requirement | Status | Issue |
|---|---|---|
| Sign in | Broken | No authentication; form missing |
| Record a count | Broken | Form missing; no SKU/quantity fields |
| List counts | Broken | Display logic missing from client |
| Clear all counts (manager) | Broken | No authorization enforcement; not restricted to managers |
| Sign out | Implemented | ✓ |
| No paper | Blocked | Cannot access application |

## Recommended Actions Before Release

1. **Implement complete frontend**: Create HTML with sign-in form, count entry form, and counts list. Serve via Express static middleware.
2. **Add server-side authentication**: Validate `staffId` against a staff roster or authentication service. Do not accept arbitrary values.
3. **Enforce manager-only clear**: Add role check to DELETE endpoint.
4. **Add input validation**: Validate quantity (positive number), SKU format, staffId.
5. **Fix session configuration**: Require SESSION_SECRET environment variable; fail fast if not set. Use persistent store (e.g., file-based for Node 18+).
6. **Add error handling**: Check response status in client; provide user feedback on failures.
7. **Generate stable IDs**: Use UUID or timestamp-based IDs instead of array length.
8. **Add automated tests**: Current test only checks basic recording; add tests for authorization, validation, edge cases.

## Remaining Uncertainty

- **Staff roster**: No source of truth for valid staffIds. Is there a database, LDAP, or hardcoded list? The hardcoded MANAGERS array suggests hardcoding, but a staff directory should be consulted.
- **Session persistence requirement**: Are handheld terminals expected to stay connected, or should sessions survive restart? Unclear from requirements.
- **SKU validation**: No specification of valid SKU format from warehouse requirements.

---

**Verdict: Block release. Implement critical items (frontend delivery, authentication, authorization) before next cycle.**
