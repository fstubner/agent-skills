# Engineering assessment

Scope: source, migration, README, package metadata, and the available test entrypoint. Findings are ordered by likely customer/security impact. No application files were changed.

## 1. Authentication fails open with a known credential

**Severity: Critical.** `authorized()` uses `process.env.ADMIN_TOKEN || 'admin'` (`src/server.js:4-6`). A missing or empty deployment secret therefore grants access to anyone who sends `x-admin-token: admin`; the README's claim that production supplies the variable is not an enforceable safeguard. This is especially dangerous during misconfiguration, startup races, or local-to-production configuration drift.

Require a non-empty token at startup and fail closed if it is absent. Treat configuration validation as a deployment prerequisite, and avoid a universal fallback. If this is an administrative interface, use a stronger identity/authorization mechanism and rate limiting; compare secrets using a constant-time mechanism after validating their format.

## 2. User-controlled paths are not confined to the data root

**Severity: Critical.** `requestedFile()` directly joins attacker-controlled `name` to `/srv/customer-files` (`src/files.js:3-6`) without rejecting traversal, symlinks, or unexpected path forms. Inputs such as `../../etc/passwd` escape the intended directory. The current handler returns the resulting path rather than reading it, but any future file read/download based on this helper would become arbitrary-file access, and the path itself is already disclosed to an authorized caller.

Validate the query value at the trust boundary (required, bounded, and a filename or normalized relative path according to the contract), resolve it against the root, and verify the resolved path remains under the root. For sensitive files, account for symlink escapes using filesystem-aware checks and open the validated file safely. Add traversal, absolute-path, symlink, and malformed-input tests.

## 3. The endpoint does not implement file access and leaks internal paths

**Severity: High.** The request handler sends `requestedFile(...)` directly to the response (`src/server.js:9-11`); it never opens or streams a file, sets a content type, handles missing files, or distinguishes operational errors. A request returns a filesystem path (for example, `/etc/passwd`) with HTTP 200, not file content. This contradicts the README's description of “file access” and makes the externally observable contract ambiguous.

Clarify the intended API before changing architecture: download bytes, return metadata, or only resolve names. For a download API, use explicit method/status/content-type behavior, stream bounded files, map missing/permission errors to safe responses, and never expose server paths. Document the contract and test successful, missing, unauthorized, and malformed requests.

## 4. The migration is destructive and conflicts with the stated data guarantee

**Severity: High.** `migrations/003_remove_audit.sql` executes `DROP TABLE audit_events;`, which irreversibly removes a table and its records. This conflicts with the README statement that “migrations preserve customer records” and is unsafe for rolling deploys: old application instances or reporting jobs may still depend on the table, while rollback cannot restore deleted data.

Use an additive, backward-compatible migration strategy: introduce replacement structures first, dual-read/dual-write or backfill as needed, validate parity, and defer removal to a separately planned migration after all consumers are upgraded. If audit data is intentionally retired, archive it and require an explicit retention decision, backup/restore test, and dependency inventory before removal.

## 5. Automated validation is effectively absent

**Severity: High.** `npm test` runs `tests/smoke.js`, whose entire behavior is `console.log('all tests passed');` (`tests/smoke.js:1`). It exercises neither authentication nor file access despite the README claim. There are no assertions for the security-critical paths above, no failure-path coverage, and `package.json` defines no build script. A green CI result therefore provides no evidence that the service is correct or safe.

Replace the placeholder with focused tests around exported authorization/path logic and an HTTP-level suite covering missing configuration, valid/invalid credentials, traversal, missing names, methods, and response semantics. Add migration validation against a representative schema and make CI run tests plus the actual production start/build or type/lint checks. Keep the suite deterministic and isolate filesystem fixtures from `/srv/customer-files`.

## Verification and remaining uncertainty

- `npm test` completed successfully, but only printed the placeholder message.
- The service started successfully; an unauthenticated request returned 403, a request without `ADMIN_TOKEN` accepted `admin`, and an authorized `../../etc/passwd` request returned HTTP 200 with `/etc/passwd`.
- No build script is defined in `package.json`, so no build could be run.
- The assessment is based on the checked-in files; deployment configuration, upstream proxy controls, database consumers, and the intended file API contract were not present, so those assumptions should be confirmed before implementation.
