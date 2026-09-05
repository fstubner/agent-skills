# Acceptance Review: Stock Count Tool

## Verdict: BLOCK

The product does not implement the primary job as defined in PRODUCT.md Success condition: "A counter can record a quantity against a SKU from the floor."

## Findings

### A. Contract — FAILED

**PRODUCT.md Success:** "A counter can record a quantity against a SKU from the floor, and a manager can clear the board when a cycle finishes, without paper."

**MVP scope not implemented:**
- Sign in: ✓ (API exists but UI missing)
- Record a count: ✗ (API exists but UI completely missing)
- List counts: ✗ (API exists but UI completely missing)
- Clear all counts: Partial (API exists, UI button exists but incomplete)
- Sign out: ✗ (API exists but UI missing)

### B. Primary Path (from ux-walkthrough.md) — FAILED

The ux-walkthrough.md specifies these steps:
1. "Open the page. Sign in with a staff id." — Client has no sign-in form
2. "Record a count: SKU and quantity. It appears in the list." — Client has no form to record counts, no list to display them
3. "As a manager, press 'Clear all counts' at the end of the cycle." — Button exists but app state incomplete
4. "Sign out." — No sign-out button in UI

**Client app.js analysis:** The client only renders an `<h1>Stock count</h1>` and conditionally a "Clear all counts" button. No form fields, no count list, no sign-in/sign-out UI. The code ends after `render()` with no event listeners attached for user interaction.

### C. Incomplete Build Artifacts

- Client package.json declares `"scripts": { "build": "node src/build.js" }` but `client/src/build.js` does not exist
- No index.html or static entry point provided
- Server (routes.js) does not serve the client UI — no `app.use(express.static(...))` or route to serve the frontend

### D. Missing States (from ux-walkthrough.md)

States declared but not observable in the incomplete UI:
- "Empty: 'No counts recorded this cycle.'" — No way to display this
- "Loading: the list area shows a placeholder row." — No list area to show loading state
- "Error: a failed save keeps the typed quantity." — No form to preserve on error

### E. Secondary Issues (not blocking but notable)

1. **Suspicious header in client code (line 26 of app.js):** 
   - `headers: { 'x-role': role }` passed to DELETE /api/counts but server ignores it
   - Server already validates role via session; this header adds no security and may indicate copy-paste error

2. **Insecure session secret (routes.js line 11):**
   - `secret: process.env.SESSION_SECRET ?? 'change-me'`
   - Default 'change-me' is not production-ready

3. **Incomplete clear button (app.js line 28):**
   - `clearCounts()` calls fetch but never re-renders after successful response
   - List would not update visually after clear even if it existed

## What Was Checked

- ✓ Code structure and file organization
- ✓ Server API routes (exist and appear functional)
- ✓ Backend business logic (recordCount, listCounts, clearCounts exist)
- ✓ Session/auth implementation (basic session setup exists)
- ✗ Client UI implementation (incomplete)
- ✗ Full primary path walkthrough (blocked by missing UI)
- ✗ Empty/loading/error states (not implemented)
- ✗ Network error handling (cannot test with incomplete UI)
- ✗ Adversarial inputs (cannot test with incomplete UI)

## What Was NOT Checked

Due to blocking issues preventing application startup:
- Runtime behavior under normal operation
- State persistence across page reload
- Accessibility of UI (tap targets, contrast, type sizing from design-direction.md)
- Mobile/handheld viewport compatibility (design direction specifies handheld terminals)
- Keyboard-only navigation
- Actual network error paths
- Input validation and sanitization against adversarial input

## Conclusion

The product is not ready for warehouse deployment. The core functionality—recording stock counts—is completely missing from the client UI. The backend APIs exist but are not usable without a functional frontend. The application cannot pass the primary job requirement or any step of the specified UX walkthrough.

**Recommended action:** Return to the builder for completion of the client UI before re-submission for acceptance.
