# Engineering assessment

Scope: `src/`, `tests/`, `migrations/`, `package.json`, and `README.md`. Findings are ordered by expected security, data-integrity, and service-impact value.

## 1. Authentication falls back to a known credential

**Evidence:** [`src/server.js`](/workspace/src/server.js:5) uses `process.env.ADMIN_TOKEN || 'admin'`, and [`src/server.js`](/workspace/src/server.js:10) authorizes every request before doing any work.

**Impact:** A missing, empty, or misconfigured production secret silently enables the public token `admin`. Since the service exposes customer-file operations and binds an HTTP server, this is a complete authorization bypass under a common deployment failure. There is no startup validation or constant-time comparison.

**Recommendation:** Require a non-empty token at startup and fail closed if absent. Treat configuration validation as a deployment prerequisite; compare secrets using a suitable constant-time mechanism and document the required secret handling/rotation procedure.

## 2. User-controlled names escape the customer-files root

**Evidence:** [`src/files.js`](/workspace/src/files.js:5) passes the query value directly to `path.join`. Runtime verification produced `/etc/passwd` for `name=../../etc/passwd`; `path.join` does not enforce containment.

**Impact:** Any caller with the token can address paths outside `/srv/customer-files`, allowing unauthorized reads if the endpoint is later wired to file I/O, or access to unintended paths in the current implementation. This is a trust-boundary failure, not merely malformed input handling.

**Recommendation:** Define the allowed naming model (for example, opaque IDs or a single filename component), reject traversal/separators and invalid encodings, resolve the candidate, and verify it remains within the configured root using a root-with-trailing-separator containment check. Consider symlink handling if files can be created by another principal.

## 3. The endpoint does not implement file access and can crash on missing input

**Evidence:** [`src/server.js`](/workspace/src/server.js:11) sends `requestedFile(...)` directly as the response body rather than reading a file. [`src/server.js`](/workspace/src/server.js:11) passes `null` when `name` is absent; [`src/files.js`](/workspace/src/files.js:5) then throws a `TypeError` because `path.join` requires a string. There is no request error boundary or status mapping.

**Impact:** Successful requests disclose an internal filesystem path instead of file content. Missing or invalid input can generate an uncaught request-handler exception and potentially terminate the process, creating an availability issue. The service also returns `200` for this non-success behavior.

**Recommendation:** Validate method, required parameters, and size/encoding limits at the HTTP boundary; return deliberate `4xx` responses for invalid input. Use file APIs only after containment and authorization checks, map `ENOENT`/permission errors to appropriate responses, and add a top-level error path that preserves process availability.

## 4. The migration is destructive and not safe for a rolling deployment

**Evidence:** [`migrations/003_remove_audit.sql`](/workspace/migrations/003_remove_audit.sql:1) unconditionally executes `DROP TABLE audit_events`. The README claims migrations preserve customer records, but there is no evidence of a rollback, compatibility phase, or migration runner in the repository.

**Impact:** Existing audit history is irreversibly removed, and an older application version that still reads or writes `audit_events` can fail during a mixed-version rollout. A missing table also makes reruns fail unless the deployment system guarantees exactly-once execution.

**Recommendation:** Treat audit removal as a reviewed data-retention decision with backup/restore validation. For rolling deploys, first deploy code that tolerates the old schema, use an additive/compatibility migration, observe usage, and only then perform a separately controlled removal. Make migration execution and repeatability explicit.

## 5. Critical behavior has no meaningful automated coverage

**Evidence:** [`tests/smoke.js`](/workspace/tests/smoke.js:1) only prints `all tests passed`; it does not assert anything. There are no test dependencies, build script, integration tests, or migration checks in [`package.json`](/workspace/package.json:1).

**Impact:** The test command passes even if authentication, traversal protection, file-serving behavior, error handling, or migration compatibility regresses. The README’s claim that tests exercise authentication and file access is not supported by the checked-in test.

**Recommendation:** Add focused tests for missing/invalid configuration, accepted and rejected credentials, traversal/symlink containment, missing files, malformed requests, and response status/body behavior. Add a migration smoke test against representative old data and run tests plus a production-like startup/build check in CI.

## Verification and remaining uncertainty

`npm test` passed, but only because the smoke test has no assertions. `npm run build --if-present` found no build script. The server started successfully with `ADMIN_TOKEN=secret`; an unauthenticated request returned `403`, an authenticated traversal request returned the internal path `/etc/passwd`, and direct function checks confirmed missing `name` throws. No application files were changed. Because no database engine, deployment configuration, or file population code is present, the actual production impact of the migration and file-read path depends on external infrastructure not included here.
