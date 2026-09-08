# Release Review — Expenses Claims Tool

**Date:** 2 September 2026  
**Status:** NOT READY FOR PRODUCTION

## Critical Issues

### 1. No Authentication Mechanism (BLOCKER)
The `/api/sign-in` endpoint accepts any `staffId` without verification. Users can impersonate any colleague by sending an arbitrary staffId in the request body. This completely undermines authorization and data isolation.

- **Location:** `src/server.js:19-23`
- **Impact:** Any user can view and approve claims for any staff member
- **Fix required:** Implement proper authentication (LDAP/directory integration, or approved credential validation)

### 2. Unvalidated Amount Field (BLOCKER)
Claims can be submitted with invalid amounts. The code does not validate that `amountMinor` is a positive integer, allowing negative, zero, null, string, or arbitrarily large values.

- **Location:** `src/server.js:25-29` (validation missing) and `src/claims.js:20` (directly stored)
- **Impact:** Invalid financial records written to datastore
- **Fix required:** Validate that `amountMinor` is a positive integer with reasonable bounds

### 3. Hardcoded Session Secret (SECURITY RISK)
The default session secret is `"change-me"` (line 11, `src/server.js`). While there is a comment acknowledging this, the code will run in production with a trivial secret if `SESSION_SECRET` is not set, making session forgery trivial.

- **Location:** `src/server.js:11`
- **Impact:** Session cookies can be forged by anyone
- **Fix required:** Refuse to start if `SESSION_SECRET` is not set to a strong value

### 4. Race Condition in ID Generation (DATA INTEGRITY RISK)
Claim IDs are generated as `c${state.claims.length + 1}`. If two claim submissions happen concurrently, both could generate the same ID, causing a collision where one claim overwrites another.

- **Location:** `src/claims.js:18`
- **Impact:** Claims can be lost or overwritten under concurrent load
- **Fix required:** Use a UUID or atomic counter instead of array length

## Moderate Issues

### 5. Manager Can Approve Any Claim
The approval endpoint has no department/hierarchy validation. A manager can approve claims for staff members who are not their direct reports. The build notes claim "A claim can only be... read by... their line manager" but this is not enforced.

- **Location:** `src/server.js:33-37`
- **Impact:** Managers can approve claims outside their responsibility
- **Fix required:** Add manager-to-staff mapping and validate before approval

### 6. HTTPS Required for Secure Cookies on Internal Network
The session cookie is marked `secure: true`, which blocks HTTP usage. This may cause friction on internal-only network deployments during development or if HTTPS is not available.

- **Location:** `src/server.js:14`
- **Impact:** Sessions fail to work if deployed over HTTP
- **Note:** If the deployment is truly internal-only and HTTP is acceptable, consider making this conditional

### 7. Minimal Test Coverage
Only one test case exists, covering only the happy path for submit and claimsFor. No tests for:
- Approval workflow
- Input validation (category, date, amount)
- Manager authorization checks
- Session handling
- Concurrent submissions

- **Location:** `test/claims.test.js`
- **Impact:** Bugs in validation and approval logic are undetected

## Minor Issues

### 8. Missing Timestamps
Submitted and approved claims have no timestamp. Financial audit trails typically require "when was this approved?" information.

- **Location:** `src/claims.js:23-36`
- **Impact:** No audit trail for approval timing

### 9. No Error Logging
File read/write errors are silently caught. Issues in persistence may go unnoticed.

- **Location:** `src/claims.js:7`
- **Impact:** Difficult to debug data persistence failures

## Compliance Against Stated Goals

**Build notes checklist claims:**
- ~~"Every API input is validated at the boundary"~~ **FAILED** — Amount is not validated
- ~~"Authorisation on every route"~~ **FAILED** — Sign-in has no authentication; manager approval lacks hierarchy validation
- ~~"Tests cover happy path and error paths"~~ **FAILED** — Only one happy-path test
- ✓ "No secrets in client paths" — PASS

## Verdict

**DO NOT RELEASE.** The tool has three blocker-level security and data integrity issues that must be resolved before production use:

1. Implement user authentication (currently anyone can impersonate anyone)
2. Validate the `amountMinor` field with positive integer and reasonable bounds checks
3. Prevent ID collisions under concurrent submissions (replace length-based generation with UUID)

Additionally, the hardcoded session secret and manager approval bypass should be addressed. After these fixes, expand test coverage to include error cases, validation failures, and concurrent operations.

---

**Reviewed by:** Claude Haiku (independent review)  
**Verification scope:** Code structure, validation logic, authorization checks, data integrity, test coverage
