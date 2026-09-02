# Expense Claims Review — Release Verdict

**Status: NOT READY**

## Summary
The interface is incomplete and non-functional. Users cannot submit claims because the form has no input fields for amount or category. This blocks the MVP requirement ("Enter an amount, pick a category, submit").

## Critical Issues

### 1. Missing form inputs
- **Impact:** No way to enter data
- **Location:** public/index.html
- HTML shows instruction "Enter an amount and pick a category" but provides zero input fields
- app.js initializes `state = { amount: '', category: null }` but never binds form inputs to state
- Users clicking submit will POST empty values

### 2. Form state never updated from user input
- **Impact:** Claims submitted with default null/empty values
- **Location:** public/app.js (lines 1–2)
- No event listeners on hypothetical input fields
- No mechanism to capture user-entered amount or category
- State is dead code

### 3. Category not validated at backend
- **Impact:** Invalid/missing categories accepted silently
- **Location:** src/server.js (line 9)
- Only `amount` is validated (must be finite number)
- `category` field is not checked; accepts null, undefined, or any string
- No validation that category is one of a valid set

### 4. No data persistence
- **Impact:** All claims lost when server restarts
- **Location:** src/claims.js (line 1)
- In-memory array only; no database or file storage
- Incompatible with production use by finance team
- Note: May be acceptable for MVP if documented as temporary, but not mentioned

## Major Issues

### 5. No field-specific error messages
- **Impact:** Users cannot understand what failed
- **Location:** public/app.js (line 9)
- Generic "Something went wrong" on any HTTP failure
- No indication if amount was invalid, category missing, or network error
- Blocks mobile users from self-serving

### 6. Insufficient test coverage
- **Location:** test/claims.test.js
- Only one test: checks that returned claim has an ID
- No tests for: form validation, missing category, invalid amount, submission flow
- No integration tests

### 7. No category selector UI
- **Impact:** Instructions promise category selection, interface does not deliver
- PRODUCT.md requirement: "pick a category"
- No dropdown, radio buttons, or checkboxes in HTML
- No list of valid categories defined anywhere

## Recommendations

To reach production readiness before next week, add:

1. **Form inputs in HTML**
   - `<input id="amount">` with type, placeholder, label
   - Category selector (dropdown or radio group) with valid options
   - Bind state changes to input events

2. **Backend validation**
   - Validate `category` is in a pre-defined allowed set
   - Return field-specific error messages (e.g., `{ error: 'category required' }`)

3. **User feedback**
   - Show validation errors next to fields
   - Distinguish network errors from validation errors
   - Confirm submission with claim ID

4. **Data persistence**
   - Add database (SQLite, PostgreSQL) or file storage
   - Or document the in-memory limitation and defer to v2

5. **Testing**
   - Add tests for form validation
   - Test missing/invalid category
   - Test mobile touch interactions if possible

6. **Mobile usability**
   - Test on actual phone (poor light, outdoor conditions per PRODUCT.md)
   - Ensure touch targets are 44px+ (current button is 6px padding)
   - Test form input focusing on mobile

## Blocking Assumptions

- What are valid categories? (Not defined; backend accepts anything)
- Should claims be persisted? (In-memory only; unclear if intentional)
- What should happen after successful submit? (Page says "Submitted" but no next step)

## Verified
- Code review of all source files (server.js, claims.js, app.js, index.html, styles.css)
- No executable tests run (require approval)
- No server execution attempted (require approval)
