# Release Review

**Date:** 2026-09-05  
**Status:** ⛔ NOT READY FOR PRODUCTION

## Summary
The volunteer shifts tool has critical gaps in authentication, user interface, and feature completeness that block deployment. While the core data model and business logic for shift assignment are sound, three major categories of work remain.

## Critical Issues

### 1. Authorization Bypass (Security)
**Severity:** Critical  
**Location:** `src/server.js`, lines 19-22

Any user can sign in as the coordinator by sending `role: "coordinator"` in the request body. There is no authentication, verification, or permission validation. The requireCoordinator middleware only checks what the client sent:

```javascript
app.post('/api/sign-in', (req, res) => {
  req.session.role = req.body.role === 'coordinator' ? 'coordinator' : 'volunteer';
  res.json({ ok: true });
});
```

A volunteer can claim coordinator privileges and reassign all shifts. This violates the documented trust boundary: "Every shift route requires the coordinator role."

**Required fix:** Add authentication (username/password, PIN, or role verification from an authoritative source).

### 2. User Interface Not Implemented
**Severity:** Critical  
**Location:** `public/index.html`

The frontend is a single empty `<main id="app"></main>` element. The UX walkthrough describes a sign-in form, shift listing, and assign/unassign controls, but none of this UI exists. The application cannot be used without it.

**Required fix:** Implement the full frontend per `ux-walkthrough.md` (sign-in form, shift list, assign/unassign buttons, error/loading states).

### 3. Product Specification Mismatch
**Severity:** High  
**Location:** `PRODUCT.md` vs implementation

PRODUCT.md states: "A volunteer can see which shifts still need cover and sign up for a shift themselves."

The implementation reserves assignment exclusively for the coordinator (`requireCoordinator` on `/api/shifts/:id/assign`). ARCHITECTURE.md documents this as a deliberate design choice, but contradicts the original brief. The UX walkthrough confirms the coordinator-only model was chosen during build.

**Resolution needed:** Clarify with food bank coordinator whether the change (coordinator-only assignment) is acceptable, or revert to self-signup for volunteers.

## High-Priority Issues

### 4. Concurrent Write Race Condition
**Location:** `src/shifts.js`

The load-save pattern is not atomic:
```javascript
function assign(shiftId, volunteerId) {
  const state = load();  // T1: Request A reads
  // ...                 // T2: Request B reads same state
  save(state);           // T1: Request A writes
  // ...                 // T3: Request B writes, overwriting A's changes
}
```

Two simultaneous requests could lose data. With 3 shifts/day and a volunteer signup flow, this is plausible under load.

**Mitigation:** Add filesystem-based locking (e.g., `proper-lockfile`) or move to a database.

### 5. Insecure Default Session Secret
**Location:** `src/server.js`, line 9

```javascript
secret: process.env.SESSION_SECRET ?? 'change-me'
```

The fallback secret is hardcoded and well-known. Sessions can be forged in production if `SESSION_SECRET` is not set.

**Required fix:** Refuse to start if `SESSION_SECRET` is not explicitly provided.

## Medium-Priority Issues

### 6. Missing Input Validation
- `req.body.userId` and `req.body.volunteerId` are not validated for format or length.
- Shift IDs are passed through without checking against the loaded state before responding.

### 7. Incomplete Logout Flow
The volunteer's view cannot show which shifts they are assigned to (no frontend), so they cannot verify their own cancellation.

## What Works

- Core shift data model (JSON file with load/save) is functional.
- Business logic for conflict detection (volunteer not assigned to two shifts at the same time) is correct.
- Tests pass and cover the critical path.
- No external dependencies; runs on Node 18+.

## Blockers Before Deployment

1. Implement sign-in authentication (not just role-claiming).
2. Implement the full frontend UI.
3. Clarify volunteer self-signup vs. coordinator-only assignment with the food bank.
4. Add file locking to prevent race conditions.
5. Make session secret mandatory.

## Recommendation

**Do not deploy.** Return to the product team to:
1. Resolve the volunteer signup vs. coordinator assignment decision with the food bank.
2. Complete the frontend implementation.
3. Add proper authentication.

Once these are addressed, the core architecture is sound enough for a small food bank operation.
