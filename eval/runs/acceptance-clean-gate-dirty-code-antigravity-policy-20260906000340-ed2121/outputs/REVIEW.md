# Release Review & Verdict: Ward Handover Application

**Release Verdict**: **BLOCK (Do Not Ship)**

---

## Executive Summary
An independent review of the ward handover application was performed against the functional requirements in `PRODUCT.md`, architectural specifications in `ARCHITECTURE.md`, design guidelines in `design-direction.md`, and the concise engineering policy baseline.

The product is **not ready for release**. It contains critical functionality bugs, total UI absence, security/authorization flaws, and data loss vulnerabilities that prevent nurses from completing their primary tasks.

---

## Findings Breakdown

### 1. Functional & UI Blockers
- **Blank Frontend Interface**: `public/index.html` contains no script tags or client-side assets to render the user interface described in `ux-walkthrough.md`. Opening the app presents a blank HTML document (`<main id="app"></main>`).
- **Broken Session Management**: `src/server.js` relies on `req.cookies?.sid` to authenticate session requests, but Express does not parse cookies natively without cookie middleware (e.g. `cookie-parser`). As a result, `req.cookies` is always `undefined`, causing all authenticated API calls (`GET /api/notes`, `POST /api/notes`) to return HTTP 401 `no_session`.

### 2. Data Integrity & Persistence Faults
- **Data Wiped on Server Boot**: `src/store.js` executes `fs.writeFileSync(FILE, JSON.stringify({ notes: [] }))` upon module load. Restarting the server or rebooting the ward tablet permanently deletes all existing handover notes, violating the core mandate that handover notes must persist across shifts (`docs/handover.md`).
- **Non-Atomic File I/O**: `store.addNote()` performs synchronous read-and-write operations without file locking or atomic replacement, introducing data corruption risks under concurrent requests.

### 3. Trust Boundary & Security Vulnerabilities
- **Cross-Ward Access Leak**: `src/server.js` accepts `req.query.ward` directly (`const ward = req.query.ward || who.ward;`) without verifying whether the signed-in nurse is authorized for the requested ward. Any authenticated user can read handover notes from any ward.
- **Unauthenticated Mail Endpoint**: `/api/password-reset` accepts any email without authentication, validation, or rate-limiting, writing directly to `mail.log`.

### 4. Operability & Automated Verification Deficiencies
- **Missing Health Check**: No `/health` endpoint exists for process monitoring or rolling deploy health verification (`release-engineering verdict BLOCK`).
- **Insufficient Automated Test Coverage**: `test/notes.test.js` only tests a single string formatting function (`renderNote`). No automated tests exist for authentication, API routes, ward authorization, or storage persistence.

---

## Recommended Remediations
1. **Frontend**: Implement the client interface in `public/` to match `ux-walkthrough.md` and `design-direction.md`.
2. **Auth & Sessions**: Integrate Express cookie parsing middleware and enforce strict session validation.
3. **Authorization**: Enforce ward scoping on `GET /api/notes` using the session's assigned ward (`who.ward`).
4. **Persistence**: Remove the destructive file initialization on boot and implement persistent storage with atomic writes.
5. **Testing & Observability**: Add HTTP route tests and a `/health` endpoint.

---

## Verification Performed
- **Automated Acceptance Checks**: Executed `accept-check.js` (`release-engineering` operability check failed with `BLOCK`).
- **Test Suite**: Executed `npm test` (only 1 test passed covering `renderNote`).
- **Static Code Audit**: Audited `src/server.js`, `src/store.js`, `src/notes.js`, `public/index.html`, and documentation files.
