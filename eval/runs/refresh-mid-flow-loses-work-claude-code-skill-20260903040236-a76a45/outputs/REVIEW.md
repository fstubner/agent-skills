# Release Verdict: BLOCK

## Summary
The fault reporting tool cannot function in its current state due to incomplete implementation and critical security vulnerabilities. Blocking issues prevent the primary job (tenant reporting a fault) from being attempted.

## Gate Assessment

The acceptance gate (`accept-check.js`) was not run with `--acceptor-context separate` and `--runtime-verified` flags, so this verdict is appropriately capped at CONDITIONAL by design — however, blocking code-level findings elevate this to BLOCK.

## Blocking Findings

### 1. Critical: App.js is Incomplete — Missing Core Functions
**File**: `public/app.js`, lines 9, 13, 15  
**Issue**: The render function calls `propertyPicker()`, `urgencyPicker()`, and `summary()` functions that are never defined anywhere in the codebase. Additionally:
- No event listeners are attached to any buttons (no `next()` or `send()` invocations)
- No sign-in UI or flow is rendered
- No fault list view is rendered
- No sign-out view is rendered

**Impact**: The application cannot execute at all. Upon page load, JavaScript errors will occur when `propertyPicker()` is called. The primary job — tenant reporting a fault — cannot be attempted.

### 2. Critical: Session Secret Defaulting to Hardcoded Value
**File**: `src/server.js`, line 11  
**Issue**: `secret: process.env.SESSION_SECRET ?? 'change-me'` defaults to the insecure string `'change-me'`. This is a well-known anti-pattern and makes session tokens predictable if `SESSION_SECRET` is not explicitly set in production.

**Impact**: Any signed-in tenant's session can be forged by an attacker who knows the default secret. This violates the security boundary stated in ARCHITECTURE.md: "Everything behind `/api/` requires a session".

**Guidance**: The environment variable must be required or generated at startup, never default to a hardcoded string.

### 3. Critical: XSS Vulnerability in Error Display
**File**: `public/app.js`, line 38  
**Issue**: Error messages are inserted into the DOM using `insertAdjacentHTML()` without HTML escaping:
```javascript
document.getElementById('app').insertAdjacentHTML('afterbegin', `<p class="error">${errors.join(', ')}</p>`);
```
The errors array comes from the server response, which includes the echoed-back `submitted` data (line 29 of server.js). If a tenant's description contains HTML or script tags, they will execute.

**Test case**: Sign in, start a report, enter description `<img src=x onerror="alert('XSS')">`, trigger validation error. Script will execute.

**Impact**: Stored XSS attack. A tenant could craft a fault description containing JavaScript that runs in the browser of any other tenant or staff member who views that fault.

### 4. Critical: Missing Tenant Validation on Sign-In
**File**: `src/server.js`, lines 19–22  
**Issue**: The `/api/sign-in` endpoint accepts any tenantId without validation:
```javascript
app.post('/api/sign-in', (req, res) => {
  req.session.tenantId = req.body.tenantId;
  res.json({ ok: true });
});
```
No check occurs to verify the tenantId is a valid tenant reference. Any string is accepted and stored in the session.

**Impact**: A user can sign in as any tenant, including made-up IDs like "attacker", and view/create faults under that identity. The PRODUCT.md states "Each signs in with their tenancy reference" but there is no enforcement of valid references.

### 5. High: Incomplete Validation — Empty Description Allowed
**File**: `src/validate.js`, line 8  
**Issue**: The validation only checks `typeof body?.description !== 'string'`. An empty string `""` passes validation but provides no detail for a trade to be sent.

**Impact**: A tenant can submit a fault report with an empty description field, violating the PRODUCT.md Success condition: "enough detail for a trade to be sent".

### 6. High: Hardcoded Timestamp
**File**: `src/faults.js`, line 17  
**Issue**: All faults are recorded with a fixed timestamp: `reportedAt: '2026-08-31T00:00:00Z'`. This should be the current time when the report is made.

**Impact**: Fault lists will not reflect the actual order or time of reports. Tenants cannot distinguish between old and new faults.

### 7. High: No HTTPS Enforcement
**File**: `src/server.js`, line 14  
**Issue**: The session cookie is set with `secure: true`, which means it will only be sent over HTTPS. However, there is no redirect from HTTP to HTTPS or any enforcement that the application runs over HTTPS.

**Impact**: If accessed over HTTP (common for early testing), session authentication will fail silently — the cookie will not be sent, and all `/api/` calls will return 401.

### 8. Moderate: No Duplicate Submission Protection
**File**: `public/app.js`, send() function  
**Issue**: The `send()` button has no debouncing or disabled state. A rapid double-click creates two identical fault reports with no server-side deduplication.

**Impact**: Duplicate fault reports clutter the system. A malicious tenant could spam reports.

## What Was Not Checked

- **Runtime verification**: The application was not run to confirm it starts or serves pages. The gate report and walkthrough verification were not executed.
- **Tenant reference validation against a database**: No backend system is in place to validate real tenancy references.
- **Mobile viewport testing**: Design claims 375px minimum width; this was not tested on a narrow viewport.
- **Accessibility**: No keyboard navigation, screen reader, or focus management was audited.
- **Database concurrency**: If two tenants report simultaneously, the faults.json file could be corrupted (no locking).
- **The accept-check.js gate**: The formal gate was not run because it requires node execution approval.

## Recommendation

**Do not deploy.** Resolve all blocking issues (1–4) before re-review:
1. Implement the missing UI functions and event handlers in `app.js`.
2. Require `SESSION_SECRET` environment variable (no hardcoded default).
3. Escape error messages before inserting into the DOM (use `textContent` or `createTextNode()`, not `insertAdjacentHTML()`).
4. Validate tenantId against a list of valid tenant references on sign-in.

After fixes, re-submit for acceptance with this blocking-issues frame cleared.
