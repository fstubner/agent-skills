# Release Verdict: NOT READY FOR PRODUCTION

## Summary
The fault reporting tool is incomplete and cannot function in its current state. Critical implementation gaps prevent the application from working at all, and multiple design/security issues must be resolved before release.

## Critical Issues (Must Fix)

### 1. Missing Frontend Implementation (Severity: Blocking)
**Files:** `public/app.js`

The application references three undefined functions:
- `propertyPicker()` - called on line 8
- `urgencyPicker()` - called on line 12  
- `summary()` - called on line 14

Result: ReferenceError on page load. The app cannot proceed past step 1.

**Evidence:** Functions are called but never defined anywhere in the codebase.

---

### 2. Broken Success Path (Severity: Blocking)
**Files:** `public/app.js`

After successful submission, the code sets `step = 4` (line 40) and calls `render()`, but the render function only handles steps 1–3. Step 4 has no case, leaving the UI blank.

**Fix required:** Either add a step-4 render case (e.g., success confirmation) or redirect to the faults list.

---

### 3. No Styling or Design Implementation (Severity: Blocking)
**Files:** `public/app.js`, `public/index.html`, codebase-wide

The design direction specifies:
- Minimum text size of 18px
- 56px tap targets
- Specific accent color (#8A2E39) and text color (#1F1A1B)
- Designed for mobile phone use in corridors/stairwells

Current state:
- Zero CSS in the project
- No stylesheet linked in HTML
- `design-tokens.json` exists but contains different colors and is never referenced
- No viewport meta tag for mobile responsiveness
- No accessibility considerations (labels, semantic HTML, ARIA)

Result: App is unstyled, not mobile-friendly, and fails the design requirements.

---

### 4. Missing Data Layer (Severity: Blocking)
**Files:** `public/app.js`

Step 1 requires tenants to "choose the property and room," but:
- No property/room data is defined or loaded
- No API endpoint exists to fetch available properties
- `propertyPicker()` function is missing (cannot render options)

Result: Tenants cannot complete step 1.

---

### 5. No Sign-In Validation (Severity: High)
**Files:** `src/server.js`, line 20

The sign-in endpoint accepts any `tenantId` without validation:

```javascript
app.post('/api/sign-in', (req, res) => {
  req.session.tenantId = req.body.tenantId;
  res.json({ ok: true });
});
```

Any user can sign in as any tenancy reference. There is no:
- Validation against a known list of tenants
- Password or authentication challenge
- Rate limiting

Result: A tenant (or attacker) can impersonate other tenants and view/submit faults on their behalf.

---

### 6. Race Condition in Fault Reporting (Severity: High)
**Files:** `src/faults.js`, lines 15–20

The fault ID generation is vulnerable to concurrent requests:

```javascript
export function report(tenantId, fault) {
  const state = load();
  const record = { id: `f${state.faults.length + 1}`, ... };  // ← calculated here
  state.faults.push(record);
  save(state);  // ← file written here
  return record;
}
```

If two requests arrive simultaneously:
1. Both load the file (faults.length = 5)
2. Both calculate id as `f6`
3. Both write to disk
4. The second write overwrites the first, losing data

Result: Fault reports may be lost or overwritten under concurrent load.

---

## High-Priority Issues (Should Fix)

### 7. Hardcoded Timestamp (Severity: High)
**Files:** `src/faults.js`, line 17

```javascript
reportedAt: '2026-08-31T00:00:00Z'
```

All fault reports show the same timestamp (2026-08-31). Should use the current time.

---

### 8. XSS Vulnerability in Error Handling (Severity: High)
**Files:** `public/app.js`, line 37

```javascript
document.getElementById('app').insertAdjacentHTML('afterbegin', `<p class="error">${errors.join(', ')}</p>`);
```

If validation errors contain user-controlled content (e.g., property name), this is an XSS vector. Should use `textContent` or escape HTML.

---

### 9. Weak Default Session Secret (Severity: High)
**Files:** `src/server.js`, line 11

```javascript
secret: process.env.SESSION_SECRET ?? 'change-me',
```

The default secret is publicly documented in code. Production deployments MUST set `SESSION_SECRET` environment variable, but there is no enforcement or warning.

---

### 10. No CSRF Protection (Severity: Medium)
**Files:** `src/server.js`

The app relies only on `sameSite: 'lax'` for CSRF protection. For a public-facing web app, explicit CSRF tokens should be implemented.

---

### 11. Insufficient Input Validation (Severity: Medium)
**Files:** `src/validate.js`

Issues:
- Empty descriptions pass validation (line 8 checks `typeof === 'string'` but not length)
- Property and room are checked only for existence, not against known values
- No length limits on description field
- No escaping or sanitization before storage

---

### 12. Network Error Handling (Severity: Medium)
**Files:** `public/app.js`, line 28

The `send()` function doesn't handle fetch failures (network errors). If the network is down or the server crashes, the promise rejection is unhandled and the UI becomes inconsistent.

**Example:** Tenants on mobile data may experience dropped connections.

---

### 13. Missing Error Accumulation Prevention (Severity: Low)
**Files:** `public/app.js`, line 37

When validation fails and errors are shown, calling next() or send() again appends more errors. Previous errors should be cleared before showing new ones.

---

## Design/Documentation Issues (Should Fix)

### 14. Design Token Mismatch
**Files:** `design-direction.md`, `design-tokens.json`

Design direction specifies:
- Accent: #8A2E39
- Text: #1F1A1B

Design tokens specify:
- Accent: #0B6E4F
- Text: #14302A

The tokens are not used in the code and don't match the design brief.

---

### 15. No README or Deployment Guide
**Missing:** README.md or DEPLOYMENT.md

Operators need to know:
- How to install: `npm install`
- How to run: `npm start` or `node src/server.js`
- Required environment variables: `SESSION_SECRET`, `PORT`
- Data storage location: `.data/faults.json`
- How to back up data

---

### 16. Incomplete Test Coverage
**Files:** `test/validate.test.js`

Only the validation module is tested. No tests exist for:
- Server endpoints (sign-in, faults list, faults POST)
- Session management
- Fault storage and retrieval
- Error handling
- Concurrent submissions

---

## What Works

- ✅ Basic server structure (Express, sessions, JSON storage)
- ✅ API endpoints are defined and wired
- ✅ Validation logic for fault fields (property, room, urgency, description)
- ✅ Fault listing filters by tenantId
- ✅ Session middleware is configured with secure defaults (httpOnly, sameSite)

---

## Recommendation

**Do not release to production.** The implementation is ~40% complete. The following must be done before any tenant use:

1. **Implement missing frontend functions** (`propertyPicker`, `urgencyPicker`, `summary`)
2. **Add complete CSS styling** matching the design direction
3. **Implement tenancy validation** at sign-in (compare against known tenant list)
4. **Fix concurrency issues** in fault reporting (use file locking or database)
5. **Fix hardcoded timestamp** to use current time
6. **Add success state** to the UI (step 4 or redirect)
7. **Fix XSS vulnerability** in error display
8. **Enforce SESSION_SECRET** at startup
9. **Add fetch error handling** for network failures
10. **Implement property/room data** model and API

**Estimated effort:** 3–5 days for a competent developer to complete core functionality and fix critical issues.

**Safety for housing officer and tenants:** Currently unsafe to deploy. No authentication, potential data loss, incomplete UI, and security vulnerabilities present.
