# Acceptance Review: Volunteer Shifts Tool

**Verdict: BLOCK**

## Gate Compliance

✓ Required documents present with real content:
  - PRODUCT.md with Purpose, Users, Success, MVP, Constraints
  - ARCHITECTURE.md with Parts and Decisions  
  - design-direction.md with Interview and Direction
  - ux-walkthrough.md with steps and states

Backend tests pass (2/2), confirming shifts.js logic works.

## Critical Blockers

### 1. Product/Implementation Mismatch (Primary Path Failure)
**Severity: BLOCK**

PRODUCT.md Success clause states: *"A volunteer can see which shifts still need cover and sign up for a shift themselves, and the coordinator sees the gaps fill without chasing anyone."*

**What's actually built:**
- Coordinator-only assignment model: `/api/shifts/:id/assign` endpoint requires `requireCoordinator` middleware
- Volunteers cannot self-sign; only the coordinator can assign them to shifts
- ux-walkthrough.md describes coordinator assigning volunteers, not volunteers self-signing
- ARCHITECTURE.md explicitly states: "Assignment is a coordinator action. Volunteers do not write to the rota."

**Result:** The implementation contradicts the stated success criteria. The primary job described in PRODUCT.md is not completable as written.

### 2. No Frontend Implementation
**Severity: BLOCK**

- `public/index.html` is an empty skeleton: `<main id="app"></main>` only
- Zero JavaScript in the frontend (no React, Vue, vanilla, or bundled code)
- No UI to render shift lists, handle sign-in, or perform assignments
- API endpoints exist but are unreachable without a working client

**Result:** The application has no runnable interface. The shifts cannot be viewed or managed by anyone.

### 3. API Not Exercised in Tests
**Severity: BLOCK**

- Tests import and call `shifts.js` functions directly
- HTTP API endpoints (`/api/sign-in`, `/api/shifts`, `/api/shifts/:id/assign`) are never tested
- Session handling, authentication, and authorization are untested
- No verification the server can start or respond to requests

**Result:** No evidence the system works end-to-end.

### 4. Session Insecurity
**Severity: BLOCK**

`src/server.js` line 9: `secret: process.env.SESSION_SECRET ?? 'change-me'`

Session secret falls back to plaintext `'change-me'` if `SESSION_SECRET` is not set. Food bank coordinators may run the app without explicitly configuring the secret, leaking session tokens to anyone with the predictable key.

**Result:** Volunteer and coordinator sessions are not confidential.

## What Was Not Checked

- Narrow viewport testing (376px as per design-direction): frontend doesn't exist
- Keyboard-only navigation: frontend doesn't exist  
- Network error recovery: frontend doesn't exist
- Input validation and XSS guards: frontend doesn't exist
- Empty/error/loading states: frontend doesn't exist
- Accessibility (WCAG): frontend doesn't exist

## Recommendation

This product cannot enter any usage phase in its current state. Before re-review:

1. Resolve the product requirement mismatch: decide whether volunteers self-sign or the coordinator assigns, and align PRODUCT.md with ARCHITECTURE.md and implementation
2. Implement the frontend (HTML/CSS/JS) to display shifts and handle user interactions
3. Test the API end-to-end (sign-in, list, assign, unassign, sign-out)
4. Set `SESSION_SECRET` as a required configuration, remove the hardcoded fallback
5. Re-walkthrough the entire primary path in a real browser

**Status:** Release blocked until all blockers are resolved.
