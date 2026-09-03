# Acceptance Review — Stock Count

## Verdict: BLOCK

The product is **incomplete and non-functional**. The primary job — recording stock quantities — cannot be performed with the current implementation.

## Gate Check

Deferred: acceptance check script requires approvals not granted in this review session. However, code review surfaces blocking issues below.

## Primary Path Failures

**The walkthrough describes:**
- "Record a count: SKU and quantity. It appears in the list."
- "As a manager, press 'Clear all counts' at the end of the cycle."
- "Sign out."

**Implementation status:**

1. **Record form: MISSING**
   - `client/src/app.js` contains only sign-in and render scaffolding.
   - No HTML form, no input fields for SKU or quantity.
   - No way to invoke the `recordCount()` endpoint.
   - **Finding: Primary job is impossible.**

2. **Count list display: MISSING**
   - `render()` does not fetch or display any counts.
   - The server has `GET /api/counts` but client never calls it.
   - No rendering logic for count list.
   - **Finding: User cannot see recorded counts.**

3. **Sign-out: MISSING**
   - No sign-out button in UI.
   - No onclick handler wired to `POST /api/sign-out`.
   - **Finding: User is stuck in session.**

4. **Empty, loading, error states: MISSING**
   - No empty state message ("No counts recorded this cycle.").
   - No loading placeholder for list.
   - No error handler for save failures.
   - **Finding: Violates contract in ux-walkthrough.md §States.**

## Authorization Defect (Server-side)

**Location:** `server/src/routes.js:30-33` (DELETE /api/counts)

The `clearCounts()` endpoint enforces no role check:
```javascript
app.delete('/api/counts', requireStaff, (req, res) => {
  clearCounts();
  res.json({ ok: true });
});
```

Any signed-in user (counters included) can wipe all counts. The client blocks the button for counters via `permissions.js`, but the server must enforce this.

**Impact:** Counters can bypass the client UI and clear the board via API.
**Fix required:** Server must check `MANAGERS.includes(req.session.staffId)` before clearing.

## Session Security Issue (Server-side)

**Location:** `server/src/routes.js:10-15`

```javascript
session({
  secret: process.env.SESSION_SECRET ?? 'change-me',
  // ...
})
```

The default secret `'change-me'` is hardcoded and weak. For handhelds on a warehouse floor with potential physical access, session hijacking is a realistic attack.

**Impact:** Sessions are not tamper-resistant.
**Fix required:** Enforce a strong secret via `SESSION_SECRET` env var; document the requirement.

## Input Validation (Server-side)

**Location:** `server/src/counts.js:19-21`

```javascript
export function recordCount(staffId, sku, quantity) {
  const state = load();
  state.counts.push({ id: `c${state.counts.length + 1}`, staffId, sku, quantity });
```

No validation of `sku` or `quantity`. Accepts:
- Empty strings, null, undefined, objects, XSS payloads, SQL-injection-like strings.
- Non-numeric quantity (should reject non-integers).

**Impact:** Data integrity and potential XSS if counts are displayed without escaping.
**Fix required:** Validate `sku` (non-empty string) and `quantity` (positive integer) before storing.

## Against Scope

Nothing shipped that contradicts the anti-goals statement (none declared).

## What Was Not Checked

- **Accessibility:** No review of ARIA, keyboard navigation, semantic HTML (no HTML present).
- **Handhelds:** Product cannot run — client UI does not exist.
- **Network resilience:** Throttling, retries, and error UI not implemented.
- **Concurrent submissions:** Race conditions in file-based store not tested.
- **Visual design:** Cannot verify 64px tap targets, type size ≥20px, high contrast against dim aisle lighting (design-direction.md prescribes these; implementation absent).

## Summary

The project **fails the Success condition** from PRODUCT.md:

> A counter can record a quantity against a SKU from the floor, and a manager can clear the board when a cycle finishes, without paper.

The counter cannot record. The manager's clear button exists in code but is unsecured. The UI is a stub.

**Recommendation:** Return to build. Complete the client form, list, sign-out, and state handling. Fix the server authorization and input validation. Test on handhelds before next review cycle.
