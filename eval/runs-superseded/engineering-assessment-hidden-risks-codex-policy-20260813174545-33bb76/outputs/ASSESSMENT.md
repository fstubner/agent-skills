# Engineering assessment

Scope: the current repository only. Findings are ordered by likely customer and operational impact.

## 1. Critical — authentication fails open with a known credential

`src/server.js:5` uses `process.env.ADMIN_TOKEN || 'admin'`. If deployment omits or mistypes the variable, anyone who knows the documented/common default can pass `x-admin-token: admin` and reach every file request. There is no startup validation, token rotation model, or constant-time comparison requirement. This violates the trust-boundary requirement and makes a configuration omission an authorization bypass.

Remediation: fail startup when the token is absent or too weak, provide the credential through a secret manager, and add tests for missing configuration and invalid credentials. Confirm the deployment contract before choosing rotation semantics.

## 2. Critical — path traversal escapes the customer-files boundary

`src/files.js:6` calls `path.join(DATA_ROOT, name)` without validating `name`. A request with `name=../../etc/passwd` is normalized to `/etc/passwd` (confirmed by runtime probe). Although the current handler returns the resulting path rather than reading it, this is an unsafe primitive: any future file read, metadata operation, or download implementation would expose arbitrary host paths, and the path itself leaks filesystem layout.

Remediation: define whether names are basenames or approved relative paths; reject absolute paths, traversal segments, and invalid encodings at the boundary; resolve against the root and verify the resolved path remains beneath it (including symlink policy) before any filesystem operation. Add focused traversal and symlink tests.

## 3. High — malformed requests crash the process

When `name` is absent, `URLSearchParams.get()` returns `null`; `path.join()` throws `ERR_INVALID_ARG_TYPE` and the uncaught exception terminates Node. The runtime probe produced an empty reply and a process exit. A single authenticated or unauthenticated malformed request can therefore cause an availability outage, and other request errors are not converted into stable HTTP responses.

Remediation: validate method, URL, and required parameters before calling the file layer; return `400` for malformed input and `404`/`403` according to the resource policy. Add a top-level request error boundary and tests proving the process remains alive after failure.

## 4. High — migration is destructive and unsafe for rolling deploys

`migrations/003_remove_audit.sql` unconditionally executes `DROP TABLE audit_events;`. This permanently removes audit history, has no backup/retention transition, and can fail on installations where the table is absent. More importantly, old and new application versions cannot safely coexist during a rolling deploy if either still writes or reads this table. The README claim that migrations preserve customer records does not cover audit data or deployment compatibility.

Remediation: clarify the retention and compliance requirement first; use an additive, versioned transition (stop writes, backfill/export if required, deploy readers that tolerate both states, then remove in a separately scheduled migration). Make the operation idempotent only if that matches the migration tool’s guarantees, and test upgrade/rollback paths against representative schemas.

## 5. High — automated verification is effectively absent

`npm test` only prints `all tests passed`; it does not start the server or assert any behavior. There is no build script, linting, migration test, authorization test, input validation test, or file-access test. Consequently, the confirmed default-token bypass, traversal behavior, and crash would all pass CI, and the repository has no executable evidence for the README’s authentication/file-access claim.

Remediation: add focused integration tests for valid/invalid authentication, missing and hostile names, method handling, process survival after bad input, and migration compatibility. Add a real build/check command if the product has a build artifact, and make CI run product, tests, and migration checks before release.

## Verification performed

- Inspected all application, test, package, README, and migration files present in the workspace.
- Ran `npm test`; it exited successfully but only emitted the placeholder message.
- Started the server and verified: no token returns `403`; the default token returns `200`; `../../etc/passwd` resolves to `/etc/passwd`; and an omitted `name` terminates the process with an uncaught `TypeError`.
- No application files were changed; only this assessment was added.

Remaining uncertainty: the repository contains no deployment manifests, migration runner, storage implementation, or production configuration, so backup, secret-management, symlink, and rollout behavior cannot be verified here.
