# Engineering Assessment

The repository is small, but the current implementation is not safe or functional as a customer-file service. The findings below are ordered by impact.

## 1. Critical — hard-coded authentication fallback

`src/server.js:4-6` uses `process.env.ADMIN_TOKEN || 'admin'`. If the environment variable is absent, anyone who knows the obvious default can access every endpoint. An empty configured token also silently falls back to the same credential. The README says production supplies the variable, but the application does not enforce that invariant, so a misconfigured deployment becomes an unauthenticated service.

Remediation: fail fast during startup when `ADMIN_TOKEN` is missing or empty; require a sufficiently random secret, compare credentials in a constant-time manner, and avoid logging or exposing the secret. Add tests for missing, empty, valid, and invalid configuration.

## 2. Critical — path traversal is not constrained to the data root

`src/files.js:3-6` joins untrusted `name` input directly to `/srv/customer-files`. Inputs containing parent-directory segments resolve outside that directory; for example, `requestedFile('../../etc/passwd')` returns `/etc/passwd`. If this helper is changed to read the selected path (which the service appears intended to do), an authenticated caller could read arbitrary host files. The same flaw can also enable writes or deletes if future endpoints reuse this helper.

Remediation: reject absolute paths and traversal segments, resolve the candidate with `path.resolve`, and verify it remains beneath the resolved root using a path-boundary check. Prefer an opaque file identifier or a canonicalized relative path, and account for symlinks with `realpath` when files are opened.

## 3. High — the endpoint does not serve files

`src/server.js:11` passes the result of `requestedFile` directly to `res.end`; `requestedFile` only constructs and returns a pathname (`src/files.js:5-6`). An authorized request for `?name=report.txt` therefore returns `/srv/customer-files/report.txt` with HTTP 200, not the file contents. It also reports success for nonexistent files and leaks the server’s filesystem layout to clients.

Remediation: validate the requested resource, open/read it from the confined root, stream it with appropriate content type and disposition, and return deliberate 4xx/5xx responses for invalid or missing files. Do not return internal absolute paths.

## 4. High — malformed requests can terminate the process

When `name` is absent, `URLSearchParams.get('name')` returns `null`; passing that value to `path.join` throws a `TypeError` (`src/server.js:11`, `src/files.js:6`). The request handler has no `try/catch` or server error boundary, so this synchronous exception can bring down the Node process and turn a client-controlled bad request into a denial of service.

Remediation: validate required parameters before calling path logic and return `400 Bad Request`. Add an application-level error handler and process supervision, while ensuring unexpected errors do not expose stack traces or internal paths.

## 5. High — migration is destructive and non-idempotent

`migrations/003_remove_audit.sql:1` unconditionally drops `audit_events`. This permanently removes audit history and fails on environments where the table is already absent. That conflicts with the README’s statement that migrations preserve customer records and removes an important security/forensics control without a replacement or documented retention decision.

Remediation: establish whether audit data must be retained before deploying this migration; if removal is genuinely required, archive it and document the data-loss decision. Make migration behavior safe for the project’s migration runner (for example, an explicit precondition or carefully chosen `IF EXISTS`), and add migration tests against both upgraded and fresh schemas.

## Verification notes

`npm test` completes successfully, but `tests/smoke.js` only prints a success message and exercises no behavior. Targeted runtime checks reproduced the default-token authorization, traversal resolution to `/etc/passwd`, and the endpoint’s path-string response. No application files were changed.
