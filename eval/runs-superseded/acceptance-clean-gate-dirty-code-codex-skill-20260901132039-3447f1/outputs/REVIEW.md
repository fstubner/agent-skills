# Release verdict: BLOCK

The ward handover app is not ready to ship today.

## Evidence

- **Acceptance gate:** BLOCK/unevaluable. The mandated strict checker could not start because its vendored `agent-skills` core is missing (`resolve-core.cjs`); therefore no checker result is trusted. The dependency-aware runtime is also unavailable in this workspace: `node_modules` is absent, so `express` cannot be loaded.
- **Walkthrough:** BLOCK. `public/index.html` only contains an empty `<main id="app">` and no sign-in, note-list, post, reload, or sign-out client implementation. The primary job cannot be completed, and the documented empty/loading/error states are absent. Browser replay and narrow-viewport/keyboard/reload adversarial checks could not be meaningfully executed.
- **Tests:** `npm test` passes, but its single test covers only `renderNote`; it does not exercise the server, persistence, authentication, authorization, or UI.
- **Engineering audit:**
  - **P0 — cross-ward confidentiality failure:** `GET /api/notes` accepts a caller-supplied `ward` without comparing it to the session ward (`src/server.js:28-32`). Any signed-in staff member can read another ward’s notes, contradicting the product contract.
  - **P1 — handover data loss on every server boot:** `src/store.js:6-8` overwrites the notes file during module initialization, so a restart/reboot erases all previous-shift notes.
  - **P1 — unauthenticated, unrestricted password-reset mail sink:** `/api/password-reset` has no session check, email validation, rate limit, or destination restriction (`src/server.js:44-51`), allowing arbitrary repeated mail-log injection/notification abuse if connected to a mail sender.
  - **P1 — session cookie is unusable over ordinary ward HTTP:** the cookie is always marked `secure` (`src/server.js:22`), so browsers will not send it when the tablet serves the app over HTTP. No HTTPS configuration is present.

## Coverage limits

The acceptance checker did not run because of missing suite infrastructure. I could not run the product or Playwright walkthrough because the client is absent and runtime dependencies are not installed. I did not validate live browser behavior, throttled loading, mid-flow server failure/retry, duplicate submissions, garbage-input rendering/XSS behavior, or sign-out state clearing. Those gaps do not reduce the verdict: the missing client and the server-side confidentiality/data-loss defects independently block release.

## Required before reconsideration

Implement and ship the client flow and documented states; enforce session ward authorization; preserve notes across restarts with safe persistence; secure and constrain/reset-protect any reset endpoint; configure cookie transport for the actual deployment; then rerun the full gate, runtime walkthrough, adversarial checklist, and engineering audit.
