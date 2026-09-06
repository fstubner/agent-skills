# Release Review: Report a Fault

**Status:** ❌ **NOT APPROVED FOR RELEASE**

**Conclusion:** The application is incomplete and non-functional. Critical user-facing features are missing. Backend design has security gaps. Release cannot proceed.

## Critical Blocking Issues

### 1. Frontend Non-Functional (P0)
The UI is completely broken and cannot run:
- `public/app.js` calls undefined functions: `propertyPicker()`, `urgencyPicker()`, `summary()`. Application will crash on first render.
- No sign-in form implemented; sign-in flow is missing entirely from frontend.
- No sign-out UI; users cannot log out.
- No property list; users have no options to select from.
- No CSS styling; design constraints from `design-direction.md` (18px type, 56px tap targets, specific colors) are not implemented.

### 2. Missing UI Components (P0)
Required but not implemented:
- Sign-in form (required before accessing any fault features)
- Property picker (selects which property to report fault for)
- Urgency picker (normal/urgent/emergency selector with radio buttons)
- Summary display (shows what tenant is about to submit)
- Fault list display (shows reported faults)
- Error state UI (rejected submissions should preserve input)
- Loading state (mentioned in walkthrough but not implemented)

### 3. Data Model Issue: Hardcoded Timestamp (P0)
`src/faults.js:17` stamps all fault reports with hardcoded `'2026-08-31T00:00:00Z'`. This defeats the purpose of tracking when faults were reported and breaks tenant communication about when they reported an issue. Must use `new Date().toISOString()`.

### 4. Security: Session Can Impersonate Anyone (P1)
`src/server.js:19-21` accepts any `tenantId` in the request body without validation. An attacker can:
- Post as any tenant by claiming their tenancy reference
- Report faults for other tenants
- View other tenants' faults (after hijacking their session)

Sign-in must validate the tenantId against an authorized list or trusted source.

### 5. Data Loss Risk: Race Condition (P1)
`src/faults.js` uses a load-modify-save pattern without synchronization. Concurrent fault reports will lose data:
- Tenant A loads state (3 faults), adds fault 4, saves
- Tenant B loads state (3 faults), adds fault 4, saves
- Tenant A's fault is lost; B's is kept

Solution: Use a file lock (package like `proper-lockfile`) or switch to a transactional database.

### 6. Input Validation Gaps (P2)
- `description` field has no length limit; a tenant could submit multi-megabyte text
- `property` and `room` are checked for existence but not for valid values
- No constraints prevent XSS in error responses (error messages are joined and inserted as HTML without escaping in `app.js:38`)

## Security Review

**Authorization:** Session-based, enforced at `/api/` boundary. Cookies are secure (httpOnly, sameSite, secure flag set). However, sign-in does not validate the claimed tenantId.

**Data integrity:** Not encrypted or tamper-detected at rest. `.data/faults.json` is world-readable if deployed with default permissions.

**Isolation:** Faults are correctly filtered by tenantId on read. No cross-tenant data leakage observed *if* the sign-in issue is fixed.

## Test Coverage

Unit tests for `validateFault()` pass:
- Valid report accepted ✓
- Missing property rejected ✓
- Invalid urgency rejected ✓

**Gap:** No tests for:
- Session authentication flow
- Cross-tenant isolation
- Data persistence
- Race conditions
- Sign-in endpoint behavior

## Architecture Concerns

- **Timestamp decision:** Hardcoded timestamp suggests incomplete implementation or placeholder code left in place.
- **Property picker:** No options are defined. How does a tenant know which properties to choose from? This must be data-driven or at minimum define the valid property list.
- **Design tokens mismatch:** `design-tokens.json` colors (text-main: #14302A, accent: #0B6E4F) differ from `design-direction.md` (text: #1F1A1B, accent: #8A2E39). Which is correct?

## Path Forward

**Before any release, all of the following must be completed:**

1. ✗ Implement missing UI components (sign-in form, pickers, summary, list, error/loading states)
2. ✗ Add CSS styling to meet design constraints
3. ✗ Fix hardcoded timestamp—use real submission time
4. ✗ Implement sign-in validation (verify tenantId against authorized list)
5. ✗ Add concurrency control to prevent data loss
6. ✗ Add description length limit and escape HTML in error messages
7. ✗ Define property and room valid values
8. ✗ Add integration tests for auth, data isolation, and persistence
9. ✗ Deploy and test end-to-end from a phone on mobile data

## Recommendation

**Halt release.** This is a skeleton with critical missing pieces. Proceeding would result in a broken product at launch. Estimate 3-4 days of work to reach MVP completeness.

---

## What Was Verified

✓ Backend session management is properly configured (httpOnly, sameSite, secure cookies)  
✓ API routing and middleware chains are sound  
✓ Unit tests run and pass for validation logic  
✓ Validation logic correctly rejects incomplete/invalid fault reports  
✓ Fault data is correctly filtered by tenantId on read  
✓ Dependencies are minimal and current  
✓ Architecture sensibly separates concerns (server, validation, storage, frontend)

**The blocking issues are completeness, not fundamental design flaws.**
