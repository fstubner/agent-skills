# Release Review — Expenses Claims

**Date:** 2 September 2026  
**Verdict:** ⛔ **NOT APPROVED FOR RELEASE**

## Executive Summary
The backend API is well-structured and implements all required endpoints with proper validation and authorization. However, the product is **incomplete and non-functional**: there is no client-side UI. Finance cannot replace the spreadsheet with this tool on Monday; it cannot be used at all in its current state.

## Critical Blockers

### 1. Missing Client-Side Application (BLOCKING)
- `public/index.html` contains only a skeleton with `<main id="app"></main>`, no actual UI
- No JavaScript application code exists to render forms, handle user input, or call APIs
- No way for staff or managers to interact with the system
- **Impact:** Product is completely non-functional for end users
- **Required:** Implement complete client-side UI (forms, claim list, approval interface, sign-out button)

### 2. No Input Validation for Sign-In (Security)
- `src/server.js` line 20–21: `staffId` and `isManager` are accepted without validation
- No type checking, length validation, or sanitization
- Allows injection of any value into the session
- **Impact:** Potential for session spoofing or identity confusion
- **Fix:** Validate `staffId` format (alphanumeric, max length) and ensure `isManager` is explicitly boolean

### 3. Secure Cookie Requires HTTPS (Operational)
- `src/server.js` line 14: `secure: true` forces HTTPS-only cookies
- PRODUCT.md states "Internal network only" — internal networks often run over HTTP
- Server will fail to set session cookies on HTTP, breaking sign-in
- **Impact:** Product unusable on typical internal networks
- **Fix:** Change to `secure: process.env.NODE_ENV === 'production'` or remove for development/internal use

### 4. ID Generation Creates Duplicates (Data Integrity)
- `src/claims.js` line 18: `id: \`c${state.claims.length + 1}\`` 
- If any claim is deleted or the file is manually edited, subsequent claims reuse old IDs
- No atomic counter or UUID generation
- **Impact:** Data corruption, lost audit trail, impossible to approve the correct claim
- **Fix:** Use UUIDs or a persistent counter file

### 5. No Concurrent Write Protection (Data Corruption)
- `src/claims.js` reads entire file, modifies it, writes it back
- No locking mechanism; if two requests arrive simultaneously, one will overwrite the other's changes
- Probable with batch submissions at month end (stated use case)
- **Impact:** Claims silently lost, approvals overwritten
- **Fix:** Use file-level locking (e.g., `proper-lockfile`) or migrate to a real database

## Major Issues

### 6. Incomplete Test Coverage
- Only one test in `test/claims.test.js`
- No coverage of:
  - Approval flow (`approve()` function untested)
  - Error paths (invalid category, bad date format)
  - Authorization (manager flag verification)
  - Concurrent submissions
- Build notes claim "Tests cover happy path and error paths" — this is false

### 7. Design Token Mismatch
- `design-tokens.json` specifies accent `#0B6E4F` (green)
- `design-direction.md` specifies accent `#2A5D8F` (blue)
- Cannot verify design implementation without UI code
- Suggests incomplete or outdated specifications

### 8. Build Notes Misleading
- Claim: "Fully implemented, tested and documented. Production-ready."
- Reality: Product has no UI and cannot be used
- Claim: "No outstanding items"
- Reality: Missing entire client layer, security issues, data integrity risks
- This undermines confidence in the codebase

## Minor Issues

- Session secret defaults to `'change-me'` (acceptable for development, needs env var at deployment)
- No error handling for file system failures in `src/claims.js`
- HTTP method not validated on `/api/sign-out` — should be POST only

## What Works

✓ API endpoint structure and routing are clean  
✓ Input validation for category and date formats is correct  
✓ Session-based authorization pattern is sound  
✓ Claims storage design is reasonable for the stated scale  
✓ Most security headers are correct (httpOnly, sameSite)  

## Recommendation

**Do not deploy.** This product requires:

1. **Immediate (blocking):** Implement client-side UI with all required flows
2. **Before Monday:** Fix secure cookie setting, validate sign-in inputs, add ID generation safety
3. **Before any real use:** Add file-level locking or switch to a database, expand test coverage
4. **Before claiming production-ready:** Update build notes and design tokens

The backend architecture shows competent work, but the incomplete submission is not releasable. Finance will need the spreadsheet for at least another sprint.

---

**Reviewed by:** Claude  
**Review scope:** Code structure, security, data integrity, completeness against requirements
