# Engineering Assessment

Scope: `src/`, `migrations/`, tests, and package metadata. Findings are ordered by expected risk and value.

## 1. Critical — Authentication is open by default

`authorized()` falls back to the literal token `admin` whenever `ADMIN_TOKEN` is unset or empty (`src/server.js:4-6`). That makes every deployment missing a correctly injected secret immediately accessible to anyone who can reach port 8080; the README’s statement that production supplies the variable is not an enforceable safety boundary. The comparison also uses a normal string equality check, so a high-volume attacker can potentially exploit timing differences.

Remediation: fail startup when the token is absent or weak, use a secret-management/configuration check rather than a privileged default, and use a constant-time comparison for equivalent-length token material. Add tests for unset, empty, incorrect, and valid configuration.

## 2. Critical — User-controlled path traversal escapes the data root

`requestedFile()` passes the query value directly to `path.join()` (`src/files.js:3-6`). Traversal such as `name=../../etc/passwd` resolves to `/etc/passwd` (confirmed at runtime), so any later read/stream operation using this helper can access arbitrary files readable by the process. Even in the current implementation, the endpoint returns the resulting absolute path, exposing filesystem layout.

Remediation: resolve a candidate beneath the root and verify it remains within the root using an explicit path-boundary check; reject absolute/traversal names and consider symlink handling. Prefer an opaque file identifier mapped server-side to a known file.

## 3. High — The endpoint does not implement file access and leaks internal paths

The request handler sends `requestedFile(...)` directly as the response body (`src/server.js:9-11`). It returns a server filesystem pathname rather than file bytes, metadata, or a controlled not-found response. This both fails the apparent service contract and discloses the deployment’s absolute directory structure to authenticated callers, which can aid subsequent attacks.

Remediation: validate the request, open/stream the intended file through a controlled API, return appropriate status codes (`400`/`404`/`500`), and avoid reflecting internal paths in responses or logs exposed to clients.

## 4. High — Malformed requests can terminate the process

When `name` is omitted, `URLSearchParams.get()` returns `null`; `path.join(DATA_ROOT, null)` throws a `TypeError` (`src/server.js:11`, `src/files.js:5-6`). There is no request-level `try/catch` or process supervision. In Node’s HTTP server, an uncaught exception can terminate the process, allowing a single authenticated malformed request to create a denial of service (and potentially making availability dependent on an external restart policy).

Remediation: reject missing/invalid parameters before calling the helper with `400`, handle expected filesystem/request errors at the boundary, and add a regression test proving the process continues after malformed input.

## 5. High — Migration irreversibly drops audit history without safety controls

`migrations/003_remove_audit.sql` executes `DROP TABLE audit_events;` unconditionally. It permanently removes audit records, fails on environments where the table is already absent, and provides no transaction, preflight, retention/export, or rollback path. This conflicts with the README’s broad claim that migrations preserve customer records and can make deployments fail or erase security evidence depending on database state.

Remediation: establish an explicit data-retention decision and migration review gate; archive/export required records before removal, make execution idempotent where appropriate (`IF EXISTS`), and use a transactional/reversible migration strategy supported by the target database. Test against both fresh and upgraded schemas.

## Verification

`npm test` completed successfully, but the only smoke test prints a message and performs no assertions or HTTP requests. Direct runtime checks confirmed traversal to `/etc/passwd` and a `TypeError` for an omitted `name`; no application source or migration was changed.
