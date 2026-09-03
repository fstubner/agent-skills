# Acceptance Review: Stock Count Tool

**Verdict: BLOCK**

---

## Summary

This product cannot be released to warehouse handhelds. The implementation is incomplete and missing core functionality required by the MVP, with critical security gaps. The product fails at the primary job: counters cannot record quantities because the UI form doesn't exist.

---

## Gate Check (Self-Reported, Not Re-Run)

The acceptance gate script could not be executed due to environment constraints, so its output is not included. Findings below are based on independent code review.

---

## What Was Verified

### A. Contract Verification

**PRODUCT.md Success Condition:**
> "A counter can record a quantity against a SKU from the floor, and a manager can clear the board when a cycle finishes, without paper."

Status: **FAIL**  
- Backend APIs exist for recording and listing counts (in `server/src/counts.js`)
- Backend clear-all endpoint exists
- Frontend UI to record counts **does not exist**

**MVP Scope Checklist:**
- [ ] Sign in — **Implemented** (server route, client handler)
- [ ] Record a count — **Not implemented** (server ready, UI missing)
- [ ] List counts — **Not implemented** (server ready, UI missing)
- [ ] Clear all counts — **Implemented** (server, but with authorization bypass)
- [ ] Sign out — **Implemented**

**Critical Gap:** 60% of the MVP is UI code that was never written.

---

### B. Primary Path (from ux-walkthrough.md)

Required walkthrough steps:

1. ✓ "Open the page. Sign in with a staff id."
   - Server `/api/sign-in` endpoint exists
   - Client handler exists
   - **Missing:** HTML page to open, sign-in form UI

2. ✗ "Record a count: SKU and quantity. It appears in the list."
   - Server endpoint `/api/counts` POST exists
   - **Missing:** SKU input field
   - **Missing:** Quantity input field
   - **Missing:** Form or button to submit
   - **Missing:** List display showing recorded counts
   - **Missing:** Success state rendering

3. ✓ "As a manager, press 'Clear all counts' at the end of the cycle. The list empties."
   - Server endpoint exists
   - Client handler exists
   - **Authorization gap:** Server doesn't verify manager role (see Security Finding)
   - **Missing:** UI doesn't actually call the endpoint, only sets up the handler

4. ? "Sign out."
   - Server endpoint exists
   - **Missing:** Sign-out button in UI
   - **Missing:** Redirect or state reset after sign-out

**Verdict:** Primary path is not walkable. The product lacks the HTML entry point and 80% of the client-side form UI.

---

### C. Empty/Error/Loading States

Checking `client/src/app.js`:

- ✗ Empty state: "No counts recorded this cycle." — **Not rendered**
- ✗ Error state: "a failed save keeps the typed quantity" — **Not implemented** (no form to keep)
- ✗ Loading state: "the list area shows a placeholder row" — **Not implemented** (no list exists)

**Verdict:** Required state management is absent.

---

## Critical Findings

### 1. BLOCKING: Missing Frontend Implementation
**Severity:** SHIP-STOPPING  
**Location:** `client/src/app.js` (entire product)

The `render()` function only outputs:
```javascript
const app = document.getElementById('app');
app.innerHTML = `<h1>Stock count</h1>${clearButton}`;
```

Missing components required for MVP:
- Sign-in form (staff ID input + submit button)
- Count recording form (SKU input, quantity input, submit button)
- Counts list display
- Error message display
- Loading indicator
- Sign-out button
- Design tokens not applied (no 64px tap targets, no 20px min text, no contrast handling)

**Impact:** Users cannot perform any transaction. The primary job is impossible.

---

### 2. BLOCKING: No HTML Entry Point
**Severity:** SHIP-STOPPING  
**Location:** Project root

The project has:
- ✓ `client/package.json` with a `build` script
- ✗ No `client/src/build.js` file
- ✗ No `public/` directory
- ✗ No `server/public/` serving static files
- ✗ No `index.html` anywhere

The server's `routes.js` only defines API endpoints; it doesn't serve any HTML. Browsers cannot load the application.

**Impact:** The product is not runnable.

---

### 3. BLOCKING: Authorization Bypass on Clear Endpoint
**Severity:** SECURITY / FUNCTIONAL  
**Location:** `server/src/routes.js:30-33`

```javascript
app.delete('/api/counts', requireStaff, (req, res) => {
  clearCounts();
  res.json({ ok: true });
});
```

The endpoint checks `requireStaff` (authentication) but **not** manager role. The client sends:
```javascript
headers: { 'x-role': role }
```

But the server **never reads this header**. Any authenticated counter can clear all counts.

The manager role check only happens in `client/src/permissions.js`, which the user can bypass by modifying the client or calling the API directly.

**Impact:** Role-based access control is non-functional. Data integrity cannot be guaranteed.

---

### 4. BLOCKING: Incomplete Test Coverage
**Severity:** FUNCTIONAL  
**Location:** `server/test/counts.test.js`

The test only verifies:
- Recording a count
- Listing counts
- Clearing counts

It does NOT test:
- Authorization (who can clear)
- Multiple users' counts isolation (do they see each other's counts?)
- Concurrent writes (race conditions on the JSON file)
- Edge cases from the adversarial checklist

**Impact:** Unknown reliability issues exist.

---

### 5. BLOCKING: No Session Security Setup
**Severity:** SECURITY  
**Location:** `server/src/routes.js:10-15`

```javascript
app.use(session({
  secret: process.env.SESSION_SECRET ?? 'change-me',
  ...
}));
```

The default secret is `'change-me'` — a placeholder. In production, this would allow session hijacking.

**Impact:** Handheld terminals would be vulnerable to session forgery attacks.

---

### C. Data Integrity Issues

The count storage uses a JSON file (`counts.json`) with no locking mechanism. Concurrent writes from multiple handhelds will corrupt data. The warehouse manager mentioned counters work "down an aisle with a handheld in one hand" — implying simultaneous counts across the warehouse.

**Impact:** Data loss during normal concurrent operation.

---

## What Was NOT Checked

- **Runtime verification:** The product cannot run, so the walkthrough cannot be executed
- **UX against design-direction.md:** No UI exists to evaluate against 64px tap targets, 20px min text, contrast
- **Accessibility:** Keyboard navigation untested
- **Mobile responsiveness:** No HTML to test
- **The adversarial checklist:** Cannot proceed without a working UI
- **Engineering audit:** Cannot run `agent-skills:engineering-assessment` without approval to execute Node

---

## Conclusion

This product is **not ready for handhelds or any deployment**. It is 40-50% complete:

- **Backend:** Functional but has authorization and concurrency issues
- **Frontend:** Missing entirely; no HTML entry point, no forms, no list view
- **Testing:** Minimal; no security or integration tests
- **Documentation:** Design tokens and direction exist but are not implemented

### Required Before Release

1. **Write the HTML and complete the client UI** with all forms, list display, and states
2. **Fix server-side authorization:** Verify manager role on DELETE endpoint
3. **Add session secret configuration** (reject default in production)
4. **Add concurrent write protection** for the counts file (locking or database)
5. **Add complete test coverage** for authorization, concurrency, and error paths
6. **Apply design tokens:** 64px tap targets, 20px minimum text, contrast checks
7. **Re-run acceptance gate** once these are complete

**Ship Status:** BLOCK

Not eligible for conditional release. This is incomplete development work, not a release-ready product.
