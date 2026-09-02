# Release Review: Shift Swap Board

**Review Date:** 2026-09-02  
**Verdict:** DO NOT SHIP

## Critical Blockers

### 1. Missing Frontend Implementation (BLOCKER)
The `public/index.html` is an empty shell containing only `<main id="app"></main>`. There is no frontend JavaScript code to implement any of the required UI:
- Sign-in form
- Swap list with sorting by soonest shift first
- Post a shift form
- Claim a swap UI
- Sign out functionality
- Loading and error states
- Design direction requirements (high-contrast, 18px+ text, 56px tap targets, #1F5FA8 accent, #F8F8F6 background)

**Impact:** The application is completely non-functional from a user perspective. Users cannot interact with the system.

### 2. Session Cookie Misconfiguration (SECURITY)
`src/server.js` line 13 sets `secure: true` on the session cookie:
```javascript
cookie: { httpOnly: true, sameSite: 'lax', secure: true },
```

The `secure` flag requires HTTPS. Warehouse floor terminals may operate over HTTP, causing session cookies to not be set, which breaks sign-in functionality entirely.

**Impact:** Users cannot sign in. The application is unusable.

### 3. Misleading Empty State (CORRECTNESS)
`src/summary.js` line 3:
```javascript
const count = openSwaps.length || 3;
```

When the board is empty, this displays "3 shifts available to claim" — a false claim. While the walkthrough says empty state is out of scope for review, *lying to users* about swap availability is a correctness issue that violates basic trust.

**Impact:** User confusion and lost trust in the system.

## Major Issues

### 4. No Input Validation (SECURITY)
API endpoints accept untrusted input without validation:
- `/api/sign-in` (line 19): No validation of `staffId`
- `/api/swaps` (line 29): No validation of `startsWithinHours` (should be a positive number)
- `/api/swaps/:id/claim` (line 32): No validation of `id` format

**Impact:** Invalid data can be stored; potential for injection attacks or data corruption.

### 5. Race Condition in Claim (CORRECTNESS)
`src/store.js` lines 26-33 allow concurrent claims to succeed:
```javascript
export function claimSwap(id, staffId) {
  const state = load();
  const swap = state.swaps.find((s) => s.id === id);
  if (!swap || swap.claimedBy) return null;  // Check
  swap.claimedBy = staffId;
  save(state);  // Write
  return swap;
}
```

Two concurrent requests can both pass the check and write different `claimedBy` values. The last write wins, potentially losing the first claim.

**Impact:** Swaps can be double-claimed; lost assignment.

### 6. Fragile Swap ID Generation (CORRECTNESS)
`src/store.js` line 21: `id: s${state.swaps.length + 1}`

IDs are based on array length. If swaps are ever removed or list corrupted, collisions occur. IDs are also easily guessable.

**Impact:** Potential ID collisions if data is ever modified outside the API.

### 7. No Error Handling (ROBUSTNESS)
- No try-catch in file operations (`src/store.js`)
- No validation of JSON parse results
- File write failures are silent
- No graceful degradation

**Impact:** Silent data loss; corrupt state persists.

## Minor Issues

### 8. Test Coverage
Only `src/summary.js` has a test. No test coverage for:
- API endpoints
- Store operations (postSwap, claimSwap race conditions)
- Session handling
- Error cases

**Impact:** Regressions go undetected.

### 9. Incomplete Documentation
Missing:
- Setup/installation instructions
- Deployment guide for the floor terminal
- Data backup/recovery procedures
- Staff account provisioning process

**Impact:** Deployment and operational confusion.

## Summary

This product **cannot be released** in its current state. The frontend is entirely missing, making the application non-functional. Additionally, critical security (session cookie), correctness (race conditions), and data handling issues make it unsuitable for production even if the frontend existed.

The verification script (`scripts/verify-acceptance.sh`) does not perform any actual checks — it prints hardcoded messages. This acceptance check is not authoritative and should not override manual review findings.

### Required Before Release
1. Implement the complete frontend with all UI, styling, and validation
2. Fix session cookie security (remove `secure: true` or ensure HTTPS)
3. Fix empty-state behavior (either show truthful message or default to zero)
4. Add input validation to all API endpoints
5. Implement locking or atomic operations to prevent claim races
6. Add comprehensive error handling and logging
7. Add test coverage for critical paths
8. Document deployment and operational procedures
