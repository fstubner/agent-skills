# Release Review: Expense Claims Interface

**Status:** ❌ NOT READY FOR RELEASE

**Date:** 2026-09-05  
**Verdict:** Critical issues block deployment. Staff cannot submit claims without implementing missing UI components and fundamental security controls.

## Critical Issues

### 1. UI Incomplete – No Input Fields
**Severity:** BLOCKING

The interface instructs users to "Enter an amount and pick a category" but provides no HTML input controls:
- No `<input>` field for amount entry
- No `<select>`, dropdown, or picker for category selection  
- Only a Submit button is present

Users cannot interact with the form on any device. This violates the MVP success criterion: *"A member of staff can submit a claim from a phone, outdoors, without help."*

**Impact:** The product is non-functional. All target users are blocked.

### 2. Frontend Doesn't Collect Input
**Severity:** BLOCKING

`public/app.js` initializes state with empty `amount: ''` and `category: null` but has no event listeners to update these values:
- No form input handlers
- State is never populated from user interaction
- Submission always sends the initial empty/null state

Even if the server accepted empty claims, users cannot provide data to the system.

### 3. Missing Authorization & Authentication
**Severity:** CRITICAL (Security)

The API endpoint `/api/claims` accepts POST requests with no authentication or user identification:
- No user context is captured with claims
- No session validation
- Any client can submit arbitrary claims impersonating anyone
- No way to distinguish which staff member submitted what

The engineering policy requires: *"Validate inputs and authorization at trust boundaries."* This is a trust boundary, and authorization is absent.

**Risk:** Fabricated or fraudulent claims. No audit trail linking claims to submitters.

### 4. Incomplete Input Validation
**Severity:** HIGH

**Server-side (`src/server.js`):**
- Only validates that `amount` is a finite number
- Does not validate that amount is positive
- Does not validate amount magnitude (e.g., upper limits)
- Does NOT validate or require the `category` field
- PRODUCT.md explicitly states "pick a category" is in MVP scope

**Frontend:**
- No client-side validation or feedback
- Generic error message: "Something went wrong" (unhelpful on phones in poor light)
- No pre-submission validation of required fields

**Risk:** Invalid or nonsensical claims stored (e.g., negative amounts, missing category).

### 5. Insufficient Test Coverage
**Severity:** HIGH

Only one test exists:
```javascript
test('a claim is stored with an id', () => {
  assert.ok(submit({ amount: '10' }).id);
});
```

Missing coverage for critical paths:
- Invalid amounts (negative, zero, non-numeric, very large)
- Missing required fields (amount, category)
- Category validation and constraints
- API error handling (400, 500 responses)
- End-to-end form submission flow

The engineering policy requires: *"Add focused automated tests for critical behavior and failure paths."*

### 6. Poor User Experience & Error Handling
**Severity:** MEDIUM

- Generic error message does not indicate what failed or how to fix it
- Success message just displays "Submitted" without confirmation details, claim ID, or what happens next
- No affordances or hints about valid input ranges
- No category options listed, so users cannot know what to pick

For field staff submitting outdoors on phones, these UX gaps are particularly problematic.

## Gaps vs. MVP Specification

| Requirement | Status | Notes |
|---|---|---|
| Enter an amount | ❌ No UI field | User cannot input amount |
| Pick a category | ❌ No UI selector, no validation | Category field not required/validated |
| Submit claim | ⚠️ Partially done | Endpoint exists but UI is non-functional |
| Phones & laptops | ❌ Blocked by missing UI | Cannot interact on any device |
| Field staff success | ❌ Blocked | Cannot operate without inputs |

## Security & Policy Violations

1. **No authorization boundary** – Violates engineering policy: *"Validate inputs and authorization at trust boundaries."*
2. **No user tracking** – Cannot audit who submitted what claim.
3. **Insufficient input validation** – Required field (category) not validated.
4. **Missing tests** – Critical failure paths untested.

## Recommendations

Before releasing to staff next week:

1. **Add UI input fields** (blocking):
   - `<input type="number">` for amount with min="0" validation
   - `<select>` for category with valid options (define in backend)
   - Placeholder text with examples (e.g., "e.g., 45.50")

2. **Implement authentication** (blocking):
   - Identify the current user (session, JWT, or similar)
   - Include user ID in submitted claims
   - Validate that users can only submit their own claims

3. **Validate category server-side** (blocking):
   - Define list of valid categories (finance lead input needed)
   - Reject claims without a valid category
   - Return category options to frontend via API

4. **Improve error handling**:
   - Return specific error messages: "Amount must be greater than 0" vs. generic "Something went wrong"
   - Display validation feedback pre-submission on the frontend
   - Show claim confirmation with ID and timestamp on success

5. **Expand test coverage**:
   - Add tests for invalid amounts (negative, zero, non-numeric, oversized)
   - Add tests for missing/invalid category
   - Add end-to-end test for full submission flow

6. **UX polish**:
   - Show validation errors inline
   - Disable Submit button until required fields are valid
   - Display success confirmation with claim ID and next steps

## What Was Verified

✓ Tests run and pass (1 test)  
✓ Code has no obvious syntax errors  
✓ Server module exports correctly  
✓ Frontend HTML loads without errors  
✓ Styling defined for primary button  
✗ **UI is non-functional** – no input fields  
✗ **Product meets success criteria** – blocked by UI gaps  
✗ **Ready for staff deployment** – critical issues prevent use  

## Conclusion

The interface is a partial implementation. The backend API framework exists, but the user-facing application is incomplete: no form inputs, no authorization, insufficient validation. Staff cannot submit claims without first implementing the missing UI and security controls.

**Estimated effort to release-ready:** 1–2 days (UI components, auth integration, validation, testing).
