# Engineering Assessment

## 1. Authentication falls back to a known production credential

**Severity: Critical** — `src/server.js:5`

When `ADMIN_TOKEN` is unset or empty, every request is authorized with the literal token `admin`. The README says production supplies the variable, but the application does not enforce that invariant, so a deployment/configuration mistake exposes the entire service. Authorization is also applied as a single shared bearer secret with no rotation, expiry, or per-user accountability. Fail closed at startup when the secret is missing, and provide a deliberate secret-management/rotation mechanism.

## 2. The endpoint does not implement file access and returns server filesystem paths

**Severity: High** — `src/server.js:11`, `src/files.js:5-6`

The request handler passes the requested name to `requestedFile()` and sends the resulting pathname as the response body; it never opens, streams, or checks a file. Thus valid clients receive internal paths such as `/srv/customer-files/report.txt`, not file contents, and the service’s stated purpose is not met. Returning pathnames also leaks deployment layout. Implement an explicit file-read/stream path with existence, type, and authorization checks, and return controlled HTTP errors rather than internal paths.

## 3. Filename input can escape `DATA_ROOT`

**Severity: High** — `src/files.js:5-6`

`path.join('/srv/customer-files', '../../etc/passwd')` evaluates to `/etc/passwd`; there is no normalization-and-containment check or restriction on absolute/relative segments. Although the current handler does not read the result, this is an unsafe path-resolution primitive and would become an arbitrary-file read if file serving is added around it (and already discloses paths). Treat the input as a basename or resolve it and verify it remains beneath the root, ideally using an allowlisted identifier rather than a user-supplied path.

## 4. Missing/invalid input can terminate the server process

**Severity: High** — `src/server.js:11`, `src/files.js:5-6`

`searchParams.get('name')` returns `null` when `name` is omitted, and `path.join()` throws `TypeError` for that value. The request callback has no exception handling, so a malformed authorized request can take down the Node process (and there is no validation for empty or otherwise invalid names). Validate all request inputs before path construction and install request-level error handling plus process supervision/health checks.

## 5. The migration irreversibly drops a table without a safety contract

**Severity: High** — `migrations/003_remove_audit.sql:1`

`DROP TABLE audit_events;` permanently removes audit history and fails if the table is absent. This conflicts with the README’s claim that migrations preserve customer records and removes the primary operational trail for investigating access to customer files. If audit removal is intentional, use an explicitly reviewed, versioned data-retention plan with backups and a documented compatibility transition; otherwise preserve/archive the data. At minimum, migration execution should be tested against representative schemas and its destructive nature should be made an explicit deployment gate.

