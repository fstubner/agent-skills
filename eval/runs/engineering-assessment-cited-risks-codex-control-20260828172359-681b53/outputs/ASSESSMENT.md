# Engineering assessment

The assessment is limited to the five highest-value findings identified from the
repository as it exists today. Severity reflects likely production impact.

## 1. Critical — authenticated requests can escape the customer-file root

`src/files.js:5-6` passes attacker-controlled `name` directly to
`path.join('/srv/customer-files', name)`. A value containing parent traversal,
such as `../../etc/passwd`, produces a path outside the intended root. The
server also accepts this value directly from the URL at `src/server.js:11`.

If the endpoint is intended to read or serve files, this is an authenticated
path-traversal vulnerability: any party holding the shared admin credential may
target arbitrary readable paths. The current implementation returns the
constructed path string rather than reading it, so the immediate result is a
broken file-access contract; the path construction remains unsafe and will
become exploitable as soon as file I/O is added.

Fix by validating a decoded relative filename, resolving it against the root,
and rejecting any resolved path that is not beneath the root (including symlink
escape if the service follows symlinks). Add traversal and symlink tests.

## 2. Critical — the authentication credential defaults to `admin`

`src/server.js:5-6` authorizes every request carrying `x-admin-token: admin`
whenever `ADMIN_TOKEN` is unset or empty. This is a predictable, effectively
public credential, and the server has no startup validation to prevent that
configuration from reaching production.

An attacker who can reach port 8080 can therefore access the entire protected
surface. The README’s statement that production supplies the variable is not an
enforced control. Require a non-empty, sufficiently strong secret at startup;
fail closed when it is absent, and avoid logging or exposing it.

## 3. High — the endpoint does not perform file access

At `src/server.js:11`, the response body is the return value of
`requestedFile(...)`; `src/files.js:5-6` only constructs a string and never
opens, checks, or streams a file. A successful request therefore returns a
filesystem path such as `/srv/customer-files/report.pdf`, not the file’s
contents or a meaningful not-found response.

This is a functional/security boundary failure: clients cannot retrieve files,
and the response discloses the server’s filesystem layout to anyone who knows
the token. Implement explicit file authorization and streaming (or clearly
change the API contract), with safe not-found/error handling and content-type
and caching policy. Tests should cover success, missing files, and permission
errors.

## 4. High — malformed authorized input can terminate the request process

`URLSearchParams.get('name')` returns `null` when `name` is missing, while
`path.join` requires string path segments. Consequently an authorized request
without `name` reaches `src/files.js:6` and throws a `TypeError`; the request
handler has no `try/catch` or error response (`src/server.js:9-12`). In Node,
an uncaught exception can bring down the server, making this a low-effort
availability attack for anyone who obtains the token (and a reliability issue
for ordinary client mistakes).

Validate method, URL, and required parameters before path construction and
return a controlled 4xx response. Add tests for missing, empty, malformed, and
repeated `name` parameters.

## 5. High — the migration irreversibly drops audit history without safeguards

`migrations/003_remove_audit.sql` executes `DROP TABLE audit_events;` with no
`IF EXISTS`, transaction wrapper, backup/archive step, or evidence that the
table is obsolete. This permanently removes audit data and causes migration
failure on installations where the table is already absent or has a different
state. That conflicts with the README’s claim that migrations preserve
customer records and leaves no rollback path in the repository.

Before applying this migration, establish whether audit history is required for
security/compliance, archive it if removal is approved, and make the migration
idempotent and deployment-safe. Add migration tests against representative
existing schemas and document the irreversible operation and recovery plan.

## Verification notes

`npm test` completed successfully, but it only prints `all tests passed` and
does not exercise the server, authentication, path handling, file access, or
migrations. The findings above were verified by direct source inspection and
runtime semantics of the Node.js APIs used.
