# Release Review: Expense Claims Interface

**Status: DO NOT RELEASE** ❌

## Critical Issues

### 1. UI is Incomplete - Blocks Core Functionality
**Severity: Critical**

The HTML template has no form inputs. Users cannot complete the primary task.

- `public/index.html` contains only a submit button and a hint
- No `<input>` field for amount entry
- No `<select>` or category picker for category selection
- The hint says "Enter an amount and pick a category" but provides no way to do either

**Impact:** Staff cannot submit expense claims. The interface is non-functional.

### 2. Frontend State Disconnected from UI
**Severity: Critical**

`public/app.js` initializes `state.amount` and `state.category` but:
- No input fields to set these values
- No event listeners to capture user input
- Submit button will always send empty/null values to the server

**Impact:** Even if users knew what to do, submissions would fail silently.

### 3. Missing Category Validation & Definition
**Severity: High**

- Server (`src/server.js`) validates amount but not category
- No list of valid categories defined or documented
- No category picker implemented in UI
- Server accepts any category value without checking validity

**Impact:** Inconsistent data submission. Finance cannot rely on standardized categories.

### 4. Inadequate Error Feedback
**Severity: High**

Error handling is vague:
- UI shows "Something went wrong" on any 4xx/5xx response
- No distinction between missing amount and other errors
- No guidance for field staff on a phone in poor light

**Impact:** Users cannot diagnose problems. Field staff in poor conditions will be confused.

### 5. Fails Product Success Criterion
**Severity: Critical**

Product spec: *"A member of staff can submit a claim from a phone, outdoors, without help."*

The interface does not meet this:
- No visible form labels for accessibility
- No obvious way to enter data
- Error messages are unhelpful
- Navigation unclear on a phone interface

## Required Before Release

1. **Add form inputs to HTML:**
   - Text input for amount with visible label
   - Select dropdown or button group for category with visible label

2. **Wire frontend state to inputs:**
   - Add event listeners to update `state.amount` and `state.category`
   - Validate inputs before submission (amount must be a positive number, category must be selected)

3. **Define and validate categories:**
   - Document valid category list
   - Add category validation to server
   - Provide category picker in UI

4. **Improve error handling:**
   - Show specific error messages (e.g., "Amount is required")
   - Add success confirmation with claim ID
   - Ensure text is readable on a phone in sunlight

5. **Test on a phone:**
   - Verify the form is usable on a mobile browser
   - Test in poor lighting conditions per product requirements

## Summary

The interface is structurally incomplete. No form inputs exist for the core required fields (amount and category). This is a non-functional prototype, not a release-ready product. Finance staff cannot use this next week without implementation work.
