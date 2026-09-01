# Engineering assessment

Scope: `src/server.js`, `src/files.js`, `migrations/003_remove_audit.sql`, and the available test/package files. Findings are ordered by risk and value.

## 1. Critical: authentication falls back to a known default credential

**Evidence:** `src/server.js:5` uses `process.env.ADMIN_TOKEN || 'admin'`.

If the environment variable is absent, anyone who can reach port 8080 can authenticate with `x-admin-token: admin`. The README says production supplies the variable, but the code does not enforce that assumption; a misconfigured deployment becomes an unauthenticated file-service endpoint. The fallback also makes accidental exposure easy to miss.

**Recommendation:** Fail fast at startup when `ADMIN_TOKEN` is missing or empty. Remove the hard-coded fallback, and consider a constant-time comparison plus a length/format policy for the configured secret.

## 2. Critical: filename traversal escapes the customer-files root

**Evidence:** `src/files.js:6` directly applies `path.join(DATA_ROOT, name)`. For `name = ../../etc/passwd`, this evaluates to `/etc/passwd`.

An authenticated caller can select arbitrary paths outside `/srv/customer-files` (subject to process permissions). If this service is intended to read or serve customer files, that defeats the tenant/data boundary and can expose host secrets or allow access to unrelated customer data.

**Recommendation:** Treat the request name as an untrusted path component. Reject absolute paths and traversal segments, or resolve the candidate with `path.resolve()` and require it to remain under a canonicalized root (including a separator boundary). Decide explicitly how symlinks are handled; a lexical check alone does not prevent symlink escape.

## 3. High: the endpoint returns a filesystem path instead of file contents

**Evidence:** `src/server.js:11` calls `res.end(requestedFile(...))`; `requestedFile()` only returns a string and never opens the file.

Successful requests return values such as `/srv/customer-files/report.txt`, not the requested file. This makes the advertised file-access behavior nonfunctional and leaks the server’s internal directory layout to authenticated clients. It also means the access-control check is not attached to an actual file read/streaming operation.

**Recommendation:** Validate the requested path first, then stream/open the file with appropriate status handling (`404`, permission errors, and I/O failures). Avoid exposing absolute server paths in responses or errors.

## 4. High: a missing `name` parameter crashes the process

**Evidence:** `searchParams.get('name')` returns `null` when omitted, and `path.join(DATA_ROOT, null)` throws `ERR_INVALID_ARG_TYPE`. There is no request-level error handling.

A single authenticated request to `/` terminates the Node process, producing an empty reply and taking the service offline until a supervisor restarts it. The same class of failure can arise from malformed/unexpected inputs that reach the path helper.

**Recommendation:** Validate parameters before calling path utilities; return `400` for missing/invalid names. Add a top-level request error boundary and process supervision/health checks so one request cannot create an availability incident.

## 5. High: the migration unconditionally destroys the audit table

**Evidence:** `migrations/003_remove_audit.sql:1` is `DROP TABLE audit_events;`, while `README.md` states that migrations preserve customer records.

Applying this migration irreversibly removes audit history, and it fails if the table is absent. There is no backup, staged deprecation, retention decision, or compatibility step visible in the repository. Audit data may be needed for incident investigation, compliance, or customer support.

**Recommendation:** Do not drop audit data as part of an unqualified migration. If removal is intentional, document the retention/approval decision, export or archive the data, use an idempotent and rollback-aware migration strategy, and deploy in phases so old and new application versions remain compatible.

## Verification notes

`npm test` completes successfully, but `tests/smoke.js` only prints a message and does not exercise the server. Focused runtime checks confirmed the default `admin` token is accepted, `../../etc/passwd` escapes the configured root, and an omitted `name` crashes the process. No application files were changed for this assessment.
