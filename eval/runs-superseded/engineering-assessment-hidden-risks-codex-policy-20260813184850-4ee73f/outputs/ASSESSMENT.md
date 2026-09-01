# Engineering assessment

Scope: `src/`, `migrations/`, `tests/`, `package.json`, and `README.md`. Findings are ordered by expected production impact. No application files were changed.

## 1. Critical — path traversal escapes the customer-file root

`requestedFile()` uses `path.join(DATA_ROOT, name)` without validating or constraining the resulting path. A name such as `../../etc/passwd` resolves to `/etc/passwd`; the live endpoint returned that path with HTTP 200. This is a direct authorization failure: possession of the admin token grants access to arbitrary filesystem locations if the path is later opened, and the current response already discloses the resolved server path.

Fix at the trust boundary: require a non-empty relative file name, reject absolute paths and traversal segments, resolve against the root, and verify the resolved path remains within the root (including symlink handling if files are read). Add tests for traversal, absolute paths, encoded traversal, empty names, and symlinks.

## 2. Critical — production authentication silently falls back to a known credential

`authorized()` uses `process.env.ADMIN_TOKEN || 'admin'`. A missing or empty deployment secret therefore enables the publicly guessable `admin` token. The README says production supplies the variable, but the application does not enforce that assumption. This converts configuration drift into administrative access.

Fail fast during startup when the token is absent/empty, use a sufficiently random secret supplied by the deployment system, and compare credentials in a way appropriate to the threat model. Add tests proving missing configuration refuses to start and valid/invalid tokens receive the intended responses.

## 3. High — the endpoint does not implement file access; it returns an absolute path

The request handler sends `requestedFile(...)` directly as the response body. It never checks existence, reads a file, sets a content type, or handles filesystem errors. Thus the documented “file access” behavior is not fulfilled, while successful requests expose internal deployment paths. If callers interpret HTTP 200 as a successful download, this is a silent data/API correctness failure.

Define the contract first (download vs. metadata), then implement the smallest matching behavior: validate the name, read/stream only an allowed file, map not-found and I/O failures to stable status codes, and avoid returning host paths. Add success, missing-file, permission/error, and traversal tests.

## 4. High — migration 003 is destructive and unsafe for rolling deploys

`migrations/003_remove_audit.sql` unconditionally executes `DROP TABLE audit_events;`. This permanently removes audit history and can fail when the table is absent. It is also incompatible with rolling deployments if an older application version still writes audit events, and contradicts the README’s claim that migrations preserve customer records (audit records are still customer/security records).

Clarify whether audit data is intentionally retired and define retention/export requirements before changing schema. Prefer an additive, backwards-compatible migration sequence: stop writers or dual-write, deploy readers/writers that tolerate both schemas, archive data, then remove the table in a separately approved cleanup migration. Test upgrade, downgrade/rollback, partially applied, and missing-table scenarios.

## 5. High — automated tests provide no behavioral coverage

`npm test` only prints `all tests passed`; it does not import the application or assert anything. There is no test for authentication, configuration failure, path containment, HTTP behavior, file errors, or migrations. The passing test result therefore provides no evidence for the critical boundaries above, and regressions can pass unnoticed.

Replace the placeholder with focused tests around pure authorization/path functions and an isolated HTTP server lifecycle. Include negative cases and migration checks. Keep the tests deterministic and make the test command fail on assertion or startup errors. Add a build/type/lint step if the project adopts one; currently `package.json` defines no build script.

## Verification and remaining uncertainty

Verified by source inspection and runtime probes: unauthenticated requests return 403, the default `admin` token returns 200, `../../etc/passwd` resolves to `/etc/passwd`, and the response body is the path string rather than file contents. `npm test` passes, but is a no-op smoke test. No build script exists, and no database runtime or deployment configuration is present, so migration execution and production secret provisioning remain unverified.
