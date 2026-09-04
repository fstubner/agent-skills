# Product Acceptance Review — Volunteer Shifts

## Verdict
**BLOCK**

## Scope
This review was conducted independently by examining project documents, architecture, implementation code, and the runtime environment. It covers:
- Contract compliance (PRODUCT.md Success and MVP)
- Architecture completeness (ARCHITECTURE.md)
- Primary path walkthrough feasibility (ux-walkthrough.md)
- Codebase audit for implementation
- Inability to run runtime verification due to the blocker below

## Critical Finding

The application is **not functional**. The public interface has no implementation.

### Evidence

**public/index.html** contains only:
```html
<!doctype html><title>Volunteer shifts</title><main id="app"></main>
```

There is no client-side JavaScript anywhere in the codebase (verified via full search of public/ and src/). The server.js provides only JSON API endpoints under `/api/` and does not serve static files, render HTML, or mount Express static middleware.

### Impact on MVP

All MVP requirements depend on a functional UI:

| MVP Requirement | Status | Evidence |
|---|---|---|
| List shifts needing cover | NOT IMPLEMENTED | No UI to display shifts |
| Sign myself up for a shift | NOT IMPLEMENTED | No form or button in HTML |
| Cancel my own sign-up | NOT IMPLEMENTED | No cancel UI |
| Sign out | NOT IMPLEMENTED | No sign-out button or UI flow |
| Coordinator sees same list with names | NOT IMPLEMENTED | No UI for coordinator view |

### Architecture Mismatch

ARCHITECTURE.md declares "`public/index.html` — the page" as the user interface component. The implementation contradicts this: the HTML file is an empty shell with no React, Vue, vanilla JS, or any rendering logic. The server does not serve it as a functional application.

## Secondary Issues

1. **Limited test coverage**: Only the `shifts.js` module has unit tests. The Express API routes in `server.js` are completely untested. No end-to-end or integration tests exist.

2. **Session security**: The session middleware uses a default secret (`'change-me'`) when `SESSION_SECRET` is not set, with no warning or enforcement in the code.

3. **Volunteer scope beyond API**: The PRODUCT.md states "Volunteers use phones" and "one coordinator uses a laptop", but there is no way for any user to access the system — no UI exists.

## What Was Not Verified

- Runtime execution: Cannot start the server without a functional UI to test against
- Walkthrough replay: Steps 1–5 cannot be performed (no sign-in form, no shift list, no assign/unassign UI, no sign-out flow)
- Empty state handling: Untestable without UI
- Error state handling: The API returns JSON errors like `{ error: 'already on a shift then' }`, but these cannot be displayed to users
- Accessibility: No keyboard navigation or screen-reader support can exist when there is no UI
- Mobile responsiveness: No viewport testing possible without UI implementation
- Design-direction compliance: Type sizes, tap targets, colors, and layout as described in `design-direction.md` are not implemented

## Recommendation

This project requires **UI implementation** before any acceptance. The backend API structure is sound (shift logic, coordinator-only guards, session handling), but the frontend is missing entirely. Return to the builder to:

1. Implement the UI in `public/index.html` and/or add client-side JavaScript (React, Vue, vanilla JS, or similar)
2. Serve static files from Express (add `app.use(express.static('public'))` or equivalent)
3. Implement the walkthrough steps as described
4. Add the missing tests for server.js API routes
5. Ensure design tokens from `design-direction.md` are applied

Once a functional UI exists and the walkthrough can be replayed end-to-end, re-submit for acceptance review.
