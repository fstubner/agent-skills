# Acceptance Review: Stock Count Tool

**Verdict: BLOCK**

---

## Summary

The product fails to implement the core user interface required for the primary job. While the backend API correctly implements count recording, listing, and clearing, the client application is incomplete and cannot satisfy the walkthrough steps or meet the Success criteria from PRODUCT.md. The product cannot ship in its current state.

---

## What Was Verified

### Gate Check
The automated acceptance gate (`accept-check.js`) could not run due to missing dependencies, so verification relied on manual code review against PRODUCT.md requirements and the adversarial checklist.

### Code Review
- ✅ Backend API correctly implements: `POST /api/sign-in`, `POST /api/counts`, `GET /api/counts`, `DELETE /api/counts`, `POST /api/sign-out`
- ✅ Session management configured with secure cookies (httpOnly, sameSite, secure flags)
- ✅ Role-based access control: managers (m1, m2) can clear; all authenticated users can record
- ✅ In-memory + file-based persistence for counts
- ✅ Server-side test passes for count recording workflow
- ✅ No obvious secrets in client-side code

### What Was NOT Verified
- Walkthrough execution (no UI to test against)
- Empty/error/loading states (not implemented)
- Network throttling and error recovery
- Input validation/XSS protection (no form exists)
- Keyboard navigation and viewport responsiveness
- Accessibility for handheld use

---

## Critical Blockers

### A — Contract (PRODUCT.md Success)
**BLOCK: Success condition cannot be completed**

The Success criterion states: "A counter can record a quantity against a SKU from the floor, and a manager can clear the board when a cycle finishes, without paper."

**What's missing in client/src/app.js:**
1. **No sign-in form** — `signIn()` function exists but is never called; no form to collect staffId input
2. **No count recording form** — No SKU or quantity input fields
3. **No counts list view** — Walkthrough step "It appears in the list" cannot occur; no call to `GET /api/counts`
4. **No sign-out button** — Walkthrough step 4 (sign out) not implemented
5. **Incomplete rendering** — Only outputs `<h1>Stock count</h1>` and a clear button (if manager); rest of the app is stub

The app.html renders nothing that matches the walkthrough. The four steps cannot be completed in sequence.

### B — Primary Path (ux-walkthrough.md)
**BLOCK: All steps fail to execute**

The walkthrough cannot be replayed because:
- Step 1: "Sign in with a staff id" — no form to enter staffId
- Step 2: "Record a count: SKU and quantity" — no form to enter SKU/quantity
- Step 2: "It appears in the list" — no list rendered anywhere
- Step 3: "Press 'Clear all counts'" — button exists but list is never populated, so clearing has no visible effect
- Step 4: "Sign out" — no sign-out button or mechanism

### C — States (Empty, Error, Loading)
**BLOCK: No UI states implemented**

The ux-walkthrough.md specifies three required states:
- "No counts recorded this cycle" → not rendered
- Error state (failed save keeps typed quantity) → no form exists to show this
- Loading state (placeholder row) → not rendered

---

## Secondary Issues

1. **Build script missing**: client/package.json references `"build": "node src/build.js"` but the file does not exist.

2. **No static file serving**: The server (routes.js) has no `app.use(express.static(...))` to serve client assets or an index.html.

3. **Client code incomplete**: The only substantive client code is permission checks and a stub render function that never fetches data or displays forms.

4. **No input validation**: Even after implementation, client has no validation for SKU or quantity (e.g., empty string, invalid JSON, SQL injection attempts per adversarial checklist).

---

## What Passes

- Backend API structure and endpoints are correct
- Server-side session and role-based access control are secure
- Data persistence works (file-based JSON)
- Backend tests pass
- No obvious security misconfigurations in Express setup

---

## Recommendation

**Do not deploy.** The product is functionally incomplete. Before resubmission:

1. Implement the client UI with all walkthrough steps:
   - Sign-in form (staffId input)
   - Count recording form (SKU + quantity inputs)
   - Counts list view (populated from GET /api/counts)
   - Sign-out button
   - Empty state message
   - Error and loading states

2. Wire client actions to existing backend endpoints

3. Add input validation and error handling per adversarial checklist

4. Verify full walkthrough manually before re-opening acceptance

5. Restore or remove the missing build.js script

---

## Acceptance Criteria Met

- ❌ Contract: Primary job not completable
- ❌ Walkthrough: Cannot execute any steps
- ❌ States: No empty/error/loading states
- ❌ Adversarial: Input forms don't exist
- ✅ Gate: Would require core tooling; manual review identified blockers first

**Verdict stands: BLOCK**
