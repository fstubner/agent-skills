# Release Review: Expense Claims Interface

**Status: NOT READY FOR RELEASE**

**Review Date:** 2026-09-02  
**Verdict:** Reject—product fails core MVP requirements and cannot be used by staff.

---

## Critical Blockers

### 1. UI Missing Input Fields (BLOCKER)
**Severity:** Critical | **Files:** `public/index.html`, `public/app.js`

The HTML specifies "Enter an amount and pick a category" but provides **no input fields**. The interface consists only of a submit button.

- `index.html` line 5: Hint text exists; no `<input>` or `<select>` elements follow
- `app.js` lines 1-2: State object references `amount` and `category` but these are never read from DOM
- Result: Submitting always sends `{ amount: '', category: null }`

**Impact:** Users cannot submit any claim. The success criterion ("A member of staff can submit a claim from a phone, outdoors, without help") cannot be met.

---

### 2. Server Rejects All Submissions
**Severity:** Critical | **Files:** `src/server.js`

The API endpoint validates amount as a finite number (line 9):
```javascript
if (!Number.isFinite(Number(req.body?.amount))) return res.status(400).json({ error: 'amount required' });
```

Since the UI sends `amount: ''` (empty string), this converts to `NaN`, and all requests are rejected with a 400 error. The client displays "Something went wrong" (line 9, `app.js`), providing no actionable feedback to field staff.

**Impact:** 0% submission success rate.

---

### 3. No Category Validation
**Severity:** High | **Files:** `src/server.js`, `src/claims.js`

- No list of valid categories is defined
- No validation of the category field in the API
- `claims.js` accepts any category without checking

**Impact:** Backend accepts invalid data; no way to enforce business rules for expense types.

---

### 4. Mobile UX Violates Requirements
**Severity:** High | **Files:** `public/styles.css`, `public/index.html`

The button styling is unsuitable for field staff in poor light:
- Padding: 6px 10px (very small)
- Font size: 13px (too small for outdoor/poor-light use)
- Border radius: 4px (reduces touch target)

**PRODUCT.md** explicitly states users include "field staff who submit on a phone in poor light."

**Impact:** Even if input fields existed, field staff could not reliably tap the submit button.

---

### 5. In-Memory Data Loss
**Severity:** Medium | **Files:** `src/claims.js`

All claims are stored in a process-level array:
```javascript
const claims = [];
```

Server restart loses all data. Finance staff expecting data persistence will discover lost claims without warning.

**Impact:** Production unreliability; trust damage.

---

## Medium Issues

### Missing Error Feedback
- User receives only "Something went wrong" for validation failures
- Field staff in poor light cannot diagnose problems (wrong amount format? missing category?)
- Suggest: Display field-specific error messages inline

### Insufficient Test Coverage
- `test/claims.test.js` has only one test
- No endpoint tests; no category validation tests; no mobile UX tests
- 100% of the critical path is untested

---

## Requirements Traceability

| PRODUCT.md Requirement | Status | Evidence |
|---|---|---|
| "Enter an amount, pick a category, submit" | ❌ FAIL | No amount/category inputs in HTML |
| "submit a claim from a phone" | ❌ FAIL | UI button too small; no inputs for phone entry |
| "outdoors, without help" | ❌ FAIL | Cannot see or interact with current UI in poor light |
| "No approval, receipts, payment" | ✅ PASS | Not in scope; correctly omitted |

---

## Recommendation

**Do not release.** The product is non-functional:
1. Add amount and category input fields to `index.html`
2. Wire inputs to `state` object in `app.js` (on change, update `state.amount`/`state.category`)
3. Define valid categories and validate server-side
4. Increase button size and touch targets for mobile/outdoors use (min 40px × 40px)
5. Add field-level error messages to the UI
6. Add tests for the submit endpoint and category validation
7. Replace in-memory storage with persistent data (file, DB, or async queue)
8. Test on a phone in realistic outdoor lighting before release

**Re-submit for review once the UI is functional and tested.**
