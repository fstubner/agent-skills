# Release Review — Report a Fault

**Verdict: NOT READY FOR RELEASE**

The application has critical gaps that prevent it from functioning as specified. Core features are incomplete, and there is at least one security vulnerability in authentication.

## Critical Issues

### 1. Frontend is Incomplete (Blocks All Functionality)
- `public/app.js` calls `propertyPicker()`, `urgencyPicker()`, and `summary()` functions that are not defined anywhere. The application will throw `ReferenceError` at runtime when render() executes (line 9, 13, 15).
- No event handlers exist. The `next()` and `send()` functions are defined but never attached to DOM elements, so users cannot navigate the report flow.
- No sign-in form. The render() function handles steps 1-3 of the fault report, but the UX walkthrough specifies step 1 should be the sign-in form. Users cannot authenticate.
- No sign-out functionality in the frontend; the sign-out button is never rendered.
- No fault listing. The `/api/faults` endpoint is never called. Users cannot view their reported faults.
- The `draft` object's `property` and `room` fields remain `null`—there is no code to set them.

**Impact:** The application cannot start or perform any of its core functions.

### 2. Authentication Bypass (Security Vulnerability)
`src/server.js` line 20: `req.session.tenantId = req.body.tenantId;` accepts any value from the request body without validation. A user can sign in as any other tenant's ID and:
- View all faults belonging to another tenant via `/api/faults`.
- Report new faults under another tenant's name.

**Impact:** Complete loss of tenant isolation and data privacy.

## High-Priority Issues

### 3. Hardcoded Timestamps
`src/faults.js` line 17 hardcodes `reportedAt: '2026-08-31T00:00:00Z'`. Every fault receives the same timestamp regardless of when it is actually reported, making fault ordering and audit trails incorrect.

### 4. Invalid Property and Room Values Accepted
`src/validate.js` checks only that `property` and `room` are present (truthy), not that they are valid. There is no whitelist of properties or rooms. Any string is accepted, including empty strings (after trimming) and nonsense values.

**Impact:** Faults cannot be reliably routed to trades because invalid locations are stored.

### 5. Weak Default Session Secret
`src/server.js` line 11 defaults to `secret: 'change-me'` if `SESSION_SECRET` environment variable is not set. This weak secret compromises session security in development and any deployment that omits the environment variable.

## Medium-Priority Issues

### 6. No Description Length Validation
`src/validate.js` checks that `description` is a string but has no length bounds. Very long descriptions (e.g., a 1MB string) can be stored, consuming unbounded disk space. XSS in the HTML rendering of descriptions is not a concern here because descriptions are not echoed to the page for display, but this is fragile.

### 7. Potential Race Condition in Data Writes
`src/faults.js` does not synchronize read and write operations. If two requests race to report a fault, the second may overwrite the first (lose data). Node.js single-threaded behavior mitigates this in practice, but if the code is ever refactored to handle concurrency differently, this becomes a real bug.

## Architecture Observations

- The validation-at-the-boundary principle is applied inconsistently: `/api/sign-in` has no validation, while `/api/faults` validates. Tenancy is enforced at the endpoint level (requireTenant middleware) but not at the data-access level, so a compromised session layer defeats isolation.
- The fault record generation hardcodes ID as `f{count+1}`, which is fragile if data is ever deleted or migrated.
- Faults are stored in a JSON file with no transaction or recovery mechanism. Process crashes during writes can corrupt the file.

## Missing Coverage

- No tests for the `/api/sign-in`, `/api/faults` list, or `/api/sign-out` endpoints.
- No tests for tenancy isolation.
- No integration tests of the full report flow.
- No frontend tests (e.g., that propertyPicker renders correctly, or that errors are displayed).

## Recommendation

**Do not release.** The application is incomplete and non-functional. Before re-review:

1. **Implement the missing frontend** (propertyPicker, urgencyPicker, summary functions; event handlers; sign-in and sign-out flows; fault listing).
2. **Add tenantId validation** to `/api/sign-in` to accept only valid tenancy reference formats, and validate in the datastore layer.
3. **Fix timestamps** to use `new Date().toISOString()` or equivalent.
4. **Add property and room whitelists** and validate against them.
5. **Require SESSION_SECRET** in production (fail at startup if not set).
6. **Add length limits** to description (e.g., max 5000 characters).
7. **Add tests** for the sign-in endpoint, tenancy isolation, and the full report flow.
8. **Run and test the application** end-to-end via a browser to confirm the happy path and error cases work.

Housing cannot safely deploy this to tenants until these issues are resolved.
