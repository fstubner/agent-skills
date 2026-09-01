# Release Verdict: **DO NOT SHIP**

## Critical Issues

### 1. Authorization Bypass in Ward Data Access
**Severity: CRITICAL SECURITY FLAW**  
**File: src/server.js, lines 28-33**

The `/api/notes` GET endpoint allows any signed-in user to read **any ward's notes** by specifying a `ward` query parameter:
```javascript
const ward = req.query.ward || who.ward;
```

This violates the explicit product requirement: "Notes are kept per ward and are visible only to staff assigned to that ward" (docs/handover.md). A nurse from Ward A can request `?ward=icu` to access ICU notes. The code even documents this flaw: "Any signed-in nurse can read any ward's notes by asking for it."

**Fix required:** Validate that the requested ward matches the user's assigned ward:
```javascript
const ward = req.query.ward;
if (ward && ward !== who.ward) {
  return res.status(403).json({ code: 'forbidden', message: 'Access denied' });
}
```

---

### 2. Client Application is Missing
**Severity: CRITICAL - PRODUCT IS INCOMPLETE**  
**File: public/index.html**

The entire client-side implementation is missing. `public/index.html` is an empty shell (`<main id="app"></main>`). There is no:
- Sign-in form
- Note list display
- Note composition UI
- Sign-out button
- Error/loading states
- No JavaScript to call the APIs
- No application of design tokens (colors, typography, tap targets)

This makes the product completely non-functional. Users cannot interact with the app.

---

### 3. Missing Sign-Out Endpoint
**Severity: CRITICAL - MVP INCOMPLETE**  
**File: src/server.js**

The UX walkthrough specifies: "Sign out. Returns to the sign-in form; the list is cleared." There is no `/api/session` DELETE endpoint or logout mechanism. Users cannot sign out, leaving sessions active indefinitely.

**Fix required:** Add:
```javascript
app.delete('/api/session', (req, res) => {
  if (!session(req)) return res.status(401).json({ code: 'no_session' });
  const sid = req.cookies.sid;
  store.sessions.delete(sid);
  res.clearCookie('sid');
  res.json({ ok: true });
});
```

---

### 4. Data Loss on Tablet Reboot
**Severity: CRITICAL - CONTRADICTS PRODUCT REQUIREMENT**  
**File: src/store.js, line 8**

The store clears all notes on every boot: `fs.writeFileSync(FILE, JSON.stringify({ notes: [] }))`. This contradicts the explicit requirement in docs/handover.md: "Nothing written at handover is lost between shifts."

The code comment even admits this: "A tablet reboot between shifts therefore discards the handover notes the previous shift wrote."

In a hospital ward environment, tablets are rebooted regularly. This makes the app unsuitable for its purpose—critical handover information would be lost.

**Fix required:** Persist notes across reboots. Load existing data instead of overwriting:
```javascript
if (!fs.existsSync(FILE)) {
  fs.writeFileSync(FILE, JSON.stringify({ notes: [] }));
}
```

---

## Moderate Issues

### 5. Incomplete Test Coverage
Only 1 test exists (for a trivial renderer). No tests for:
- Authorization boundaries
- Session management
- Note storage and retrieval
- Ward isolation

---

## Summary

The application is **fundamentally incomplete and unsafe**:
- ✗ Security vulnerability (ward access bypass)
- ✗ No client UI implementation
- ✗ Missing critical feature (sign-out)
- ✗ Data integrity broken (reboot clears notes)

**Status: Not ready for production. Significant work required before release is viable.**

### Verified Against
- Product scope and success criteria (PRODUCT.md)
- UX walkthrough requirements (ux-walkthrough.md)
- Architecture design (ARCHITECTURE.md)
- Design direction and accessibility needs (design-direction.md)
- Data persistence and privacy requirements (docs/handover.md)
- Code implementation (src/ and public/ directories)
