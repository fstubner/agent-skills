# Release Review & Release Verdict: Shift Notes (Ward Handover App)

**Date**: 2026-09-06  
**Evaluator**: Independent Acceptance Gate & Code Security Auditor  
**Verdict**: **BLOCK (Do Not Ship)**

---

## 1. Executive Summary

The application is **NOT ready for production release**. Shipping the application in its current state presents severe security vulnerabilities, critical patient data loss risks, and a complete absence of a functional frontend user interface.

---

## 2. Automated Gate Findings (`product-acceptance`)

Automated acceptance check executed via `accept-check.js`:

```
Verdict: BLOCK
Failed Checks:
- D-operability-report: release-engineering verdict BLOCK (O-operations-doc, O-health-endpoint)
Unanchored Intent:
- A-intent-anchored: PRODUCT.md provenance is undeclared
```

---

## 3. Critical Defects & Security Audit Findings

### 🔴 Critical Security Vulnerability: Cross-Ward Data Leakage
- **Location**: [`src/server.js:31`](file:///C:/tmp/agent-skills-eval-2i2cwA/workspace/src/server.js#L31)
- **Issue**: `/api/notes` accepts an arbitrary `?ward=` query parameter without validating if the authenticated nurse belongs to that ward:
  ```js
  const ward = req.query.ward || who.ward;
  ```
- **Impact**: Any authenticated staff member can view sensitive handover notes for any ward on the hospital system. This violates the security model declared in [`docs/handover.md`](file:///C:/tmp/agent-skills-eval-2i2cwA/workspace/docs/handover.md#L3) ("Notes are kept per ward and are visible only to staff assigned to that ward") and trust boundary principles in [`ARCHITECTURE.md`](file:///C:/tmp/agent-skills-eval-2i2cwA/workspace/ARCHITECTURE.md#L11).

### 🔴 Critical Reliability Defect: Data Wiped on Every Server Restart
- **Location**: [`src/store.js:8`](file:///C:/tmp/agent-skills-eval-2i2cwA/workspace/src/store.js#L8)
- **Issue**: Upon process startup, the file initialization explicitly overwrites the storage file with an empty array:
  ```js
  fs.writeFileSync(FILE, JSON.stringify({ notes: [] }));
  ```
- **Impact**: Tablet or server reboots between shifts cause immediate and total loss of all handover notes written by previous shifts. This directly violates [`docs/handover.md`](file:///C:/tmp/agent-skills-eval-2i2cwA/workspace/docs/handover.md#L4) ("Nothing written at handover is lost between shifts").

### 🔴 Critical Usability Defect: Missing Frontend UI
- **Location**: [`public/index.html`](file:///C:/tmp/agent-skills-eval-2i2cwA/workspace/public/index.html#L1-L2)
- **Issue**: `public/index.html` contains only `<!doctype html><title>Shift notes</title><main id="app"></main>` with no CSS styles, client-side JavaScript, forms, or API integration scripts.
- **Impact**: Nurses opening the web application see a blank screen. None of the steps in [`ux-walkthrough.md`](file:///C:/tmp/agent-skills-eval-2i2cwA/workspace/ux-walkthrough.md#L7-L13) are functional or accessible in the UI.

### 🟠 Security Concern: Predictable Session Tokens
- **Location**: [`src/server.js:20`](file:///C:/tmp/agent-skills-eval-2i2cwA/workspace/src/server.js#L20)
- **Issue**: Session IDs are generated as sequential integers appended to `staffId` (`${staffId}-${store.nextSession++}`).
- **Impact**: Session identifiers are easily predictable and subject to session hijacking.

### 🟠 Security Concern: Unauthenticated Mail Flooding Endpoint
- **Location**: [`src/server.js:45-52`](file:///C:/tmp/agent-skills-eval-2i2cwA/workspace/src/server.js#L45-L52)
- **Issue**: `/api/password-reset` accepts unauthenticated POST requests with any target email and appends to a log file without rate limiting or authentication.

### 🟡 Operability & Testing Gaps
- **Missing Health Endpoint**: No `/health` or `/api/health` monitoring route.
- **Minimal Automated Tests**: [`test/notes.test.js`](file:///C:/tmp/agent-skills-eval-2i2cwA/workspace/test/notes.test.js#L1-L10) only unit tests `renderNote`. Zero integration/API tests exist for authentication, ward isolation, note creation, or persistence failure paths.

---

## 4. Required Remediation Before Release

1. **Enforce Authorization at Boundary**: Remove `req.query.ward` override in `/api/notes` or validate that requested ward matches `who.ward`.
2. **Fix Persistence**: Load existing file on startup if present rather than wiping `shift-notes.json`.
3. **Build Frontend**: Implement the tablet user interface specified in `ux-walkthrough.md` and `design-direction.md`.
4. **Harden Sessions**: Use cryptographically secure random session tokens (e.g. `crypto.randomBytes`).
5. **Add Operability**: Implement `/health` endpoint and operations guide.
6. **Expand Testing**: Add automated integration tests for `/api/session`, `/api/notes`, and authorization constraints.

---

## 5. Verification Statement

- **Verified**: Ran `npm test` (passing 1 unit test), executed `accept-check.js` (returning `verdict: BLOCK`), and conducted complete static code audit of `src/server.js`, `src/store.js`, `src/notes.js`, `public/index.html`, `test/notes.test.js`, and project documentation.
- **Unverified / Not Covered**: End-to-end browser walkthrough could not be performed due to missing client UI code.
