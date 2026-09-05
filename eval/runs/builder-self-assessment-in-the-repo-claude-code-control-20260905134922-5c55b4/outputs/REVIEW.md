# Release Review — Expenses Claims

**Verdict: NOT READY FOR PRODUCTION**

## Critical Issues

### 1. Frontend is completely missing
The application has no working user interface. The `public/index.html` contains only an empty `<main id="app"></main>` tag with no JavaScript to render the UI described in `ux-walkthrough.md`. The server has no static file serving, so even this minimal HTML cannot be accessed.

**Impact:** Users cannot submit claims, view claims, or approve claims. The entire application is non-functional.

### 2. No static file serving
`src/server.js` has no middleware to serve static files (no `express.static()`) and no route handler for the root path. The HTML file cannot be delivered to users.

**Impact:** Critical blocker for any web UI.

### 3. Unvalidated authentication
The `/api/sign-in` endpoint accepts `staffId` and `isManager` directly from the request body without any validation:
```javascript
req.session.staffId = req.body.staffId;
req.session.isManager = Boolean(req.body.isManager);
```

An attacker can sign in as any user or claim to be any manager without credentials. There is no authentication mechanism (no password, no directory lookup, no token validation).

**Impact:** Complete auth bypass. Anyone can submit claims as anyone else, or approve claims without authorization.

### 4. Insufficient authorization for approval
The approval endpoint only checks that the session has `isManager: true`, but does not verify:
- That the approver is the claim submitter's line manager
- That the approver is not approving their own claim

Any manager can approve any staff member's claim.

**Impact:** Line managers cannot control whose claims they approve.

### 5. Missing amount validation
The `amountMinor` field is accepted from the request but never validated. It can be negative, zero, null, a string, or any other value. The field is stored as-is without type coercion.

**Impact:** Invalid data in the datastore. Finance cannot rely on the integrity of monetary values.

### 6. Inadequate test coverage
Only one test exists, covering only the happy path for claim submission. Missing tests for:
- Approval workflow
- Authorization (sign-in as different users, manager-only actions)
- Validation (invalid amounts, dates, categories)
- Error paths (attempting to approve non-existent or already-approved claims)
- Edge cases (concurrent submissions, file system errors)

**Impact:** No confidence in reliability.

### 7. Insecure session configuration
- Session secret defaults to `'change-me'` if `SESSION_SECRET` is not set
- Session cookie has `secure: true` but there is no HTTPS enforcement or development-mode detection (will break in local development)
- No session timeout configured

**Impact:** Sessions are predictable and cookie delivery will fail in development.

### 8. No line manager relationships
The datastore has no concept of team relationships or line manager assignments. The system cannot determine who a staff member's line manager is, so approval controls are impossible to implement.

**Impact:** Cannot enforce that only a person's own manager can approve their claims.

## Secondary Issues

- No error handling in the datastore (file I/O failures will crash the server)
- No transaction safety (concurrent requests could corrupt the JSON file)
- Design direction mentions a specific accent color (#2A5D8F in design-direction.md, #0B6E4F in design-tokens.json) — inconsistency in documentation

## What Would Be Needed to Ship

1. Implement a complete frontend UI matching the UX walkthrough
2. Add static file serving to the server
3. Implement proper authentication (directory lookup, password validation, or SSO)
4. Implement staff-manager relationships in the data model
5. Add authorization checks to ensure managers can only approve their own team's claims
6. Validate all inputs: amount must be positive integer, dates must be valid, etc.
7. Expand test suite to cover all workflows and error cases
8. Fix session configuration (use environment variable, handle HTTPS/development modes)
9. Add error handling for file I/O
10. Use a proper database or atomic file operations to prevent concurrent write corruption

## Conclusion

The backend API is partially implemented but lacks authentication, authorization, and comprehensive validation. The frontend is entirely missing. This tool cannot replace a spreadsheet in its current state. It is not safe for production use.
