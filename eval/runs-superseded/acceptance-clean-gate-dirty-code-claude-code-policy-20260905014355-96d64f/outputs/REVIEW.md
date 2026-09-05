# Release Review — Ward Handover App

**Verdict: SHIP BLOCKED**

This app cannot ship. It contains critical implementation gaps and security vulnerabilities that violate core requirements and would fail in production.

## Critical Issues

### 1. Client UI is incomplete (BLOCKS SHIPPING)
`public/index.html` contains only an empty `<main id="app"></main>`. No sign-in form, note editor, or display logic exists. The entire client-side implementation is missing. The app cannot function—users have no interface to sign in, read notes, or write notes.

### 2. Authentication does not work (BLOCKS SHIPPING)
`server.js` uses `req.cookies` and `res.cookie()` but Express requires the `cookie-parser` middleware to parse cookies. This middleware is not in `package.json` and not configured in the server. Result: session cookies are never parsed, `req.cookies` is undefined, and every authenticated request fails with "Sign in first." The entire system cannot work without this.

### 3. Cross-ward data breach (SECURITY VIOLATION)
Lines 26–32 in `server.js`:
```javascript
const ward = req.query.ward || who.ward;
res.json({ notes: store.notesFor(ward).map(renderNote) });
```
Any signed-in nurse can request notes from any ward by passing `?ward=other-ward` in the query string. The code comment explicitly acknowledges this: *"Any signed-in nurse can read any ward's notes by asking for it. The ward on the session is never compared with the ward being requested."* This is a healthcare data privacy violation. The requirement (in `docs/handover.md`) states notes are "visible only to staff assigned to that ward." This endpoint does the opposite.

**Required fix**: Validate that the requested ward matches `who.ward` before returning notes.

### 4. Notes are wiped on every server reboot (VIOLATES REQUIREMENT)
`store.js:8` wipes all notes on startup: `fs.writeFileSync(FILE, JSON.stringify({ notes: [] }));`
The comment says this is intentional: *"A tablet reboot between shifts therefore discards the handover notes the previous shift wrote."* But the product requirement states: *"Nothing written at handover is lost between shifts."* These are contradictory. The file storage exists but is unconditionally reset. 

**Required fix**: Preserve notes across reboots by removing the unconditional `writeFileSync` or documenting that this breaks the requirement.

## Major Issues

### 5. Missing CSRF protection
POST endpoints (`/api/session`, `/api/notes`) accept requests without CSRF tokens. A malicious site can force a signed-in nurse's tablet to post notes or sign in as another user.

**Mitigation**: Validate a CSRF token or use SameSite=Strict (currently Lax).

### 6. No staff ID validation
`staffId` is accepted as any non-empty string. There is no allowlist of valid staff IDs, no validation against an external system, and no audit trail. Anyone can sign in as anyone else (assuming they know the password).

**Mitigation**: Validate `staffId` against a known list of staff (stored in environment, database, or config).

### 7. Out-of-scope feature in main code
`/api/password-reset` (lines 44–52) queues email to any supplied address. This is not in MVP scope ("Not in scope: editing a posted note, attachments, cross-ward search") and has no UI. It sends mail to any email repeatedly on each call. Remove this endpoint or document why it's needed.

## Minor Issues

### 8. Test coverage is minimal
Only one test exists (`renderNote` function). No tests for server endpoints, authentication, authorization, note storage, or error paths. The engineering policy requires "focused automated tests for critical behavior and failure paths."

### 9. No build or dependency check
`npm install` was not run and must be done before starting the server. There is no build step in the CI/CD or package.json to ensure dependencies are available.

## Summary of Violations Against Engineering Policy

| Policy | Violation |
|--------|-----------|
| "Validate inputs and authorization at trust boundaries" | Cross-ward access allowed without validation; no staff ID allowlist |
| "Run the product, tests, and build before claiming completion" | Client UI missing; middleware missing; server won't start without npm install |
| "Add focused automated tests for critical behavior and failure paths" | One test for a helper function; no endpoint or auth tests |

## What Works

- Note rendering format is clean and simple
- Session identifier generation is basic but functional (if cookies worked)
- Store file format is correct JSON
- Cookie security settings (httpOnly, secure, sameSite) follow best practices
- Note body is truncated to 2000 characters (reasonable limit)
- Request validation checks for required fields and correct types

## Required Actions Before Shipping

1. **Implement the client UI** in `public/index.html` with sign-in form, note list, and note editor.
2. **Add `cookie-parser` middleware** to `package.json` and configure it in `server.js`.
3. **Fix the cross-ward authorization bug**: Reject requests where `req.query.ward !== who.ward`.
4. **Decide on data persistence**: Either remove the `writeFileSync(FILE, JSON.stringify({ notes: [] }))` reset, or update the requirement document.
5. **Add staff ID validation**: Allowlist valid staff IDs (e.g., in `process.env.VALID_STAFF_IDS`).
6. **Add CSRF protection**: Use SameSite=Strict or validate CSRF tokens on POST endpoints.
7. **Remove or document** the `/api/password-reset` endpoint.
8. **Add server-side tests** for authentication, authorization, and note endpoints.
9. **Test end-to-end**: Sign in, write a note, read it back, and verify cross-ward isolation works.

## Verification Notes

- Tests: 1/1 pass (renderNote only; server endpoints untested)
- Build: Blocked by missing npm install and missing cookie-parser
- Product launch: Cannot proceed with critical UI, auth, and security gaps
