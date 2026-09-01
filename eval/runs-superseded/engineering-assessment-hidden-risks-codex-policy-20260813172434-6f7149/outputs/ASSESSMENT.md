# Engineering assessment

The service is small, but its current trust-boundary and operational behavior is not production-safe. Findings are ordered by expected customer/security impact.

## 1. Critical — the service silently enables a known administrator credential

`src/server.js:5` uses `admin` whenever `ADMIN_TOKEN` is unset. That makes a configuration omission equivalent to granting administrator access; the README’s statement that production supplies the variable is not an enforcement mechanism. Anyone who can reach port 8080 can authenticate with the published/default value.

Remediation: fail fast during startup when the token is absent or too weak, compare secrets in a timing-safe manner, and ensure deployment configuration prevents public exposure of this administrative endpoint. Add a test for startup/configuration failure and an authenticated/unauthenticated request test.

## 2. High — `name` is accepted without confinement to the customer-files root

`src/files.js:6` passes untrusted input directly to `path.join`. Traversal such as `../../etc/passwd` normalizes to `/etc/passwd`; the live service returned that path with HTTP 200. The current handler returns the path string rather than reading it, so this is presently an information disclosure and broken file-serving contract, but it becomes arbitrary file read as soon as the handler is wired to filesystem I/O.

Remediation: validate the name as a relative file identifier, reject absolute paths and traversal segments, resolve it against the root, and verify the resolved path remains beneath the root (including symlink policy) before opening it. Return a controlled 4xx for invalid names and test traversal, encoded traversal, absolute paths, and symlinks.

## 3. High — malformed requests terminate the process

When `name` is absent, `URLSearchParams.get` returns `null`; `path.join(DATA_ROOT, null)` throws synchronously in the request callback (`src/server.js:11`, `src/files.js:6`). The live service produced an empty reply and exited with `ERR_INVALID_ARG_TYPE`. A single authenticated malformed request can therefore cause denial of service until a supervisor restarts the process.

Remediation: validate required parameters before calling the file layer, return 400/404 deliberately, and add top-level request error handling plus a process supervisor/health-check policy. Test missing, repeated, oversized, and malformed query values.

## 4. High — the migration is destructive and violates rolling-deploy/data-retention expectations

`migrations/003_remove_audit.sql` unconditionally executes `DROP TABLE audit_events`. There is no evidence of an additive transition, backup/retention strategy, dependency check, or rollback path. Existing audit records are irreversibly removed, and an older/newer application deployed during migration may fail if it still reads or writes the table.

Remediation: establish whether audit data may be deleted, retain/archive it if required, and use an additive expand/migrate/contract sequence compatible with mixed application versions. Make migration execution transactional where supported and verify it against a representative schema and rollback/restore procedure.

## 5. Medium — automated verification provides no protection for critical behavior

`tests/smoke.js` only prints `all tests passed`; it does not import the application, start the server, send requests, assert responses, test filesystem behavior, or exercise the migration. `package.json` has no build, lint, coverage, or integration-test command, so `npm test` passes regardless of regressions in authentication, input handling, crashes, or data changes.

Remediation: add focused tests for authorization, configuration failure, valid file access, traversal rejection, missing input, and unexpected I/O errors; add migration checks against a test database. Provide a repeatable build/check command and run the product, tests, and build in CI. There is currently no build script to verify.

## Verification and remaining uncertainty

Reviewed all application, test, migration, package, and README files present in the workspace. Ran `npm test` successfully, started the service, verified unauthenticated rejection, verified the default token behavior, verified traversal normalization, and reproduced the missing-parameter process crash. No application files were changed; this assessment is the only added file. Database engine, deployment topology, intended file-serving semantics, and whether audit deletion is approved are not specified, so those assumptions should be resolved before implementation.
