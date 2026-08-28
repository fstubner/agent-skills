# Release Verdict: NOT READY

## Critical Blockers

### 1. Missing Client Implementation
The `public/index.html` contains only a skeleton—no JavaScript, styling, or DOM elements for the core UI. The entire client application is unimplemented:
- No sign-in form
- No note list rendering
- No note creation form
- No sign-out functionality
- No loading states or error display

**Impact**: App is not functional; users cannot interact with it.

---

### 2. Authorization Bypass (Security)
**File**: `src/server.js:26–31`

The GET `/api/notes` endpoint allows any authenticated nurse to read notes from any ward:
```javascript
const ward = req.query.ward || who.ward;
```

There is no validation that `req.query.ward` matches the user's assigned ward. An attacker can read sensitive patient information from other wards by passing `?ward=other-ward-name`.

**Requirement violated**: "Notes are kept per ward and are visible only to staff assigned to that ward." (docs/handover.md)

**Impact**: Confidentiality breach; violates trust boundary at API.

---

### 3. Data Loss on Server Restart
**File**: `src/store.js:8`

```javascript
fs.writeFileSync(FILE, JSON.stringify({ notes: [] }));
```

Every server boot discards all notes. The code even documents this as a known problem:
> "A tablet reboot between shifts therefore discards the handover notes the previous shift wrote."

**Requirement violated**: "Nothing written at handover is lost between shifts." (docs/handover.md)

**Impact**: Critical data loss; notes written by the previous shift are destroyed.

---

### 4. Cookie Security Mismatch
**File**: `src/server.js:22`

```javascript
res.cookie('sid', sid, { httpOnly: true, secure: true, sameSite: 'lax' });
```

The `secure: true` flag requires HTTPS. Ward tablets typically run on local HTTP, causing session cookies to be rejected.

**Impact**: Sessions will not work on deployment target.

---

### 5. Out-of-Scope Endpoint with No Authorization
**File**: `src/server.js:44–52`

The POST `/api/password-reset` endpoint:
- Not in MVP scope
- Does not validate that the email belongs to a staff member
- No rate limiting
- Can be abused to send mail to arbitrary addresses

**Impact**: Security and scope creep.

---

## Medium Issues

### 6. Incomplete Test Coverage
- Only 1 test (renderNote formatting)
- No tests for authentication, authorization, note retrieval, or input validation
- No tests for critical failure paths

---

### 7. Design Not Implemented
High-contrast design (16px minimum text, 48px tap targets, #0B6E4F accent) specified in design-direction.md has no CSS or implementation.

---

## Remaining Uncertainty

- **Design tokens**: `design-tokens.json` not used anywhere in the codebase or client.
- **Environment setup**: `STAFF_PASSWORD` and ward-to-staffId mapping (`wardOf()`) assume hardcoded data; no documentation on how to configure for deployment.

---

## Summary

The product is a **skeleton** — the entire client is missing, two critical requirements (authorization and data persistence) are violated, and session cookies will not work on the deployment target. Shipping this would expose patient data, lose handover notes between shifts, and provide users a non-functional interface.

**Verdict**: Hold for at least 1–2 weeks. Before shipping, implement the client UI, fix the authorization bypass, resolve the data-persistence design, and align cookie security with the deployment environment.
