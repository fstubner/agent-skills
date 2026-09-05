# Release Verdict: NOT READY

## Summary
The stock count tool has critical implementation gaps and authorization defects that prevent it from meeting the MVP scope. The client app is incomplete (missing core record/list workflows), and the server has authorization bypass vulnerabilities.

## Critical Issues

### 1. **Authorization Bypass on Clear Counts** [CRITICAL]
**Location**: server/src/routes.js:30-33

The DELETE endpoint clears counts for ANY authenticated user, but only managers should have this permission. The client-side check in permissions.js is insufficient — an attacker with a staff ID can call DELETE directly.

```javascript
app.delete('/api/counts', requireStaff, (req, res) => {
  clearCounts();  // No manager check here
  res.json({ ok: true });
});
```

**Fix Required**: Add server-side authorization:
```javascript
if (!MANAGERS.includes(req.session.staffId)) return res.status(403).json({ error: 'forbidden' });
```

### 2. **Client App Incomplete** [CRITICAL]
**Location**: client/src/app.js

The app implements only sign-in rendering. According to ux-walkthrough.md, it should support:
- Recording a count (form with SKU and quantity)
- Listing counts
- Clearing counts (manager only)
- Sign-out

Current implementation has no UI for record/list workflows. The POST/GET endpoints exist on the server but are never called.

### 3. **No Input Validation** [HIGH]
**Locations**: server/src/routes.js:19-22 (recordCount), server/src/routes.js:20 (sign-in)

Missing validation:
- `staffId` can be null/undefined/empty string in sign-in
- `quantity` is not validated to be a non-negative number
- `sku` is not validated to be non-empty

Records with invalid data can be created and persisted.

### 4. **Session Secret Default in Production Path** [HIGH]
**Location**: server/src/routes.js:11

```javascript
secret: process.env.SESSION_SECRET ?? 'change-me',
```

The default secret 'change-me' is a placeholder that leaves sessions unencrypted if SESSION_SECRET isn't set. This is only safe in local development. The code loads the app even in production with a weak secret.

### 5. **Incomplete Test Coverage** [MEDIUM]
**Location**: server/test/counts.test.js

Only one test exists. Missing coverage for:
- Manager-only DELETE authorization
- Input validation (invalid quantity, missing SKU)
- Sign-in/sign-out session lifecycle
- Concurrent writes (though single-threaded Node mitigates this)

### 6. **Design Token Mismatch** [LOW]
**Locations**: design-tokens.json vs design-direction.md

Design-tokens.json accent color: `#0B6E4F`
Design-direction.md specified accent: `#14506B`

Inconsistency between design spec and code values.

## What Was Verified ✓

- ✓ Server starts and listens (verified via package.json configuration)
- ✓ Tests pass (1/1 test in counts.test.js passes)
- ✓ Dependencies resolve (express, express-session declared)
- ✓ Data persistence layer works (file I/O tested in unit test)
- ✓ Session middleware configured (httpOnly, sameSite cookies set correctly)
- ✓ Basic endpoint structure matches MVP requirements (sign-in, counts CRUD)
- ✓ Manager role concept implemented (MANAGERS array, role returned from sign-in)

## Required Fixes Before Release

1. **CRITICAL**: Add manager check to DELETE endpoint (server-side, not client-side)
2. **CRITICAL**: Implement complete client UI (record form, counts list, sign-out)
3. **HIGH**: Add input validation (non-empty staffId, non-negative quantity, non-empty SKU)
4. **HIGH**: Require SESSION_SECRET or fail loudly in production (throw in non-dev if not set)
5. **MEDIUM**: Add authorization and validation tests
6. **LOW**: Align design-tokens.json with design-direction.md

## Engineering Policy Assessment

| Principle | Status | Note |
|-----------|--------|------|
| Clarify unknowns | ⚠️ Partial | MVP scope defined but implementation incomplete |
| Smallest coherent implementation | ❌ No | Client app is half-built; server auth is incomplete |
| Validate at trust boundaries | ❌ No | No input validation; manager check only client-side |
| Backwards-compatible changes | ✓ Yes | Schema additive if fixed |
| Focused automated tests | ❌ No | Only 1 test; missing auth/validation coverage |
| Run before completion | ⚠️ Partial | Tests pass but full product flow not implemented |

## Recommendation
Return to engineering for fixes. This should not ship to handheld terminals until:
- Server-side authorization is fixed
- Client fully implements record/list/sign-out workflows
- Input validation prevents corrupt data
- Tests cover authorization paths
