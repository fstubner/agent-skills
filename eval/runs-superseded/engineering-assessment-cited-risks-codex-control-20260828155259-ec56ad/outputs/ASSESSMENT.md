# Engineering assessment

Scope: `src/`, `tests/`, `migrations/`, `package.json`, and `README.md`. Findings are ordered by likely security and operational impact. No application code was changed.

## 1. Critical: user-controlled path traversal escapes the customer-files root

**Evidence:** `src/server.js:11` passes the query-string `name` directly to `requestedFile`; `src/files.js:5-6` uses `path.join(DATA_ROOT, name)` without validating the resolved path. A name such as `../../etc/passwd` resolves to `/etc/passwd` (confirmed at runtime).

**Impact:** Any caller who obtains the admin token can request paths outside `/srv/customer-files`, potentially exposing host files or other mounted secrets. The current handler returns the resulting path rather than reading it, but this is still an unsafe boundary and becomes a direct file-disclosure vulnerability if the endpoint is corrected to serve contents.

**Recommendation:** Resolve against the root and enforce containment after resolution (including a separator-aware prefix check), reject absolute/traversal names, and preferably accept only an application-level file identifier mapped to a stored filename. Add tests for `../`, encoded traversal, symlinks, and boundary names.

## 2. Critical: authentication silently falls back to a known admin credential

**Evidence:** `src/server.js:5` uses `process.env.ADMIN_TOKEN || 'admin'`.

**Impact:** If deployment configuration is absent, empty, or miswired, the service is protected by a publicly guessable token. The README says production supplies the variable, but the application does not enforce that precondition or fail closed. A compromise of any reachable instance then grants the privileged file endpoint.

**Recommendation:** Require a non-empty secret at startup; fail fast if it is missing or weak according to deployment policy. Use a constant-time comparison for secret material, rotate it through the deployment secret manager, and add tests covering missing and empty configuration.

## 3. High: the endpoint does not perform file access and returns a filesystem path

**Evidence:** `src/server.js:11` calls `res.end(requestedFile(...))`; there is no `readFile`, stream, status handling, or content-type handling anywhere in the repository.

**Impact:** The service advertised by the README (“file service” and “file access”) does not return file contents or a meaningful not-found response; it returns internal host paths to authorized clients. This is a functional defect and leaks deployment layout. It also makes the path traversal issue harder to notice in current tests while preserving the dangerous path-construction boundary.

**Recommendation:** Define the API contract (download versus metadata), then implement streaming from a validated path with explicit `404`, `403`, and `500` behavior, bounded resource usage, and safe content-disposition/content-type handling. Avoid returning absolute server paths.

## 4. High: malformed requests can terminate the process

**Evidence:** `URLSearchParams.get('name')` returns `null` when `name` is absent (`src/server.js:11`), and `path.join` throws on `null` (`src/files.js:6`). The request callback has no try/catch or error boundary. Runtime verification reproduced `TypeError: The "path" argument must be of type string` for null input.

**Impact:** A request such as `/` or `/download` can crash the Node process, causing denial of service unless an external supervisor restarts it; restart loops can amplify the outage. Other synchronous errors in the callback have the same failure mode.

**Recommendation:** Validate method, route, and required query parameters before processing; return a client error for invalid input. Add a request-level error boundary and process-level operational supervision, while avoiding continuing in an unknown state after truly fatal errors.

## 5. High: migration permanently drops audit history without a safe rollout

**Evidence:** `migrations/003_remove_audit.sql` is only `DROP TABLE audit_events;`, with no existence guard, replacement schema, archival step, or documented migration precondition.

**Impact:** Applying it irreversibly destroys audit records, contradicting the README’s claim that migrations preserve customer records (even if audit rows are not customer records). On a fresh or partially migrated database it can also fail because the table may not exist, leaving the migration sequence inconsistent. Loss of auditability weakens incident investigation and compliance controls.

**Recommendation:** Treat audit retention as an explicit product/data decision; archive or migrate records before removal, document retention and rollback limits, and gate destructive changes with a reviewed operational procedure and backup verification. Make migration behavior deterministic for supported database states and test it against both existing and fresh schemas.

## Verification notes

`npm test` completed successfully, but it only prints `all tests passed` and contains no assertions. `node --check` passed for both source modules. Direct runtime probes reproduced path escape and the missing-parameter exception. The workspace is not a Git working tree, so Git-based change-status verification was unavailable.
