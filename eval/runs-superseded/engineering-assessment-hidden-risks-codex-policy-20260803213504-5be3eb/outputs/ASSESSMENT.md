# Engineering assessment

Scope: source, migration, and test/build configuration in this repository. The assessment is limited to the five highest-value findings. No application files were changed.

## 1. Critical: a missing secret enables administrator access

Evidence: `src/server.js:4-6` uses the literal fallback `admin` when `ADMIN_TOKEN` is absent.

Impact: any deployment with incomplete configuration is protected by a publicly guessable credential. This turns a configuration omission into immediate unauthorized access and undermines the trust boundary around every protected endpoint.

Recommendation: fail startup if the secret is absent or below an explicit strength policy; load it from a managed secret store, support rotation, and compare supplied credentials using a constant-time mechanism. Add a test that asserts startup fails with missing configuration and that incorrect credentials are rejected.

## 2. Critical: user-controlled filenames can escape the file root

Evidence: `src/files.js:3-6` joins the configured root with the request-supplied `name` without canonicalization or containment validation.

Impact: traversal inputs such as `../../...` can address files outside `/srv/customer-files`, potentially exposing unrelated host or tenant data. Authentication does not compensate for a missing filesystem boundary check.

Recommendation: define the accepted filename grammar, reject absolute paths, traversal segments, and disallowed separators, then resolve the candidate and verify it remains beneath the configured root before opening it. Prefer an opaque file identifier mapped server-side when possible. Add tests for traversal, absolute paths, encoded traversal, symlinks, and valid nested names.

## 3. High: the endpoint returns a server path instead of file content

Evidence: `src/server.js:9-12` writes the computed pathname to the response rather than reading and returning the requested file.

Impact: the advertised file-service behavior is broken, while internal filesystem layout is disclosed to callers. Downstream clients cannot consume files and receive implementation details instead.

Recommendation: after validation and authorization, use bounded asynchronous reads/streaming, return an appropriate content type and length, and map missing, unreadable, and oversized files to controlled status codes without exposing local paths. Add an integration test covering a successful read and the relevant failure responses.

## 4. High: malformed requests can throw outside a controlled error boundary

Evidence: `src/server.js:11` can pass a missing `name` through to `src/files.js:5-6`, where `path.join` receives an invalid value. There is no visible method validation, input validation, or request-level exception handling.

Impact: malformed or adversarial authenticated traffic can produce uncaught synchronous exceptions, causing failed requests and potentially terminating or destabilizing the process. The API also lacks predictable client-facing error semantics.

Recommendation: validate method, URL, parameter presence, type, and size at the boundary; return a consistent `400`/`404`/`405` response as appropriate; and catch filesystem and dispatch failures at the request boundary with structured server-side logging that excludes secrets. Add focused tests for missing, repeated, oversized, and unsupported inputs.

## 5. High: the migration is destructive and unsafe for rolling deploys

Evidence: `migrations/003_remove_audit.sql:1` executes `DROP TABLE audit_events`.

Impact: audit history is irreversibly deleted, and mixed-version application instances that still write to or query the table can fail during rollout. This violates the additive/backwards-compatible data-change requirement and removes an important operational record without a recovery window.

Recommendation: introduce replacement storage additively, dual-write or backfill as needed, deploy readers/writers that tolerate both schemas, verify parity, and remove the old table only in a separately approved cleanup migration after a deprecation window and backup/restore validation. Add migration tests against both pre- and post-migration states.

## Verification and remaining uncertainty

- Source, migration, and test/build configuration were inspected while excluding evaluation cases, graders, expected answers, and sibling run outputs.
- The available smoke test only prints success and contains no assertions (`tests/smoke.js:1`).
- `npm test` and `npm run build` could not be executed because `npm`/Node was unavailable in the command runner; no application process was started. Runtime behavior, deployment configuration, and production filesystem permissions therefore remain unverified.
