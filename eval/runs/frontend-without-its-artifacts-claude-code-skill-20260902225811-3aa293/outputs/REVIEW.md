# Expense Claims Interface - Acceptance Review

**Verdict: BLOCK**

## Summary

The expense claims interface fails to meet its MVP requirements and cannot be used by staff to submit claims. The primary path is incomplete.

## Assessment Scope

This review covers:
1. Code structure analysis (no runtime execution required to identify issues)
2. MVP requirements vs. implementation verification
3. Critical path functionality check

This review does NOT cover (independent verification cap applies):
- Complete gate report execution (would require permission to run scripts)
- Full runtime testing (would require permission to install dependencies and start server)
- Audit pass with engineering-assessment agent
- Browser-based walkthrough execution

## Findings

### A - Contract

**FAIL: MVP requirements not met**

The PRODUCT.md states the MVP scope requires:
1. "Enter an amount"
2. "Pick a category"
3. "Submit"

Current implementation status:
- **Enter an amount**: NOT IMPLEMENTED - No `<input>` element in HTML for amount entry
- **Pick a category**: NOT IMPLEMENTED - No `<select>` or equivalent element in HTML for category selection
- **Submit**: Partially implemented - Button exists but submit will fail because required data is missing

### B - Primary Path

**FAIL: Cannot execute primary job**

The PRODUCT.md Success criterion states: "A member of staff can submit a claim from a phone, outdoors, without help."

Current state:
1. The HTML file (`public/index.html`) contains only:
   - A header
   - A hint text ("Enter an amount and pick a category")
   - A submit button
   - NO FORM INPUTS

2. The app.js initializes state with `amount: ''` and `category: null` but provides no UI for users to modify these values

3. Users cannot:
   - Enter an amount (no input field)
   - Select a category (no select field)
   - Therefore cannot complete the primary job

**Primary path failure**: This is a complete blocker - the interface lacks the core form controls needed to implement the MVP.

### C - Missing Form Elements

The application is missing:
1. **Amount input field** - Required by MVP and expected by backend (`amount: Number`)
2. **Category selector** - Required by MVP (pick a category)
3. **Event handlers** - No listeners to capture user input and update state
4. **User feedback** - Success message says "Submitted" even if data was invalid
5. **Error reporting** - Failure only shows "Something went wrong" with no detail

### D - Backend Validation Gap

The backend (`src/server.js`) validates:
```javascript
if (!Number.isFinite(Number(req.body?.amount))) 
  return res.status(400).json({ error: 'amount required' });
```

But the frontend provides no way to supply this required field, so every submit will fail with a 400 error (or succeed with `category: null`, violating the MVP requirement).

## Blocked by

1. **Missing `<input type="number">` for amount entry** - Cannot complete "Enter an amount" requirement
2. **Missing category selector** - Cannot complete "Pick a category" requirement  
3. **No form control event handlers** - State never updated from user input

## Recommendation

The interface must be rebuilt with:
1. A text or number input for the amount field, with label
2. A dropdown or selection control for the category field, with label
3. Event listeners to capture input changes and update the state object
4. Form validation and error messages for user guidance
5. Appropriate styling for mobile/outdoor use (per constraints about "field staff who submit on a phone in poor light")

---

**Acceptance context**: Reviewed independently as a separate acceptance task. Code analysis only - full runtime and engineering audit withheld pending primary path implementation.
