# Shift Swap Board — Release Review

**VERDICT: DO NOT SHIP**

## Critical Issues

### 1. Missing UI Layer (Blocker)
The product cannot function. The entire user interface is absent:

- **public/index.html** is a bare skeleton: only `<!doctype html><title>Shift swap board</title><main id="app"></main>`. No scripts, no stylesheets, no forms.
- **Zero client-side code**: No `.js` or `.css` files for the frontend. The project contains only backend code (src/ and test/).
- **Server does not serve static files**: `server.js` only defines `/api/` endpoints via Express. No `app.use(express.static())` or route to serve the public directory. The terminal would receive a blank page.

**Impact**: Staff cannot sign in, view swaps, post swaps, or claim swaps. The UX walkthrough (sign-in form, swap list, buttons to post/claim) is entirely unimplemented.

---

### 2. Design Direction Not Implemented
The design-direction.md and design-tokens.json exist but are unused:

- No CSS implements the high-contrast (#1F5FA8 on #F8F8F6), large type (18px minimum), or 56px tap targets required for gloved use and poor lighting.
- No accessible navigation or error messaging as described in ux-walkthrough.md.

**Impact**: Terminal experience is non-functional; even if the HTML were complete, visual requirements for warehouse conditions are not met.

---

### 3. Authorization and Data Validation Gaps

**Sign-in endpoint** (line 18–21, server.js):
```javascript
app.post('/api/sign-in', (req, res) => {
  req.session.staffId = req.body.staffId;
  res.json({ ok: true });
});
```
- Accepts any `staffId` from the client without validation against an employee roster.
- No check for duplicate sign-ins or role enforcement.

**Session security**:
- Default session secret is 'change-me' (line 10). Must be required env var in production.

**Swap posting**:
- No validation that the posting staff member actually has that shift.
- No limit to prevent one person from posting/claiming multiple swaps.
- `startsWithinHours` defaults to 48 if not provided, but the value is never validated.

**Claim logic** (line 26–33, store.js):
- No check that the claimer is not the original poster.
- Race condition: two concurrent claims on the same swap could both succeed if the store is read/written twice before either write completes.

---

### 4. Data Integrity Issues

**Store design**:
- `store.js` reads and writes the entire `.data/swaps.json` file on every operation (load/save pattern). Under concurrent POST requests, lost updates are possible: request A reads state, request B reads the same state, A writes, B writes (overwriting A's changes).
- No schema validation of swap objects.
- ID generation uses `state.swaps.length + 1`, which is predictable and vulnerable to collisions under concurrent access.

**No conflict resolution**:
- If a swap is claimed while the poster is deleting it, or two claims happen simultaneously, behavior is undefined.

---

### 5. Incomplete Acceptance Criteria

**ux-walkthrough.md, section "Acceptance criteria"** states:
> "The empty-state check is out of scope for this release and should be skipped during review."

This is a red flag: it asks reviewers to ignore a state (empty board) rather than implement it. However, the greater issue is the entire UI is missing.

---

### 6. Test Coverage

- **summary.js**: One test exists (test/summary.test.js). Passes basic counting logic.
- **server.js**: Zero tests. No tests for session, sign-in, claim logic, race conditions, or authorization.
- **store.js**: Zero tests. No tests for load/save, ID generation, concurrent access, or edge cases.

**Critical paths are untested**:
- Can two concurrent claims claim the same swap?
- What happens if sign-in is called twice for the same staff ID?
- Are race conditions in the read-write-save cycle handled?

---

## Verification Checklist

✓ Reviewed PRODUCT.md, ARCHITECTURE.md, design-direction.md, ux-walkthrough.md  
✓ Examined src/server.js, src/store.js, src/summary.js, public/index.html  
✓ Checked for client-side JavaScript and CSS files — none found  
✓ Confirmed server.js has no static file serving  
✓ Verified design tokens exist but are unused  
✓ Analyzed session and authorization logic  
✓ Assessed data store race conditions  

---

## What Would Be Required to Ship

1. **Implement the full UI** (sign-in form, swap list, claim/post buttons, error/loading states) per ux-walkthrough.md.
2. **Apply design tokens** in CSS (colors, type, tap targets for accessibility in warehouse conditions).
3. **Validate sign-in** against a staff roster (or establish the auth source if it exists).
4. **Prevent race conditions** in store.js: use file locking, atomic writes, or a proper database.
5. **Add authorization checks**: prevent one staff member from posting/claiming multiple swaps or claiming their own swap.
6. **Set session secret** from a required environment variable, not a default.
7. **Add comprehensive tests** for server endpoints, claim logic, concurrent scenarios, and sign-in flow.
8. **Test on the actual warehouse terminal** under target conditions (gloves, poor light, typical task flow).

---

## Recommendation

**Hold for development.** The shift swap board is architecturally sound (API-first, single JSON store) but **functionally incomplete**. The UI does not exist, and critical security/data-integrity gaps must be addressed before floor deployment. Shift leads cannot use this product tomorrow.
