# Release Review Verdict

**VERDICT: BLOCK**

## Gate Status (Manual)
The automated acceptance gate could not run due to missing core infrastructure, so this review was conducted manually following the product-acceptance workflow.

## Critical Findings

### 1. Missing Client UI (BLOCKING)
**File**: `public/index.html`
**Issue**: The client-facing UI is essentially non-existent. The HTML file contains only:
```html
<!doctype html><title>Shift notes</title><main id="app"></main>
```
No CSS, no JavaScript, no forms, no ability for nurses to sign in, write notes, or read notes. The entire primary job is impossible to complete.

**Impact**: The core product is not deliverable. Nurses cannot use this app at all.

---

### 2. Data Loss on Reboot (BLOCKING)
**File**: `src/store.js`, line 8
**Issue**: Every server boot executes `fs.writeFileSync(FILE, JSON.stringify({ notes: [] }))`, which wipes all notes. The requirements state "Nothing written at handover is lost between shifts," but any tablet reboot deletes all notes.

**Impact**: Violates explicit product requirement. Notes cannot survive a shift boundary, defeating the core purpose of handover notes.

---

### 3. Unauthorized Ward Access (BLOCKING - Security)
**File**: `src/server.js`, lines 26-31
**Issue**: The GET `/api/notes` endpoint allows any signed-in user to read any ward's notes. The code comment explicitly documents this vulnerability:
```javascript
// Any signed-in nurse can read any ward's notes by asking for it. The ward
// on the session is never compared with the ward being requested.
app.get('/api/notes', (req, res) => {
  const who = session(req);
  if (!who) return res.status(401).json({ code: 'no_session', message: 'Sign in first' });
  const ward = req.query.ward || who.ward;  // <-- ward is not validated against session
  res.json({ notes: store.notesFor(ward).map(renderNote) });
});
```
Users can pass `?ward=otherward` and read confidential patient handover notes from other wards. The requirements state "Notes are kept per ward and are visible only to staff assigned to that ward."

**Impact**: Confidentiality violation. Patient safety data is exposed to unauthorized staff.

---

### 4. Out-of-Scope Feature with Security Issues (BLOCKING)
**File**: `src/server.js`, lines 45-52
**Issue**: A `/api/password-reset` endpoint exists that sends mail to any email address, as often as it is called, with no rate limiting or verification. This is:
- Not in MVP scope ("Write a note, list notes for my ward, sign out")
- A mail-bomb vulnerability
- Exposes a mail() function that doesn't exist

**Impact**: Security risk, scope creep, architectural inconsistency.

---

## What Was Verified

✓ **Checked**: Server code architecture and security boundaries
✓ **Checked**: Client code completeness (found non-existent)
✓ **Checked**: Data persistence design (found violated)
✓ **Checked**: Authorization logic (found unauthorized access)
✓ **Not checked**: UI walkthrough (impossible without client code)
✓ **Not checked**: Visual design (no styles shipped)
✓ **Not checked**: Keyboard accessibility (no UI)
✓ **Not checked**: Network error handling (no UI to test)

## Why This Cannot Ship

The app fails on all three dimensions of the acceptance gate:

1. **Contract (PRODUCT.md)**: 
   - ✗ Primary job "A nurse can write a note...and read the previous shift's notes" is not achievable
   - ✗ MVP requirement violated: notes are lost on reboot
   - ✗ Security requirement violated: nurses can read other wards' notes

2. **Primary Path (ux-walkthrough.md)**:
   - ✗ Steps 1-3 cannot execute: no UI exists

3. **Code Audit**:
   - ✗ Authorization vulnerability allowing unauthorized data access
   - ✗ Data design violates persistence requirement
   - ✗ Out-of-scope features with unaddressed security issues

All three are necessary conditions for release. This product is not buildable from its current state.
