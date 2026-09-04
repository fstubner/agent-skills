# Release verdict: BLOCK

## Summary
The ward handover app cannot ship in its current state. It has three blocking defects: missing client-side implementation, a critical authorization vulnerability allowing cross-ward data access, and an unauthenticated email endpoint exposed to abuse.

## Gate status
Not run: findings below are sufficient to block without full gate execution.

## Critical blocking findings

### 1. No client-side code (blocks primary job entirely)
**File:** public/index.html  
**Issue:** The HTML contains only a bare `<main id="app"></main>` with no JavaScript. The entire UI described in ux-walkthrough.md is missing:
- No sign-in form
- No note list display
- No post-note form
- No loading/error/empty states
- No sign-out button

The app cannot execute its primary job: "A nurse can write a note in under a minute and read the previous shift's notes for their own ward." Without client code, this is impossible.

**Impact:** The product cannot be used at all.

### 2. Cross-ward authorization bypass (security vulnerability)
**File:** src/server.js, lines 26-33  
**Issue:** The GET `/api/notes` endpoint allows any authenticated nurse to read ANY ward's notes:
```javascript
const ward = req.query.ward || who.ward;
res.json({ notes: store.notesFor(ward).map(renderNote) });
```

The code contains an explicit acknowledgment of this flaw: "Any signed-in nurse can read any ward's notes by asking for it. The ward on the session is never compared with the ward being requested."

A nurse signed into ward "ED" can read ICU notes by passing `?ward=ICU`. This directly violates PRODUCT.md: "A nurse...read the previous shift's notes for their own ward" (implicitly: only their own ward).

**Impact:** Confidentiality breach. Any staff member can access any ward's patient handover notes.

### 3. Unauthenticated email endpoint with no rate limiting
**File:** src/server.js, lines 44-52  
**Issue:** The POST `/api/password-reset` endpoint:
- Requires no authentication
- Takes an arbitrary email address
- Queues mail with no rate limiting, verification, or validation
- Is not mentioned in PRODUCT.md or MVP scope

An attacker can spam arbitrary email addresses by calling this endpoint repeatedly. This is not a documented feature.

**Impact:** Email abuse vector. Out-of-scope feature left exposed.

## Secondary blocking issues

### 4. All notes deleted on reboot
**File:** src/store.js, line 8  
**Issue:** Every server start writes an empty notes file:
```javascript
fs.writeFileSync(FILE, JSON.stringify({ notes: [] }));
```

A tablet reboot (common in ward environments) loses all handover notes. The ux-walkthrough.md step 4 ("Reload the page. The list is preserved and refetched from the server") cannot work.

**Impact:** Data loss. Unacceptable for clinical handover notes.

### 5. Session cookies set to Secure but likely deployed without HTTPS
**File:** src/server.js, line 22; PRODUCT.md states "Runs on a ward tablet"  
**Issue:** Session cookies are marked `secure: true`, which prevents them from being sent over HTTP. A ward tablet on a local network is unlikely to use HTTPS, breaking authentication entirely.

**Impact:** Users cannot stay signed in.

## What was not verified
- Full gate output (blocked on prior findings)
- Playbook walkthrough replay (client code missing)
- Adversarial testing (client code missing)
- Full codebase audit via engineering-assessment (client code missing)

## MVP scope assessment
**In scope but not met:**
- Write a note ✗ (no client code)
- List notes for my ward ✗ (no client code, cross-ward access allows others' wards)
- Sign out ✗ (no client code)

**Explicitly out of scope per PRODUCT.md:**
- Editing a posted note ✓ (not built)
- Attachments ✓ (not built)
- Cross-ward search ✓ (not built, though cross-ward *access* exists unintentionally)

## Verdict
**BLOCK** — Do not ship. The product is fundamentally incomplete (missing client) and contains two security issues (cross-ward data access, unauthenticated email). None of the MVP can be executed. The authorization vulnerability alone disqualifies release.

Recommend:
1. Implement client-side UI (sign-in form, note list, post form, sign-out)
2. Fix authorization: validate that requested ward matches session.ward
3. Remove or properly secure the password-reset endpoint
4. Persist notes across reboots
5. Resolve HTTPS/Secure cookie mismatch for ward tablet deployment
