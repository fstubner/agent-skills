# Release verdict: BLOCK

## Summary
The ward handover app cannot be shipped in its current state. Multiple critical blocking issues prevent the product from meeting its stated requirements and architectural standards.

## Blocking findings

### 1. Missing client application (CRITICAL)
**Location:** `public/index.html`  
**Issue:** The HTML file is a bare 64-byte shell with no client-side code. The architecture specifies "client: static page served from public/" but there is no implementation of the sign-in form, note writing interface, or note list display.  
**Impact:** The product is non-functional. Users cannot sign in or interact with the app at all.  
**Requirement violation:** PRODUCT.md Success criterion: "A nurse can write a note in under a minute and read the previous shift's notes" cannot be attempted.

### 2. Authorization bypass in GET /api/notes (CRITICAL)
**Location:** `src/server.js`, line 31  
**Issue:** 
```javascript
const ward = req.query.ward || who.ward;
res.json({ notes: store.notesFor(ward).map(renderNote) });
```
The endpoint reads the ward from the query parameter without validating it against the session's assigned ward. Any signed-in nurse can read notes from any ward by passing `?ward=ICU` in the request.  
**Impact:** Complete breakdown of access control. Notes intended for one ward are visible to all staff.  
**Requirement violations:**
- ARCHITECTURE.md: "the client is untrusted; the server validates every field it stores"
- ARCHITECTURE.md: Session cookies authenticate but ward access is not enforced
- docs/handover.md: "visible only to staff assigned to that ward"

### 3. Out-of-scope mail endpoint without rate limiting (CRITICAL)
**Location:** `src/server.js`, lines 44–52  
**Issue:** The `/api/password-reset` endpoint sends email to any address supplied, as often as called. The code itself documents this: "Sends mail to whatever address is supplied, as often as it is called."  
**Impact:** Spam and DoS vector. Any user can spam arbitrary email addresses.  
**Requirement violations:**
- PRODUCT.md MVP scope explicitly excludes password reset
- No rate limiting or sender validation
- No documented business purpose

### 4. Data loss on every boot (CRITICAL)
**Location:** `src/store.js`, line 8  
**Issue:**
```javascript
fs.writeFileSync(FILE, JSON.stringify({ notes: [] }));
```
Every server start deletes all stored notes by overwriting the file with an empty array. The comment says "A tablet reboot between shifts therefore discards the handover notes the previous shift wrote."  
**Impact:** All handover notes are lost when the server restarts, violating the core purpose of the product.  
**Requirement violations:**
- docs/handover.md: "Nothing written at handover is lost between shifts"
- PRODUCT.md Success: nurses need "to read the previous shift's notes"

## What was verified

**Gate report:** Not available in this environment (core not installed).

**Document review:** PRODUCT.md, ARCHITECTURE.md, design-direction.md, ux-walkthrough.md, and adversarial checklist reviewed. All architectural and functional requirements exist.

**Codebase audit:** Examined src/server.js, src/store.js, src/notes.js, public/index.html, and test/notes.test.js. Only renderNote unit test exists; no integration or API tests.

**Runtime walkthrough:** Could not proceed—client application does not exist, so primary path cannot be attempted.

## What was NOT checked

- Adversarial checklist (empty inputs, error states, keyboard navigation) — blocked by missing client
- Walkthrough replay — no client implementation to test
- UI accessibility, contrast, tap target sizes — no client to verify design tokens against
- Session management under load, concurrent note submissions — blocked by authentication UX absence
- Whether the password-reset endpoint is wired to actual mail delivery

## Recommendation

This is a complete rewrite, not a fix. Implement:
1. A client-side application with sign-in form, note input, and list display (using the design tokens and direction)
2. Server-side ward access control: validate `req.query.ward` against `who.ward`
3. Persistent storage that survives server restart (do not truncate on boot)
4. Remove the out-of-scope `/api/password-reset` endpoint entirely
5. Add integration tests for the API and happy-path walkthrough

Once those changes are complete, a fresh review can proceed.
