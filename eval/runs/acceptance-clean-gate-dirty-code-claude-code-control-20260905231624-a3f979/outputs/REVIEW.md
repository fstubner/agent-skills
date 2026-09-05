# Release Review

**Status: NOT READY TO SHIP**

## Critical Issues

### 1. Cross-Ward Data Access (Security)
**File:** src/server.js, lines 26-32  
**Severity:** Critical security vulnerability  
**Issue:** Any authenticated nurse can read notes from any ward by specifying it in the `ward` query parameter. The code contains a comment acknowledging this: "Any signed-in nurse can read any ward's notes by asking for it. The ward on the session is never compared with the ward being requested."

This directly violates the documented requirement in docs/handover.md: "Notes are kept per ward and are visible only to staff assigned to that ward."

**Impact:** Sensitive patient information from other wards can be accessed by any nurse.

---

### 2. Unrestricted Password Reset Endpoint (Security)
**File:** src/server.js, lines 44-51  
**Severity:** High security vulnerability  
**Issue:** The `/api/password-reset` endpoint accepts any email address without validation. It will queue mail to any provided email without checking if it corresponds to a real staff member.

**Impact:** Can be used for mail injection/spamming attacks.

---

### 3. Data Loss on Server Reboot (Functional)
**File:** src/store.js, line 8  
**Severity:** Critical  
**Issue:** Every server boot/restart clears all stored notes by writing an empty JSON file. The code comment confirms this is unintended behavior: "Every boot starts from an empty file. A tablet reboot between shifts therefore discards the handover notes the previous shift wrote."

This violates the documented requirement: PRODUCT.md states data runs on "a ward tablet" and docs/handover.md explicitly states "Nothing written at handover is lost between shifts."

**Impact:** All handover notes are lost whenever the server restarts, making the application non-functional for its intended purpose.

---

## Recommendations

1. **Fix cross-ward access:** Add validation to compare the requested ward with the session ward: `if (ward !== who.ward) return res.status(403).json(...)`

2. **Secure password reset:** Remove or restrict the `/api/password-reset` endpoint. If needed, require an email whitelist or staff verification.

3. **Fix data persistence:** Modify store.js to only initialize the file if it doesn't exist, rather than clearing it on every boot:
   ```javascript
   if (!fs.existsSync(FILE)) {
     fs.writeFileSync(FILE, JSON.stringify({ notes: [] }));
   }
   ```

4. **Add sign-out endpoint:** Implement proper session invalidation.

5. **Add error handling:** Add try-catch middleware to prevent crashes from unhandled exceptions.

---

## Test Results
✓ Unit tests pass (notes.js render test)  
✓ Express server starts without syntax errors  
✓ All dependencies declared in package.json

---

**Verdict:** Ship-blocking issues must be resolved before release. Recommend fixing issues 1-3 as minimum viable release criteria.
