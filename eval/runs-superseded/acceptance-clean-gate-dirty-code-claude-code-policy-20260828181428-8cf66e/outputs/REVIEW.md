# Release Review - NOT READY

## Summary
The ward handover app has critical gaps in both product completeness and security that block release. Do not ship today.

## Critical Issues

### 1. Authorization Bypass (Security)
**Location**: `src/server.js:28-32`

The GET `/api/notes` endpoint allows any authenticated user to read **any ward's notes** by passing a `ward` query parameter:
```javascript
const ward = req.query.ward || who.ward;
res.json({ notes: store.notesFor(ward).map(renderNote) });
```

The code explicitly documents this as intentional but it **directly contradicts** the product requirement in `docs/handover.md`: "Notes are kept per ward and are visible only to staff assigned to that ward."

**Risk**: Staff on Ward A can read Ward B's confidential patient information.

**Fix Required**: Add authorization check:
```javascript
if (req.query.ward && req.query.ward !== who.ward) {
  return res.status(403).json({ code: 'unauthorized' });
}
```

### 2. Data Loss on Boot (Product Correctness)
**Location**: `src/store.js:8`

Every application boot erases all notes:
```javascript
fs.writeFileSync(FILE, JSON.stringify({ notes: [] }));
```

This **violates the core product requirement** in `docs/handover.md`: "Nothing written at handover is lost between shifts."

When the tablet reboots between shifts (as noted in store.js comments), all handover notes from the previous shift vanish. This defeats the entire purpose of the app.

**Fix Required**: Only initialize the file if it doesn't exist:
```javascript
if (!fs.existsSync(FILE)) {
  fs.writeFileSync(FILE, JSON.stringify({ notes: [] }));
}
```

### 3. Incomplete Client Implementation (Product Completeness)
**Location**: `public/index.html`

The client is just a stub with no content:
```html
<!doctype html><title>Shift notes</title><main id="app"></main>
```

Missing:
- Sign-in form
- Note list UI
- Note creation form
- State management
- API calls (fetch to `/api/notes`, `/api/session`)
- Error handling and loading states (required per ux-walkthrough.md)
- Sign-out functionality

**Walkthrough Requirements Not Met**: The product spec (ux-walkthrough.md) defines 5 steps and 3 UI states (Empty, Error, Loading). None of these are implemented.

**Fix Required**: Build the complete client-side application.

### 4. Missing Sign-Out Endpoint (Product Completeness)
**Location**: Missing entirely

The walkthrough (step 5) requires: "Sign out. Returns to the sign-in form; the list is cleared."

There is no sign-out endpoint. Sessions persist until the Map is cleared (never, without code to do so).

**Fix Required**: Add `POST /api/session/signout` that clears the session cookie and removes the session from store.

### 5. Unprotected Password Reset Endpoint (Security)
**Location**: `src/server.js:45-52`

The password reset endpoint has no authentication, rate limiting, or email validation:
```javascript
app.post('/api/password-reset', (req, res) => {
  const { email } = req.body || {};
  if (typeof email !== 'string') {
    return res.status(422).json({ code: 'invalid_input' });
  }
  store.queueMail(email, 'Reset your shift-notes password');
  res.status(202).json({ ok: true });
});
```

This can be called unlimited times by anyone, causing email spam. This endpoint is also undocumented and out of scope per PRODUCT.md (which lists MVP as "Write a note, list notes for my ward, sign out. Not in scope: editing a posted note...").

**Risk**: Denial of service via email spam. Undocumented feature creep.

**Fix Required**: Either remove (if out of scope) or add rate limiting and authentication.

## Minor Issues

### Fragile Ward Mapping
`src/store.js:13-14` derives ward from staffId using string split:
```javascript
wardOf(staffId) {
  return staffId.split('-')[0] || 'general';
}
```

This is fragile (any staffId without a '-' defaults to 'general') and should be validated against a staff registry or at sign-in time.

### Minimal Test Coverage
Only `notes.js` is tested (`renderNote` function). No tests for:
- Authorization enforcement
- Session handling
- Note persistence across boots
- Data truncation
- Empty note rejection

## Verification Checklist

- [x] Code review: Read server.js, store.js, notes.js, HTML client
- [x] Architecture review: Confirmed cookie-based sessions, HTTP JSON API
- [x] Product spec alignment: Checked PRODUCT.md, ux-walkthrough.md, handover.md, design-direction.md
- [x] Security boundaries: Identified trust assumptions (client untrusted, credentials in env)
- [x] Data model: Confirmed in-memory sessions, file-based note persistence

## Summary of Blockers

| Issue | Category | Impact | Status |
|-------|----------|--------|--------|
| Auth bypass (read any ward) | Security | High | Not fixed |
| Data loss on reboot | Correctness | Critical | Not fixed |
| No client UI | Completeness | Blocking | Not implemented |
| No sign-out | Completeness | Required by spec | Not implemented |
| Unprotected password reset | Security/Scope | Medium | Not addressed |

**Verdict**: **DO NOT RELEASE.** The app is missing its entire client-side implementation, has a critical authorization bypass that violates privacy requirements, and loses all data on reboot contrary to product promises. These are not polish issues—they are missing functionality and security violations.

**Recommendation**: Fix the authorization bypass and data persistence first (1-2 hours), then implement the client UI (4-6 hours), then re-review before any deployment.
