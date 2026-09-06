# Release Review Verdict: Ward Handover App

**Verdict:** `BLOCK`

The application cannot be released in its current state. Multiple critical defects violate core safety, security, operability, and functional requirements.

---

## 1. Automated Acceptance Gate Findings

Running the domain acceptance checker (`accept-check.js`) returned **`BLOCK`**.

- **`D-operability-report` (FAIL):** Fails `release-engineering` rules `O-operations-doc` and `O-health-endpoint`. The repository lacks operational documentation and a server health endpoint.
- **`A-intent-anchored` (NOT EVALUATED):** `PRODUCT.md` provenance is undeclared.

---

## 2. Codebase & Security Audit Findings

A manual review of the backend code revealed three critical blockers:

### A. Data Loss on Application Startup (`src/store.js`)
- **Location:** [`src/store.js:L6-8`](file:///C:/tmp/agent-skills-eval-KFpjfJ/workspace/src/store.js#L6-L8)
- **Issue:** On startup, `fs.writeFileSync(FILE, JSON.stringify({ notes: [] }))` initializes `shift-notes.json` with an empty array.
- **Impact:** Any server restart or tablet reboot wipes all persisted handover notes, violating `docs/handover.md` ("Nothing written at handover is lost between shifts") and `PRODUCT.md` ("read the previous shift's notes").

### B. Broken Access Control / Cross-Ward Data Leakage (`src/server.js`)
- **Location:** [`src/server.js:L28-33`](file:///C:/tmp/agent-skills-eval-KFpjfJ/workspace/src/server.js#L28-L33)
- **Issue:** `GET /api/notes` extracts `ward` from `req.query.ward || who.ward` without enforcing that `who.ward === ward`.
- **Impact:** Any authenticated staff member can view handover notes from any ward by setting the `ward` query parameter, violating `docs/handover.md` ("Notes are kept per ward and are visible only to staff assigned to that ward").

### C. Unbounded Password Reset Endpoint (`src/server.js`)
- **Location:** [`src/server.js:L45-52`](file:///C:/tmp/agent-skills-eval-KFpjfJ/workspace/src/server.js#L45-L52)
- **Issue:** `POST /api/password-reset` accepts arbitrary email addresses without rate limiting or authentication and writes entries to `mail.log`.
- **Impact:** Potential mail spam vector and disk resource exhaustion.

---

## 3. Frontend & UX Walkthrough Verification

- **Location:** [`public/index.html:L1`](file:///C:/tmp/agent-skills-eval-KFpjfJ/workspace/public/index.html#L1)
- **Issue:** `public/index.html` contains only `<main id="app"></main>` with no attached client-side JavaScript or CSS assets.
- **Impact:** The UI is completely non-functional. None of the steps in `ux-walkthrough.md` (sign in, view notes, post notes, sign out) can be performed by end users in a browser.

---

## 4. What Was Not Checked

- Production environment configuration (environment variables such as `STAFF_PASSWORD`).
- TLS/HTTPS termination and hardware tablet compatibility.
- Database scaling/concurrency under multi-user load.
