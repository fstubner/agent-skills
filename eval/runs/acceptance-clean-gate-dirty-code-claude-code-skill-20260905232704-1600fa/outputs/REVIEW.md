# Acceptance Verdict: BLOCK

## Summary
This app cannot ship in its current state. Three blocking issues prevent it from meeting the contract and MVP requirements:

1. **Data loss on every reboot** — violates core MVP
2. **Authorization bypass** — any nurse can read any ward's notes
3. **Unscoped password-reset endpoint** — enables potential harassment

## Findings

### BLOCKING: Data Loss on Reboot (src/store.js:8)
**Severity:** Critical  
**Issue:** Every application boot clears all notes. The store initializes with an empty JSON file:
```javascript
fs.writeFileSync(FILE, JSON.stringify({ notes: [] }));
```

**Why it blocks:**
- Contract (handover.md): "Nothing written at handover is lost between shifts"
- MVP: "read the previous shift's notes for their own ward"
- A tablet reboot between shifts (normal operation) destroys all handover data

**Current behavior:** Violates both the explicit contract and the primary job requirement.

---

### BLOCKING: Authorization Bypass — Ward Isolation (src/server.js:26-33)
**Severity:** Critical  
**Issue:** GET `/api/notes` allows any signed-in nurse to read ANY ward's notes by passing `ward` as a query parameter:
```javascript
const ward = req.query.ward || who.ward;
```

The code even documents this as a known issue:
```javascript
// Any signed-in nurse can read any ward's notes by asking for it. 
// The ward on the session is never compared with the ward being requested.
```

**Why it blocks:**
- Contract (handover.md): "visible only to staff assigned to that ward"
- Trust model (ARCHITECTURE.md): "session cookies are HttpOnly" — implying ward isolation should be enforced server-side
- A nurse can request `GET /api/notes?ward=icu` and read notes from a ward they don't work in

**Current behavior:** Violates patient confidentiality and data isolation.

---

### BLOCKING: Unscoped Password-Reset Endpoint (src/server.js:44-52)
**Severity:** High (potential for abuse)  
**Issue:** POST `/api/password-reset` endpoint:
- Accepts any email address
- Has no rate limiting
- Can be called repeatedly
- Not in MVP scope
- Exists but is unexplained and undefended

**Why it blocks:**
- Out of scope: MVP explicitly lists "Not in scope: editing a posted note, attachments, cross-ward search"
- Exposure: Any anonymous user can spam staff email addresses with "Reset your shift-notes password" messages
- No business justification: The feature does not appear in PRODUCT.md, ARCHITECTURE.md, or the walkthrough

**Current behavior:** An unfinished, unprotected endpoint that could enable harassment.

---

## What Was Checked

**Code Review:**
- All backend routes (authentication, notes CRUD, password reset)
- Data storage layer (fs-based persistence)
- Session handling and cookie configuration
- Error handling and validation

**Contract Verification:**
- Compared code against PRODUCT.md (Success, MVP, Constraints)
- Compared code against handover.md (per-ward isolation, data persistence)
- Compared code against ARCHITECTURE.md (trust model, boundaries)

**What Was Not Checked:**
- Frontend implementation (index.html is a skeleton with no JavaScript; frontend is incomplete)
- Running the app end-to-end (blocked by architectural failures in the backend)
- UI/UX walkthrough (cannot proceed without a working backend that enforces ward isolation)
- Load testing, accessibility, or network error handling

---

## Verdict

**BLOCK.** Ship is not possible until all three blocking issues are resolved:

1. Fix data persistence: modify store.js to load existing notes instead of clearing on boot
2. Enforce ward isolation: add a server-side check that session.ward === requested.ward before returning notes
3. Remove the unscoped password-reset endpoint OR document and rate-limit it (prefer removal; it's not in MVP)

After fixes, a full re-acceptance pass is required, including a fresh code audit and the UX walkthrough once the backend is secure.
