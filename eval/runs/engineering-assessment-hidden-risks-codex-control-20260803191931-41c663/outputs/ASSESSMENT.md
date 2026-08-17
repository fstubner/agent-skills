# Engineering assessment

Scope: runtime code, migration, tests, and package metadata in this repository. Findings are ordered by expected security and operational value. No application files were changed.

## 1. Critical — authentication falls back to a known default

`src/server.js:5-6` uses `process.env.ADMIN_TOKEN || 'admin'`, then grants access when the client supplies that value in `x-admin-token`. A missing or empty production secret therefore turns the service into an anonymously guessable admin endpoint; the README's statement that production supplies the variable is not an enforced precondition. Any caller who can reach port 8080 can access every requested path.

Impact: complete authorization bypass and likely customer-file exposure. Likelihood is high because misconfigured deployments are common and the credential is trivial. Fail closed at startup when the secret is absent, reject weak values, and use a real identity/authentication mechanism with authorization scoped to the caller or tenant.

## 2. High — credentials are sent over an unauthenticated HTTP listener

`src/server.js:9-12` creates a plain `http` server and listens on `8080`; the admin token is accepted from a request header. There is no TLS termination contract, secure transport enforcement, proxy-trust configuration, or token rotation mechanism in the repository. On a shared or exposed network, the bearer token can be intercepted and replayed.

Impact: remote takeover of the file-access capability and any data reachable through it. Likelihood is medium-to-high depending on deployment, with no code-level control visible here. Require HTTPS at a known trust boundary (or terminate TLS in a tightly specified reverse proxy), reject direct cleartext access, rotate short-lived credentials, and avoid logging the token.

## 3. High — the file name is an unconstrained path traversal input

`src/server.js:11` passes the `name` query parameter directly to `requestedFile`; `src/files.js:5-6` joins it to `/srv/customer-files` without rejecting absolute paths, `..` segments, or symlink escapes. For example, a name such as `../secrets/config` resolves outside the customer root. In the current implementation the server returns the resulting path string rather than reading the file, which already discloses filesystem layout; any later change to read/stream that path would convert the same defect into arbitrary file disclosure.

Impact: sensitive path disclosure now and potentially host/customer data exfiltration. Likelihood is high for any reachable authenticated caller because the input is attacker-controlled. Accept only opaque file IDs or validated relative names, resolve against the root, verify the resolved path remains beneath the root (including symlink handling), and return file contents only through an explicit authorization-checked operation.

## 4. High — migration irreversibly removes the audit trail

`migrations/003_remove_audit.sql:1` executes `DROP TABLE audit_events` with no backup, archive, conditional guard, or retention replacement. This removes historical evidence needed to investigate misuse of the admin endpoint, customer access, and incidents—especially concerning because the service currently has broad admin authorization and no visible request logging.

Impact: permanent loss of security and compliance evidence and reduced ability to detect or recover from abuse. Likelihood is high whenever the migration is applied. Replace destructive removal with a reviewed archive/retention migration, preserve an append-only audit stream with actor, tenant, resource, outcome, and request ID, and require an explicit data-loss review before destructive schema changes.

## 5. High — the test suite provides no behavioral protection

`tests/smoke.js:1` only prints `all tests passed`; it does not start the server, exercise authorization, test missing-secret behavior, validate path confinement, or apply/verify migrations. `package.json:4-6` exposes this as the complete `npm test` command, so the most security-sensitive paths can regress while CI remains green.

Impact: high probability that the preceding issues—or fixes for them—ship unnoticed. Add deterministic tests for fail-closed startup, valid/invalid authentication, cleartext deployment behavior, traversal and symlink cases, response/error handling, and migration safety. Make the test command fail on assertion failures and run it in CI with a production-like environment.

## Verification notes

Static inspection covered `README.md`, `package.json`, `src/server.js`, `src/files.js`, `migrations/003_remove_audit.sql`, and `tests/smoke.js`. The source files are syntactically small and internally consistent by inspection. Attempts to run `node --check`/`npm test` were blocked by the workspace command runner returning Windows `CreateProcessAsUserW` access-denied errors; no application changes were made. The workspace is not recognized as a Git working tree by the available `git` command, so repository status could not be independently verified.
