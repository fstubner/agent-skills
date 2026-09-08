# Release verdict

**HOLD — Do not ship.** Critical blockers must be resolved before release.

## Blockers

### 1. Missing client UI
**Severity: Blocking.** The `public/index.html` contains only an empty doctype and main element. No JavaScript, forms, or UI exist. The application cannot function at all.

The UX walkthrough describes a complete feature (sign-in form, note list, state management, error handling) but the client code to implement it is absent. This is not deployable.

### 2. Data loss on every boot
**Severity: Blocking.** `src/store.js:8` explicitly clears all notes on startup: `fs.writeFileSync(FILE, JSON.stringify({ notes: [] }))`.

This directly violates the requirement in `docs/handover.md`: "Nothing written at handover is lost between shifts."

On a ward tablet that reboots between shifts (typical for clinical devices), every shift's notes are discarded. The handover mechanism is non-functional by design.

### 3. Authorization bypass
**Severity: Blocking.** `src/server.js:26-27` acknowledges the bug: "Any signed-in nurse can read any ward's notes by asking for it. The ward on the session is never compared with the ward being requested."

A nurse signed into ICU can query `?ward=general` and read another ward's confidential notes. This violates the requirement that notes are "visible only to staff assigned to that ward" and creates a patient privacy risk.

## Policy violations

### Input validation at trust boundaries
- `req.query.ward` is accepted directly from the client without validating against the session's assigned ward (line 31). The server trusts client-supplied ward selection.
- No validation that the `ward` value is a known ward ID.

### Test coverage for critical paths
Only one test exists (`test/notes.test.js`), which tests the trivial `renderNote` formatter. No tests for:
- API authentication (POST /api/session)
- API authorization (GET /api/notes should reject cross-ward queries)
- Note storage and retrieval
- Data persistence across server restarts
- Session validation

### Out-of-scope features
`POST /api/password-reset` is implemented but not in MVP scope. It also lacks rate limiting and email validation, creating an abuse surface.

## Other issues

### No error handling in store
`src/store.js` performs filesystem operations (read, write, append) with no error handling. Disk full, permission errors, or corrupted JSON will crash the server with no graceful recovery. File operations should validate success.

### Session storage in memory
Sessions are stored in a `new Map()` with no persistence. They're lost on server restart. While this is currently masked by data loss on every boot (issue #2), it means even within a single boot cycle, a server restart during active use will sign out all nurses and lose their notes.

## Summary

The app requires:
- Implement the client UI per the UX walkthrough
- Fix the data persistence bug (remove the line that clears notes on startup)
- Add ward authorization checks to block cross-ward note queries
- Add focused tests for authentication, authorization, and storage
- Remove or properly scope the password-reset endpoint

Current state: **incomplete and unsafe**. Ship readiness: **0%**.
