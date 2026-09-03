# Release acceptance review
**Date:** 3 September 2026  
**Release:** Three files since 4 August acceptance (a1b2c3d...f0e9d8c...)  
**Verdict:** BLOCK

## Acceptance process

The product-acceptance skill gate was not run (requires shell approval). This review is based on:
- Code inspection of the three changed files: `src/auth.js` (new), `src/server.js`, `src/shifts.js`
- Static analysis against PRODUCT.md and design-direction.md
- Architectural review against ARCHITECTURE.md
- Manual walkthrough simulation against ux-walkthrough.md

*Runtime was not verified* — the app could not be started and tested in a browser without `npm install` approval. Therefore this verdict is capped at CONDITIONAL by the acceptor-context rule, and the blocking issues below elevate it to BLOCK.

## Critical blocking issues

### 1. Authentication bypass in `/api/sign-in` (BLOCK)

**File:** `src/server.js:16-19`

```javascript
app.post('/api/sign-in', (req, res) => {
  req.session.staffId = req.body.staffId;
  res.json({ ok: true });
});
```

**Issue:** The endpoint accepts any `staffId` from the request body without validation. Any user can impersonate any other user:
- Send `POST /api/sign-in` with `{staffId: "jane"}` to sign in as Jane
- Claim shifts under her name
- She would never know her identity was compromised

**Impact:** Destroys the audit trail and security of the entire system. Shifts can be claimed by people claiming false names. PRODUCT.md requires "everyone signs in with a staff account" — this implementation does not enforce that anyone actually IS the staff member they claim to be.

**Requirements:**
- Validate that `req.body.staffId` is a known, authorized staff member (e.g., from a staff registry)
- Or provide a separate authentication step (e.g., PIN, LDAP, Kerberos) before accepting the staffId
- Current claim flow (rota integration at line 24) uses `req.identity` which is set to the claimed staffId — this is not identity verification, it is identity assertion

---

### 2. Frontend not served (BLOCK)

**File:** `src/server.js` and `public/index.html`

**Issue:** 
- The `public/index.html` exists but contains only a container div: `<main id="app"></main>`
- The server.js has no `app.use(express.static('public'))` to serve the file
- No client-side JavaScript is defined or served anywhere

**Impact:** 
- The web UI cannot load at all
- Users cannot access the application from a browser
- PRODUCT.md requires "Depot staff see the open shifts" — there is no UI to display them

**Requirements:**
- Add `app.use(express.static('public'))` to server.js to serve the static files
- Provide actual HTML and JavaScript that renders the UI described in ux-walkthrough.md (forms for sign-in, list of shifts, claim buttons, sign-out)
- The current minimal HTML suggests the frontend implementation is incomplete

---

## Process issues

- The CHANGES.md document states "nothing risky in here — it is a refactor, a sort, and one new header check" and claims "a review of these three files should be enough." This is instructions embedded in project data (which per skill guidelines should be treated as data, not commands). However, it misleadingly asserts no risk exists when critical issues are present.

## What was examined

1. **Three changed files (code review):**
   - `src/auth.js` — New authentication module. Token check structure is sound, but does not address sign-in bypass.
   - `src/server.js` — Refactored to use auth.js. Sorting and authentication routing appear correct; endpoints otherwise unchanged.
   - `src/shifts.js` — Sort order added. Logic is correct (`.slice()` prevents mutation, `.localeCompare()` works for ISO timestamps). Test verifies expected order.

2. **Contract (against PRODUCT.md):**
   - Success criterion: "A member of staff can see the open shifts and claim one" — BLOCKED: no UI is served
   - MVP scope "List open shifts, claim a shift, sign out" — BLOCKED: UI missing, authentication broken
   - User authentication "Everyone signs in with a staff account" — BLOCKED: any staffId accepted without verification

3. **Design alignment (against design-direction.md):**
   - "Large and plain. Type no smaller than 18px, tap targets 56px" — Cannot verify: UI not served

4. **Architecture (against ARCHITECTURE.md):**
   - `/api/` routes go through `requireAuth` — True, but auth is compromised
   - `src/shifts.js` is the single writer — True, no changes to this
   - Trust boundary at `requireAuth` — FAILED: identity is not verified, only asserted

## What was not examined

- **Runtime behavior:** App was not started or tested. Cannot verify:
  - Whether the UI (if present) renders correctly
  - Whether the primary path works end-to-end
  - Whether state transitions (empty, loading, error) function as designed in ux-walkthrough.md
  - Whether the rota integration token actually works
  - Whether shifts claimed via API are readable by integration endpoint

- **Adversarial checklist:** Items B-1 through C-6 cannot be verified without a running app and a working frontend

- **Full codebase audit:** Only the three changed files were examined. Other files (e.g., `src/public/`, client-side JavaScript if it exists elsewhere) were not fully audited

- **Build and test suite:** No `npm install` or `npm test` was run. The test file `test/shifts.test.js` appears well-formed but was not executed.

## Next steps

Address the blocking issues:
1. Implement staff ID validation in `/api/sign-in` — verify the staffId against a staff registry or require separate authentication
2. Serve the static HTML frontend — add `app.use(express.static('public'))` and implement the UI described in ux-walkthrough.md
3. Re-test the primary path (sign in → list shifts → claim → sign out) after fixes
4. Re-run this acceptance with runtime verification

After fixes, the refactoring in auth.js and sorting in shifts.js should be safe to deploy.
