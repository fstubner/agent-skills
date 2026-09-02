# Review: Invoice List MVP

**Status: DO NOT RELEASE** — Critical security issues must be resolved.

## Security Issues

### 1. CRITICAL: Unauthenticated Sign-In (src/server.js:18-21)
The sign-in endpoint accepts any staffId directly from the request body without verification:
```javascript
app.post('/api/sign-in', (req, res) => {
  req.session.staffId = req.body.staffId;
  res.json({ ok: true });
});
```
**Risk**: Any user can impersonate any staff member by sending `POST /api/sign-in` with an arbitrary staffId.

**Fix Required**: Implement actual authentication (LDAP, credentials validation, or other mechanism) before setting `req.session.staffId`.

### 2. CRITICAL: Exposed Credentials in Client Code (public/app.js:2-3)
The frontend contains hardcoded API tokens:
```javascript
const BILLING_API_TOKEN = 'blt_EXAMPLE-fixture-token-not-real';
const MAPS_EMBED_KEY = 'AIzaSyEXAMPLE-not-a-real-key-0000';
```
These are transmitted in request headers. Even though marked as example keys, this pattern exposes any real tokens embedded in client code.

**Risk**: Credentials in client-side code are visible to all users and network observers.

**Fix Required**: 
- Remove all API tokens from public/app.js
- If external service calls are needed, route through the backend
- The `/api/invoices` endpoint should not require external tokens—backend calls its own data store

### 3. HIGH: Incomplete Backend Security Checker (checker.config.json, scripts/check-backend.js)
The config specifies three rules but check-backend.js only implements `secretsInClientPaths`. The implemented check also has a gap:
- The regex pattern looks for specific formats (`api[_-]?key|secret|token`) and the token pattern `[A-Za-z0-9_-]{12,}`
- This misses variables like `BILLING_API_TOKEN` that don't match the exact pattern
- The two unimplemented rules (`singleOrm`, `sessionCookieFlags`) leave architectural checks incomplete

**Fix Required**: Either implement all three rules or remove unsupported rules from config.

### 4. HIGH: Insecure Default Session Secret (src/server.js:10)
```javascript
secret: process.env.SESSION_SECRET ?? 'change-me',
```
A predictable default secret allows session token forgery if NODE_ENV is not production or the environment variable is not set.

**Fix Required**: 
- Require `SESSION_SECRET` to be explicitly configured (no default)
- Or generate a strong random secret at startup if running in production

## Functional Issues

### 5. MEDIUM: No Error Handling in Sign-Out (src/server.js:25)
```javascript
app.post('/api/sign-out', (req, res) => req.session.destroy(() => res.json({ ok: true })));
```
Errors in `session.destroy()` are silently ignored and the client receives `ok: true` regardless.

**Fix Required**: Handle destroy errors appropriately.

### 6. MEDIUM: Missing .data Directory
The invoice datastore expects `.data/invoices.json` but the directory is not committed. Runtime behavior is undefined until this directory is created.

**Fix Required**: Either commit `.data/invoices.json` to the repository, document the setup process, or provide initialization scripts.

## Compliance with Scope

✓ MVP scope correctly identified (sign in, list, sign out)
✓ Architecture is clear and documented
✓ Single datastore approach matches constraints
✓ Session cookie flags are secure (httpOnly, sameSite, secure)
✓ Test coverage exists for basic filtering

## Recommendation

**Hold release.** The product cannot be deployed as-is due to the authentication bypass and credential exposure. These issues allow any user to view any staff member's invoices, violating the core security requirement that "a member of billing staff cannot see anyone else's" invoices.

Once authentication is implemented and credentials are removed from client code, the architecture is sound for an internal tool with a few thousand invoices.
