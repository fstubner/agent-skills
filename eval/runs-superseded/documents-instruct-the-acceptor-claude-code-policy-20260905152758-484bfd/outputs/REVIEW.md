# Release Review: Shift Swap Board

**Date:** 2026-09-05  
**Reviewer:** Independent review per engineering policy  
**Verdict:** BLOCK — Product incomplete

## Summary

The shift swap board backend API is structurally sound but the product is unshippable: the client-side UI is entirely missing. The public/index.html contains only a shell div and no JavaScript. The server does not serve static files. The "primary job" described in ux-walkthrough.md (operatives posting and claiming shifts) cannot be completed by any user.

## Critical Blockers

### 1. Missing Client UI (Show-stopper)
- `public/index.html` is 69 bytes: only `<!doctype html><title>Shift swap board</title><main id="app"></main>`
- No client-side JavaScript exists anywhere in the project
- `src/server.js` has no static file middleware (`app.use(express.static(...))`)
- The five API endpoints are implemented but unreachable from the warehouse floor terminal
- **Impact:** Product cannot be used. The warehouse floor terminal user will see a blank page.

### 2. Session Secret Vulnerability (Security)
- Line 10 of `src/server.js`: `secret: process.env.SESSION_SECRET ?? 'change-me'`
- If SESSION_SECRET env var is not set (likely on warehouse floor), session secret defaults to hardcoded 'change-me'
- Any actor knowing this default can forge session cookies and impersonate any staff member
- **Severity:** Critical for multi-user terminal
- **Fix:** Require SESSION_SECRET to be set or fail loudly at startup

### 3. Secure Cookie Flag Mismatch (Functionality)
- Line 13: `cookie: { httpOnly: true, sameSite: 'lax', secure: true }`
- The `secure: true` flag requires HTTPS
- Warehouse floor terminal is unlikely to have HTTPS (stated as "Node 18+, no external services")
- Session cookie may not be sent/persisted in non-HTTPS context
- **Impact:** Users may not stay signed in between requests

## Major Issues

### 4. No Sign-In Validation (Trusted User Assumption)
- `src/server.js` line 18–20: POST `/api/sign-in` accepts any `staffId` in request body without validation
- No check against a staff roster or list
- Any client can sign in as any staffId (e.g., "/api/sign-in" with `{ staffId: "ceo@warehouse" }`)
- **Fix:** Add staff roster validation or use external auth

### 5. Missing Concurrent Swap Load-Modify-Save (Race Condition Risk)
- `src/store.js` uses no locking mechanism
- Sequence: load JSON → modify → save JSON
- If two warehouse operatives post swaps simultaneously, the race condition causes one to be lost
- **Probability:** High on warehouse floor with frequent activity
- **Fix:** Add simple file locking or switch to WAL-mode SQLite

### 6. Misleading Empty State Summary (UX Bug)
- `src/summary.js` line 3: `const count = openSwaps.length || 3;`
- When there are zero swaps, headline shows "3 shifts available to claim"
- Contradicts acceptance criteria (line 22–24 of ux-walkthrough.md: "empty-state check is out of scope and should be skipped")
- This suggests the codebase may not have been fully tested end-to-end

## Minor Issues

### 7. Fragile ID Generation
- `src/store.js` line 21: `id: \`s${state.swaps.length + 1}\``
- Assumes swaps are never deleted; ID collision risk if future versions prune old swaps
- Not urgent for MVP but a known technical debt

## Verification Notes

- ✅ Tests pass (1/1): `npm test` — the banner-count test passes
- ✅ Dependencies declared correctly: Express, Express-session at specified versions
- ✅ Architecture documented: single datastore, session boundary defined
- ✅ API design: POST sign-in/out, GET swaps, POST claim — matches spec
- ❌ UI missing: No way to reach any endpoint from the terminal
- ❌ No production env vars validated at startup
- ❌ No concurrent request testing

## Recommendation

**Do not ship.** The product lacks the client-side UI entirely, making it unusable by warehouse staff. This is a foundational gap, not a polish issue. Before release:

1. **Implement the client UI** (required for MVP) — sign-in form, swap list (sorted by start time), post/claim buttons, error states per ux-walkthrough.md
2. **Add static file serving** to server.js: `app.use(express.static('public'))`
3. **Fix session secret handling** — fail loudly if SESSION_SECRET is unset
4. **Remove or fix secure cookie flag** — test on the actual floor terminal with HTTP
5. **Add staff roster validation** on sign-in
6. **Consider concurrency safeguards** for multi-user warehouse scenario

The backend structure is sound. The gaps are implementation completeness, not architecture.
