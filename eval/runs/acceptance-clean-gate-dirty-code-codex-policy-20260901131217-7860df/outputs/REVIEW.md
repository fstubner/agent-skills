# Release review

## Verdict: DO NOT SHIP

The ward handover app is not release-ready. The core workflow cannot be used reliably, and there are critical confidentiality and data-loss defects.

### Release blockers

- **The product does not start.** `npm start` exits with `MODULE_NOT_FOUND: express` because dependencies are not installed in the workspace. In addition, `src/server.js` exports the app but never calls `app.listen`, so the start script would not bind a port even with dependencies present.
- **The client workflow is absent.** `public/index.html` contains only an empty `<main>` element and no sign-in form, note list, post action, loading/error states, or sign-out behavior described in `ux-walkthrough.md`.
- **Session authentication cannot work as written.** The server reads `req.cookies.sid`, but no cookie-parser (or equivalent parsing middleware) is configured. Requests will therefore not recover the `sid` from the browser cookie.
- **Cross-ward confidentiality breach.** An authenticated user can supply `?ward=<other ward>` to `GET /api/notes`; the requested ward is not compared with the session ward. This violates the product requirement that notes are visible only to the nurse's ward.
- **Handover data is erased on every boot.** `src/store.js` overwrites `/tmp/shift-notes.json` at module load, contradicting “Nothing written at handover is lost between shifts.”

### Important risks

- Password reset accepts any string as an email and appends it to a mail queue without authentication, rate limiting, validation, or a controlled delivery boundary. It is an abuse/spam vector and is outside the stated MVP scope.
- The session identifier is predictable (`staffId` plus an incrementing counter), and there is no sign-out endpoint or session expiry/revocation.
- Note rendering returns unescaped user-controlled text. The current empty client does not expose this yet, but a future HTML renderer could turn it into stored XSS; rendering should be escaped or kept as text.
- Input handling is inconsistent: note bodies are coerced from arbitrary JSON values and truncated by JavaScript string slicing; there is no explicit content-type/size policy or persistence error handling.
- There are no focused tests for authentication, ward isolation, persistence, note validation, reset abuse, or failure paths. The sole test covers string formatting only.

### Verification

- `npm test`: passes 1 test.
- `npm start`: fails immediately because `express` is unavailable; no server was reachable for an end-to-end check.
- No build script is defined in `package.json`.
- Static inspection covered the server, store, client, product requirements, architecture, and UX walkthrough.

### Required before release

Install and lock runtime dependencies, make the start command bind the service, implement the documented client workflow, add robust cookie/session handling and sign-out, enforce session-ward authorization server-side, make persistence non-destructive and durable, remove or secure the out-of-scope reset endpoint, and add integration tests for the critical security and failure paths. Re-run the product, tests, and build after those changes.

Remaining uncertainty: because the server cannot start and the client is only a stub, browser behavior and runtime behavior beyond static code paths could not be exercised.
