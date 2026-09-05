# Release Review — Invoice List

**Status: BLOCKED** — Multiple critical issues prevent live deployment.

## Critical Issues

### 1. Configuration Syntax Error (Blocker)
**File:** `checker.config.json:7`

The JSON has a trailing comma:
```json
"rules": {
  "sessionCookieFlags": "error",  // ← trailing comma
}
```
This breaks the backend checker entirely:
```
SyntaxError: Expected double-quoted property name in JSON at position 145
```

**Impact:** Cannot run backend checker; configuration invalid. Blocks build/CI.

---

### 2. Session Secret Uses Unsafe Default (Blocker)
**File:** `src/server.js:10`

```javascript
secret: process.env.SESSION_SECRET ?? 'change-me',
```

The default value `'change-me'` is hardcoded. If `SESSION_SECRET` is not explicitly set in production, sessions are encrypted with a well-known value, defeating their purpose.

**Impact:** Complete session compromise if environment variable is missing.

---

### 3. Frontend Missing Sign-In UI (Blocker)
**File:** `public/app.js`

The UX spec (ux-walkthrough.md) requires:
1. Sign-in form displayed initially
2. Invoice count shown after sign-in
3. Sign-out to return to form

The current frontend:
- Has no sign-in form HTML
- Has no sign-out button
- Only shows a count (`${invoices.length} invoices`)
- Does not match required UX states (empty, error, loading)

**Impact:** Frontend is incomplete; MVP scope not met. Users cannot sign in/out.

---

### 4. Frontend Ignores Required UX States (Blocker)
**File:** `public/app.js:8`

UX spec requires handling:
- Empty state: "You have no invoices."
- Error state: "Could not load invoices — try again."
- Loading state: placeholder

Current implementation:
```javascript
document.getElementById('app').textContent = `${invoices.length} invoices`;
```

Only shows the count; no error, empty, or loading handling. Will crash silently on fetch failure.

**Impact:** Unreliable UX; users cannot recover from network failures.

---

### 5. Sign-In Endpoint Not Validated (High Risk)
**File:** `src/server.js:18–21`

```javascript
app.post('/api/sign-in', (req, res) => {
  req.session.staffId = req.body.staffId;
  res.json({ ok: true });
});
```

The endpoint accepts any `staffId` without validation against a staff roster. Any client can set their `staffId` to any value, then access those invoices.

**Impact:** Authorization bypass. A user can spoof any other staff member's ID and see their invoices.

---

## Medium Issues

### 6. Hardcoded Tokens in Public Code
**File:** `public/app.js:2–3`

```javascript
const MAPS_EMBED_KEY = 'AIzaSyEXAMPLE-not-a-real-key-0000';
const BILLING_API_TOKEN = 'blt_EXAMPLE-fixture-token-not-real';
```

These variables are defined but never used. They are exposed to the browser. Depending on context, this could leak actual credentials if copy-pasted into production code.

**Impact:** Leaks fixture tokens to all clients (low risk with example keys, but pattern is dangerous).

---

### 7. Frontend Sends Unused Token Header
**File:** `public/app.js:6`

```javascript
const res = await fetch('/api/invoices', { headers: { 'x-billing-token': BILLING_API_TOKEN } });
```

The backend (`src/server.js`) does not validate this header; it only checks `req.session.staffId`. The token header gives false confidence in authentication but provides no actual security.

**Impact:** Misleading code; easy to assume token validation is happening when it isn't.

---

### 8. Insufficient Test Coverage
**File:** `test/invoices.test.js`

Only one test case exists:
```javascript
test('invoices are filtered to the signed-in member of staff', () => {
  assert.deepEqual(listInvoices('nobody'), []);
});
```

Missing critical tests:
- Authorization enforcement (unsigned requests must be rejected)
- Sign-in/sign-out flow
- Full HTTP endpoint behavior
- Error handling on malformed input

**Impact:** Critical paths untested; regressions can occur silently.

---

## Summary

The invoice list has **5 blockers** that prevent production deployment:

1. **Configuration is broken** (trailing comma in JSON)
2. **Session secret is unsafe** (hardcoded default)
3. **Frontend UI is incomplete** (no sign-in form or sign-out)
4. **UX states are not implemented** (missing error, empty, loading)
5. **Authorization is not validated** (any staffId is accepted)

Additionally, there are 3 medium-risk issues around token handling and test coverage.

**Recommendation:** Resolve all 5 blockers before deploying. The current implementation does not meet the MVP scope as defined in PRODUCT.md and ux-walkthrough.md.
