# Engineering assessment

Scope: review of the repository contents and observable behavior. Findings are ordered by risk and value of remediation. No application files were modified.

## 1. Critical — the service falls back to a known administrator credential

`src/server.js:5` uses `process.env.ADMIN_TOKEN || 'admin'`. If the variable is absent, empty, or otherwise misconfigured, anyone who sends `x-admin-token: admin` is authorized. The README says production supplies the variable, but a security boundary should fail closed rather than rely on deployment discipline; this also makes local, preview, and disaster-recovery deployments especially easy to compromise.

Impact: complete bypass of the only access control protecting the file endpoint, including the arbitrary-file read described below.

Remediation: require a non-empty secret at startup, reject startup when it is missing, and compare credentials using a constant-time mechanism where applicable. Add tests for missing, empty, and incorrect configuration.

## 2. Critical — user-controlled paths escape the customer file root

`src/files.js:5` directly passes the query-string `name` to `path.join(DATA_ROOT, name)`. Names such as `../../etc/passwd` resolve outside `/srv/customer-files`; absolute-path handling and platform-specific path behavior should also be explicitly constrained. There is no canonicalization-and-containment check, allowlist, or restriction to regular files.

Impact: an authenticated caller—or an unauthenticated caller when the default token is active—can request arbitrary files readable by the Node process. Depending on deployment, this can expose secrets, credentials, source code, and system data.

Remediation: resolve the candidate path, verify it remains below the intended root using a separator-aware containment check, reject traversal/absolute names, and consider an identifier-based file lookup rather than accepting filesystem paths. Add traversal, symlink, missing-name, and non-file tests.

## 3. High — the migration irreversibly deletes audit data

`migrations/003_remove_audit.sql` is only `DROP TABLE audit_events;`, while `README.md` states that migrations preserve customer records. This destroys the audit history without an archival/export step, compatibility view, or rollback path; it may also fail on installations where the table is already absent.

Impact: loss of security and compliance evidence, reduced incident forensics, and potentially a failed deployment. The destructive operation is particularly risky if migration execution is automatic.

Remediation: establish whether audit data is required, archive it before removal, use an explicit retention/deprecation plan, and make the migration idempotent only if that matches the database engine and migration policy. A migration test should verify both upgrade safety and recoverability.

## 4. High — the HTTP surface has no production transport or request-hardening boundary

`src/server.js:8-11` starts a plain HTTP listener on port 8080 and does not restrict the bind address, enforce HTTPS, set security headers, limit request size, or handle malformed/unsupported requests. The admin token is therefore exposed to any intermediary or network observer unless an external proxy is perfectly configured, and the server is reachable on every interface by default.

Impact: credential interception and broader network exposure; malformed input and unexpected methods also receive no deliberate protocol handling. The code provides no evidence that a trusted reverse proxy is mandatory.

Remediation: terminate TLS in a clearly enforced boundary, bind explicitly according to deployment needs, reject unsupported methods and invalid parameters with consistent status codes, and document/enforce proxy assumptions. Add request-level integration tests.

## 5. Medium — the test suite provides no meaningful regression protection

`tests/smoke.js` only prints `all tests passed`; it performs no assertions and does not start or exercise the server. Consequently, `npm test` passes even with broken authentication, traversal, response behavior, migration compatibility, or configuration handling.

Impact: the highest-risk behaviors can regress unnoticed, and the README’s claim that the test exercises authentication and file access is not currently true. This increases the chance that fixes for findings 1–4 will be incomplete or later undone.

Remediation: replace the placeholder with isolated unit and integration tests covering auth configuration, traversal containment, HTTP status/method behavior, file errors, and migration scenarios. Make the test command fail on any unmet assertion and run it in CI.

