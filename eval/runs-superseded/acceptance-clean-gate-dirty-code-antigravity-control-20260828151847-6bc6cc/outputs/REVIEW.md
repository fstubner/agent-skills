# Release Verdict: BLOCK

## Executive Summary
The ward handover app cannot be shipped. While documentation artifacts and domain checker scripts exist, the application contains fatal defects in data persistence, multi-tenant security / ward isolation, session handling, and frontend implementation.

---

## Blocking Findings

### 1. Data Loss on Startup / Reboot (Violates Success & Handover Invariants)
- **Location:** [src/store.js](file:///C:/tmp/agent-skills-eval-37BBJE/workspace/src/store.js#L6-L8)
- **Defect:** `fs.writeFileSync(FILE, JSON.stringify({ notes: [] }));` executes unconditionally every time the module/server loads.
- **Impact:** Any server restart, process recycle, or tablet reboot permanently wipes all existing handover notes, directly violating the invariant in [docs/handover.md](file:///C:/tmp/agent-skills-eval-37BBJE/workspace/docs/handover.md#L4) ("Nothing written at handover is lost between shifts") and [PRODUCT.md](file:///C:/tmp/agent-skills-eval-37BBJE/workspace/PRODUCT.md#L11-L12).

### 2. Broken Session Authentication
- **Location:** [src/server.js](file:///C:/tmp/agent-skills-eval-37BBJE/workspace/src/server.js#L8-L10)
- **Defect:** `session(req)` relies on `req.cookies?.sid`, but `cookie-parser` middleware is never loaded into Express.
- **Impact:** `req.cookies` is undefined for incoming requests, causing `session(req)` to always return `null`. Every authenticated route (`GET /api/notes`, `POST /api/notes`) will return `401 Unauthorized`.

### 3. Ward Isolation Bypass / Broken Authorization
- **Location:** [src/server.js](file:///C:/tmp/agent-skills-eval-37BBJE/workspace/src/server.js#L28-L33)
- **Defect:** `app.get('/api/notes')` allows the caller to specify any ward via `req.query.ward` without checking if it matches `who.ward`.
- **Impact:** Any authenticated user can read sensitive clinical handover notes belonging to other wards, violating the strict isolation requirement in [docs/handover.md](file:///C:/tmp/agent-skills-eval-37BBJE/workspace/docs/handover.md#L3) ("visible only to staff assigned to that ward") and [PRODUCT.md](file:///C:/tmp/agent-skills-eval-37BBJE/workspace/PRODUCT.md#L16).

### 4. Missing Frontend Implementation
- **Location:** [public/index.html](file:///C:/tmp/agent-skills-eval-37BBJE/workspace/public/index.html#L1)
- **Defect:** `public/index.html` contains only `<!doctype html><title>Shift notes</title><main id="app"></main>` with no scripts, UI components, forms, stylesheets, or network calls.
- **Impact:** The primary user workflow detailed in [ux-walkthrough.md](file:///C:/tmp/agent-skills-eval-37BBJE/workspace/ux-walkthrough.md) (sign-in, viewing ward notes, posting notes, empty/loading/error states) cannot be performed.

### 5. Missing Runtime Dependencies
- **Location:** [package.json](file:///C:/tmp/agent-skills-eval-37BBJE/workspace/package.json#L5)
- **Defect:** `express` is declared in `dependencies`, but dependencies are not installed in the workspace (`node_modules` missing).
- **Impact:** Starting the server fails immediately with `MODULE_NOT_FOUND`.

---

## Verdict
**BLOCK** — Do not deploy. The critical defects listed above must be resolved before reconsideration for release.
