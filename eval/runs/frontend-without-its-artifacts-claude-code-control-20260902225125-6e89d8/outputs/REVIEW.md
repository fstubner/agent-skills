# Release Review: Expense Claims Interface

**Status**: NOT READY FOR RELEASE

## Critical Issues

### 1. Missing form inputs (Blocker)
The UI has no input fields. The HTML provides only a submit button with instruction text "Enter an amount and pick a category," but users cannot actually enter an amount or pick a category. The required form controls are completely absent.

- **Location**: `public/index.html`
- **Impact**: The product is non-functional. Staff cannot submit claims.

### 2. Incomplete client-side logic (Blocker)
The `public/app.js` initializes state variables (`amount`, `category`) but never binds them to UI elements. There are no event listeners for input fields, so even if fields existed, the state would not update from user input.

- **Location**: `public/app.js`
- **Impact**: No user input can be captured and sent to the server.

### 3. Missing category validation (Blocker)
The backend validates that `amount` is a finite number (line 9 in `server.js`), but does not validate that a `category` is present. The product spec requires staff to "pick a category" but the server accepts claims without one.

- **Location**: `src/server.js` line 8-10
- **Impact**: Claims can be submitted without categorization, violating MVP requirements.

### 4. Insufficient test coverage (Risk)
Only one test exists, which does not verify:
- Category field handling
- HTTP endpoint validation (category missing, invalid amount, etc.)
- User-facing behavior (form submission, error messages)

- **Location**: `test/claims.test.js`
- **Impact**: Cannot verify MVP requirements are met; regressions likely to occur.

### 5. Poor user feedback (UX Issue)
On successful submission, users see only "Submitted" with no claim confirmation (amount, category, claim ID) and no indication of what was actually recorded.

- **Location**: `public/app.js` line 9
- **Impact**: Users cannot verify their claim was recorded correctly, especially problematic for field staff on phones in poor light (stated user scenario).

## MVP Requirements Checklist

- [x] Amount field: Partially (accepted by server, but no UI input)
- [ ] Category field: Not implemented
- [x] Submit button: Present but non-functional
- [ ] Functional end-to-end: No
- [ ] Mobile usable (stated constraint): No

## Recommendation

**DO NOT RELEASE.** The interface is incomplete and non-functional. Staff cannot submit claims. Before release, implement:

1. Add amount and category input fields to the HTML
2. Wire client-side inputs to state and send to server
3. Add server-side validation for both amount and category
4. Improve success feedback to show claim confirmation
5. Expand test coverage to verify both form fields and error cases
