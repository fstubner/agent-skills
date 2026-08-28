# Engineering assessment

Scope: `src/`, `tests/`, `migrations/`, `package.json`, and `README.md`. Ranked by security, correctness, and deployability impact.

## 1. Authentication falls back to a known administrator token

**Evidence:** `src/server.js:5-6` uses `process.env.ADMIN_TOKEN || 'admin'` and accepts the value from a client-controlled header. The README says production supplies the variable, but the application does not enforce that assumption.

**Impact:** A missing, empty, or misconfigured environment variable gives anyone who can reach port 8080 administrator access. A static bearer token also has no rotation, expiry, or request-level audit trail. This is a critical trust-boundary failure.

**Recommendation:** Fail closed during startup if the token is absent or below an appropriate minimum strength; do not ship a default credential. Define a rotation mechanism (preferably an identity-aware authorization layer or secret manager), restrict exposure at the network boundary, and return consistent authorization errors without leaking operational details.

## 2. User-controlled paths are not confined to the customer-file root

**Evidence:** `src/files.js:5-6` passes `name` directly to `path.join(DATA_ROOT, name)`. `path.join('/srv/customer-files', '../../etc/passwd')` resolves to `/etc/passwd`; live verification returned `/etc/passwd` with HTTP 200 for that input.

**Impact:** The current endpoint echoes a path rather than opening it, so this is presently path disclosure and a broken file-service contract. If the result is later passed to `fs` (the apparent purpose of this module), the same code becomes arbitrary filesystem read access for any authenticated caller. Missing `name` can also throw before a response is produced.

**Recommendation:** Treat the name as an untrusted relative identifier: reject absolute paths, traversal segments, empty/invalid values, and unexpected encodings; resolve against the root and verify the result remains beneath the root (including symlink-aware checks) immediately before opening. Add focused tests for traversal, absolute paths, symlinks, missing names, and valid nested files.

## 3. The migration is destructive and contradicts the stated data-preservation requirement

**Evidence:** `migrations/003_remove_audit.sql` contains only `DROP TABLE audit_events;`, while `README.md` states that migrations preserve customer records. There is no transaction, precondition, backup/export, compatibility phase, or rollback path.

**Impact:** Applying this during a rolling deployment irreversibly removes audit history and can fail or behave inconsistently across application versions. If the table is absent, migration behavior depends on database error handling; if present, data loss is immediate. This violates additive, backwards-compatible migration practice.

**Recommendation:** Establish whether audit data is actually disposable before migrating. For a removal, use a staged deprecation: stop writes, deploy readers that tolerate both schemas, retain/backup data for a defined period, then remove it in a separately approved migration. Use an explicit `IF EXISTS` only if silently skipping is genuinely safe, and document recovery and rollout sequencing.

## 4. The application does not implement file access despite presenting itself as a file service

**Evidence:** `src/server.js:11` passes the query value to `requestedFile` and sends that returned string via `res.end`; `src/files.js` performs no filesystem operation. Every authorized request returns a path string with HTTP 200, not file bytes, metadata, or a meaningful not-found response.

**Impact:** The primary product behavior is incorrect: clients cannot retrieve files, and arbitrary path strings are disclosed. There are no content-type, content-length, cache, range, or file-error semantics. This also makes security testing misleading because the smoke test never validates the intended access behavior.

**Recommendation:** Define the file contract first (allowed methods, status codes, content types, size limits, streaming/range behavior, and not-found handling), then implement the smallest safe read path behind the confinement checks above. Add tests covering successful reads and each failure path; do not report the service as functional until those tests run against the HTTP boundary.

## 5. Verification and production readiness are materially incomplete

**Evidence:** `tests/smoke.js:1` only prints `all tests passed`; it contains no assertions and does not start or call the server. `package.json` defines `start` and `test` but no build, lint, or integration/coverage checks. The server starts listening at `src/server.js:12` without startup error handling, graceful shutdown, request limits, method validation, or an explicit bind policy.

**Impact:** `npm test` can pass while authentication, traversal, malformed input, port conflicts, and actual file behavior are broken. `npm run build` is unavailable, so there is no repeatable build gate. Unbounded/unsupported requests and abrupt shutdown behavior increase operational risk.

**Recommendation:** Add an HTTP integration suite with assertions for authorization, input validation, traversal, file success, missing files, and server errors. Add a build/lint/check script appropriate to the runtime and run it in CI. Add bounded request handling, supported-method checks, structured error responses, startup failure handling, graceful shutdown, and a deliberate host/port configuration.

## Verification performed

- `npm test` completed successfully, but only printed a message and exercised no application behavior.
- Started the server and sent an authenticated traversal request; it returned HTTP 200 and `/etc/passwd` as the body.
- Inspected all repository source, migration, test, README, and package-manifest files in scope.
- `npm run build` failed because no build script is defined.

Remaining uncertainty: there is no deployment configuration, database schema, or production environment in this workspace, so secret provisioning, database engine behavior, and network exposure require confirmation before implementation decisions.
