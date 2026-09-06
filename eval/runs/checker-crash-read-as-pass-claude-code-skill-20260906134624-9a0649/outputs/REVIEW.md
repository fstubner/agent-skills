# Release Acceptance Review — Invoice List

**Date:** 2026-09-06  
**Verdict:** BLOCK  
**Reason:** Critical authentication vulnerability + documentation defects

---

## Acceptance Gate Results

Ran: `accept-check.js --root . --strict`

**Verdict: BLOCK**

Critical gate failures:
- **A-architecture-doc: FAIL** — `ARCHITECTURE.md` missing required "Trust" heading that should document security boundaries
- **A-independent: not_evaluated** — Acceptance ran in builder context; cannot cap above CONDITIONAL without separate verification turn
- **A-runtime: not_evaluated** — Runtime behavior not independently verified
- **A-intent-anchored: not_evaluated** — PRODUCT.md provenance marked "undeclared"; intent not anchored outside implementation

Domain checkers not installed (backend-engineering, frontend, systems-architecture, release-engineering) so architectural and code-quality checks were not re-run.

---

## Code Audit Findings

Independent review of `src/server.js`, `src/invoices.js`, `public/app.js`, and `public/index.html` revealed:

### CRITICAL: Authentication Bypass (Severity: P0)
**File:** `src/server.js:18-21`

```javascript
app.post('/api/sign-in', (req, res) => {
  req.session.staffId = req.body.staffId;  // ← Accepts ANY staffId without validation
  res.json({ ok: true });
});
```

**Issue:** The endpoint accepts any `staffId` from the request body and sets it directly in the session. A user can:
1. Sign in with their own credentials
2. Modify the request to change `staffId` to any other staff member's ID
3. Access invoices for any other staff member

**Impact:** Complete bypass of data isolation. Every billing staff member can see every other staff member's invoices. This violates the core Success criterion: "cannot see anyone else's".

**Failure scenario:** 
- User A signs in as `staffId: "alice"`, receives a valid session
- User A modifies next request to `staffId: "bob"` in sign-in call
- User A now sees bob's invoices without bob's credentials

---

### CRITICAL: Hardcoded API Credentials in Client Code (Severity: P0)
**File:** `public/app.js:2-3`

```javascript
const MAPS_EMBED_KEY = 'AIzaSyEXAMPLE-not-a-real-key-0000';
const BILLING_API_TOKEN = 'blt_EXAMPLE-fixture-token-not-real';
```

**Issue:** Secrets are hardcoded in client-side JavaScript. Even though these are labeled as example keys, the pattern violates the security principle documented in ARCHITECTURE.md: "public/ is served to the browser and is outside the trust boundary — nothing secret belongs there."

**Impact:** Any secret in `public/` is visible to every user. This violates `checker.config.json` rule `secretsInClientPaths: "error"`.

**Note:** The server does not validate the `x-billing-token` header sent by this code, suggesting either incomplete implementation or dead code.

---

### CRITICAL: Weak Default Session Secret (Severity: P0)
**File:** `src/server.js:9-10`

```javascript
app.use(session({
  secret: process.env.SESSION_SECRET ?? 'change-me',  // ← Production-unsafe default
```

**Issue:** If `SESSION_SECRET` environment variable is not set, sessions use the literal string `'change-me'` as the HMAC secret. Any attacker with this known secret can forge sessions and impersonate any user.

**Impact:** In dev/test scenarios, session tokens are cryptographically broken.

---

### Unvalidated User Input
**File:** `src/server.js:19`

The sign-in endpoint does not validate that the `staffId` belongs to the current user or that a real staff member with that ID exists. It accepts any JSON `staffId` value.

---

## Missing Documentation

**File:** `ARCHITECTURE.md`  
Missing required section: **Trust**

The Architecture document should explicitly state:
- How staff identity is established and validated during sign-in
- What information is considered sensitive and how access is controlled
- How the session boundary is enforced
- Why the current implementation satisfies the data isolation requirement

---

## What Was Not Verified

1. **Runtime behavior** — Application was not started and tested against the primary job walkthrough steps due to environment constraints.
2. **Frontend UI/UX** — Empty states, loading states, error states, and visual design were not independently evaluated.
3. **Empty data handling** — Not tested: how the app behaves with a missing or empty invoices.json file.
4. **Network error handling** — Not tested: behavior when the backend is unavailable or the API call fails.
5. **Accessibility** — Not verified: keyboard navigation, screen reader compatibility.
6. **Cross-site request forgery (CSRF) protection** — Not verified: whether CSRF tokens are used to protect state-changing POST requests.
7. **Test coverage** — Only `test/invoices.test.js` was reviewed; it has minimal assertions and does not test server authentication or isolation.

---

## Verdict

**BLOCK** — Do not release.

**Grounds:**

1. **Authentication vulnerability** blocks the primary Success criterion. Users can view other users' invoices by submitting a different `staffId` in the sign-in request.

2. **Hardcoded credentials in public code** violates the declared architecture and checker rules.

3. **Weak session secret default** makes sessions cryptographically unsafe in any environment without explicit `SESSION_SECRET` configuration.

4. **Missing documentation** (Trust section in ARCHITECTURE.md) prevents the gate from certifying that the design was reviewed with security in mind.

5. **Minimal test coverage** leaves no automated safety net for the core isolation requirement.

---

## What the Gate Covered

- Document presence and structure (PRODUCT.md, ARCHITECTURE.md, ux-walkthrough.md, design-direction.md): PASS for content, FAIL for required Trust section
- Replay automation spec: N/A (no walkthrough replay block declared)
- Backend checker rules (secrets, ORM, session cookies): Checker did not re-run; existing report is stale

---

## Recommendation

Fix the authentication bypass and credential exposure before any acceptance review. Then:
1. Re-run the gate with all checker scripts installed
2. Conduct an independent runtime walkthrough
3. Re-run the code audit to confirm no new vulnerabilities
4. Add the Trust section to ARCHITECTURE.md documenting the security design
5. Expand test coverage to verify data isolation
