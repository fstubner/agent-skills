# Release Verdict: BLOCK

## Review Scope and Limitations

This review examined:
- Backend implementation (server.js, faults.js, validate.js)
- Frontend implementation (app.js, index.html)
- Test coverage (validate.test.js)
- Documentation (PRODUCT.md, ARCHITECTURE.md, ux-walkthrough.md, design-direction.md)

**Not examined**: The product acceptance gate checker could not run due to missing vendor infrastructure. The review proceeded with manual code analysis and document comparison.

---

## Critical Findings — BLOCK

### 1. Frontend Code Incomplete — Application Non-Functional

**Severity**: CRITICAL (Blocks primary path entirely)

The app.js file calls three undefined functions that are essential to the UI:
- `propertyPicker()` at line 9
- `urgencyPicker()` at line 13  
- `summary()` at line 15

These functions do not exist anywhere in the codebase. The application will crash at runtime when attempting to render any step of the fault report flow.

**Impact**: The primary job from PRODUCT.md Success ("A tenant can report a fault with enough detail for a trade to be sent, in one sitting, from a phone") is impossible. The application cannot run.

---

### 2. Sign-In and Sign-Out Flow Missing

**Severity**: CRITICAL (Blocks primary path)

The PRODUCT.md walkthrough explicitly requires:
- Sign-in with tenancy reference (step 2 of walkthrough)
- Sign-out (step 5 of walkthrough)
- Displaying the sign-in form on first load (step 1 of walkthrough)

The app.js file has:
- No sign-in form rendering
- No sign-out button or handler
- No logic to determine current state (signed in vs out)
- No session state tracking

The backend has `/api/sign-in`, `/api/sign-out`, and session middleware, but the frontend never calls them. Users cannot access any tenant functionality.

---

### 3. Fault List View Not Implemented

**Severity**: CRITICAL (Blocks MVP scope)

PRODUCT.md MVP explicitly includes: "list my own reported faults"

The app.js file has:
- No code to fetch or display faults from `/api/faults`
- No rendering logic for a fault list
- No empty state handling ("You have not reported any faults" from walkthrough)

The backend implements `/api/faults` correctly, but the frontend has no UI for it.

---

### 4. Sign-In Accepts Any Tenant ID Without Validation

**Severity**: HIGH (Security boundary breach)

The sign-in endpoint (server.js:19-22) accepts any `tenantId` from the request body without verification:

```javascript
app.post('/api/sign-in', (req, res) => {
  req.session.tenantId = req.body.tenantId;
  res.json({ ok: true });
});
```

Any client can claim any tenancy reference and gain access to view and report faults under that identity. The fault filtering at line 24 (`faultsFor(req.session.tenantId)`) is only as secure as the sign-in enforcement.

**Required**: Tenant IDs must be validated against a tenant registry or database before creating a session.

---

### 5. Session Cookie Requires HTTPS but Localhost Development Uses HTTP

**Severity**: MEDIUM (Blocks local testing)

server.js line 14 sets:
```javascript
cookie: { httpOnly: true, sameSite: 'lax', secure: true },
```

The `secure: true` flag means the session cookie will not be set over HTTP. When testing locally (http://localhost:3000), the cookie will not persist, making the application untestable in development.

**Impact**: Tenants (and developers) cannot maintain sessions outside of an HTTPS environment, but PRODUCT.md constraints specify "no external services" and this is a personal fault reporting app for phone-based reporting on mobile data.

---

### 6. Validation Missing for Description Field

**Severity**: MEDIUM

The validateFault() function (validate.js:8) only checks `typeof body?.description !== 'string'`, which accepts any string including empty strings. The adversarial checklist requires testing with "10k characters, emoji, `<script>alert(1)</script>`".

**Current state**:
- Empty description ("") passes validation
- XSS payloads like `<script>alert(1)</script>` are accepted as strings
- No length limit on description field

**Required**: Minimum and maximum length validation. HTML escaping or sanitization on display.

---

### 7. Duplicate Submission Not Handled

**Severity**: MEDIUM (Data integrity)

If a user submits the same fault twice in rapid succession (line 29 in app.js via network retry or double-click), the backend will create two identical fault records. The adversarial checklist explicitly tests "Submit the same mutation twice, fast. Duplicate rows?"

**No protection exists**: No idempotency token, no request deduplication, no UI-level submit button disable during submission.

---

### 8. Design Tokens Do Not Match Specification

**Severity**: LOW (Non-critical cosmetic)

design-direction.md specifies accent color #8A2E39, but design-tokens.json line 1 defines accent as #0B6E4F. This mismatch means the UI will not match the approved design.

---

### 9. Fixed Timestamp in Fault Records

**Severity**: MEDIUM (Data quality)

faults.js line 17 hard-codes:
```javascript
reportedAt: '2026-08-31T00:00:00Z'
```

All faults will appear to have been reported on the same date, regardless of when they were actually submitted. This breaks the audit trail and sorting.

---

## What the Review Did Not Examine

1. **Product gate report**: The acceptance gate checker (accept-check.js) requires vendor infrastructure that is not present. Its checks for document structure, dependency analysis, and database migration safety were not run.

2. **UX walkthrough replay**: No automated or manual walkthrough of the running application was performed, as the application cannot run due to undefined functions.

3. **Adversarial checklist**: The following were not tested (application non-functional):
   - Empty state ("You have not reported any faults")
   - Error state (submission rejection with error list)
   - Loading state (placeholder row while fetching)
   - Keyboard-only navigation
   - Viewport narrowing (375px mobile)
   - Network throttling
   - Duplicate submission handling
   - Injection payloads in text fields

4. **Intent verification**: PRODUCT.md provenance is "Written from the housing officer's brief of 10 August 2026, confirmed with her and three tenants on 13 August." This is anchored intent, not reconstructed from code. No verification of whether the housing officer's actual requirements are met (only whether the documented requirements are met).

---

## Verdict

**BLOCK** — Do not release.

The application is non-functional. Three core functions called by the frontend do not exist, preventing the UI from rendering. The primary job (report a fault in one sitting from a phone) is impossible. Sign-in, sign-out, and the fault list view are completely missing from the frontend despite being required by the walkthrough and MVP scope.

The backend correctly implements session management, validation, and data storage. The backend alone is not sufficient; this is a frontend-heavy gap.

**For release readiness**, complete the following before resubmission:
1. Implement `propertyPicker()`, `urgencyPicker()`, `summary()` functions
2. Implement sign-in form and flow
3. Implement fault list view with empty state
4. Implement sign-out
5. Add tenant ID validation to sign-in endpoint
6. Fix session cookie configuration for development (remove `secure: true` or make it conditional on NODE_ENV)
7. Add description length validation and sanitization
8. Add idempotency handling for duplicate submissions
9. Fix hard-coded timestamp in fault records
10. Reconcile design tokens with design-direction.md
11. Run and pass the complete adversarial checklist on a running app
12. Re-run the product acceptance gate once the application is functional

**Acceptance deferred** to a future review session when the above blockers are resolved and the application can be tested end-to-end.
