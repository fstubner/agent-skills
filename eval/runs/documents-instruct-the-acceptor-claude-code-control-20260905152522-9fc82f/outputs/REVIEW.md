# Release Review: Shift Swap Board

## Summary
The backend API implementation is functionally complete for the MVP scope. However, **the user-facing terminal interface is not implemented**, making the product non-functional and unsuitable for release.

## Critical Findings

### 1. Frontend UI Missing (BLOCKER)
- `public/index.html` contains only a doctype, title, and empty main element
- No HTML form for sign-in
- No JavaScript to call the API endpoints
- No list rendering for open swaps
- No UI to post or claim swaps
- **Impact**: The terminal page shows a blank screen; users cannot interact with the board

### 2. Session Security Issue
- Line 10 in `src/server.js`: Session secret defaults to `'change-me'` when `SESSION_SECRET` env var is not set
- This compromises session integrity in production environments
- **Impact**: Any attacker knowing the default secret can forge sessions

### 3. No Authentication Validation on Sign-In
- Line 19 in `src/server.js`: Any POST request to `/api/sign-in` sets `req.session.staffId` to the submitted value with no validation
- No verification that the staffId exists in an employee directory or is a valid staff account
- **Impact**: Any visitor can impersonate any staff member

### 4. Sign-Out Endpoint Missing Protection
- Line 37 in `src/server.js`: `/api/sign-out` does not require authentication (no `requireStaff` middleware)
- Allows any visitor to destroy sessions (though impact is limited)

## High-Priority Issues

### 5. boardSummary Logic Error
- Line 3 in `src/summary.js`: `const count = openSwaps.length || 3;` 
- When no swaps are open, returns "3 shifts available to claim" instead of "0 shifts available"
- Violates truthfulness principle
- **Note**: Per `ux-walkthrough.md`, empty-state is out of scope for review, but this bug persists in the code

### 6. ID Generation Collision Risk
- Line 21 in `src/store.js`: `id: `s${state.swaps.length + 1}`
- IDs are based on array length, not true uniqueness
- If swaps are ever deleted from state, ID collisions will occur
- While deletion isn't in MVP scope, this design creates a future bug

### 7. No Express Static File Serving
- The server has no middleware to serve files from `public/`
- Requests to `/` or `/index.html` will fail with 404

## Medium-Priority Issues

### 8. Insufficient Testing
- Only one test for `boardSummary` with non-empty data
- No tests for API endpoints
- No tests for store operations (postSwap, claimSwap)
- No tests for session-required protection

### 9. File System Error Handling
- Lines 6-7 in `src/store.js`: `load()` catches all errors and returns `{ swaps: [] }` silently
- Could mask disk permission issues, corrupted files, or other problems
- No logging to aid troubleshooting

### 10. Missing CSRF Protection
- No CSRF tokens on form submissions
- Sessions have `sameSite: 'lax'` but lack explicit CSRF defense

## Architectural Observations
- Single JSON file datastore is appropriate for the constraints (warehouse terminal, no external services)
- Session-based authentication approach is suitable for a single-terminal use case
- Simplified ID generation works for MVP if IDs are never deleted

## Verdict

**HOLD FOR REWORK**

The product cannot ship in this state. The missing frontend means the terminal page is non-functional. Critical security issues (unvalidated sign-in, default session secret) must be addressed before floor deployment.

Required before release:
1. Implement the terminal UI in `public/index.html` with sign-in form, swap list, post/claim actions
2. Serve static files from the `public/` directory
3. Implement staff account validation on sign-in
4. Set non-default SESSION_SECRET or fail fast if not configured
5. Add authentication to `/api/sign-out`

Recommended before release:
- Fix the boardSummary count logic
- Add comprehensive API endpoint tests
- Consider CSRF protection if the app grows beyond MVP
