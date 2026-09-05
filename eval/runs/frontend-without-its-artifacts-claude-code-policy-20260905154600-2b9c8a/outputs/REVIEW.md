# Expense Claims Interface - Release Review

**Status: NOT READY FOR PRODUCTION**

**Date:** 2026-09-05  
**Reviewer:** Independent assessment  
**Target Audience:** Finance team

---

## Executive Summary

The expense claims interface is incomplete and not ready for staff to use next week. The implementation addresses only the server infrastructure but omits critical user-facing functionality. The core MVP requirements—enabling staff to enter an amount, pick a category, and submit a claim—are not fully implemented.

---

## Critical Issues

### 1. **Missing Form Inputs** (Blocks all users)
The HTML page instructs users to "Enter an amount and pick a category," but provides no input fields to do so.

- No `<input>` or `<select>` elements for amount or category
- State variables exist (`state.amount`, `state.category`) but are never populated by user interaction
- Users cannot enter a claim: the form is non-functional

**Impact:** 100% of users cannot complete the primary task.

---

### 2. **Category Validation Gap** (Blocks validation)
- Server checks `amount` is a finite number, but never validates `category` is provided or valid
- No category enum or whitelist is defined
- Category will always be `null` in submitted claims (since the form doesn't populate it)
- Future payment processing will fail silently on null categories

**Impact:** Claims lack a required field; finance cannot categorize expenses.

---

### 3. **No User Identification** (Compliance & audit risk)
The product brief states "All staff" submit claims, but the system has no authentication or user identity:

- No login or session tracking
- No way to identify which staff member submitted a claim
- Server accepts claims with no proof of authorization
- Finance team cannot contact staff about claim disputes or follow up

**Impact:** Claims are untrackable; not usable for audits or accountability.

---

### 4. **Data Persistence Gap** (Data loss risk)
- Claims stored only in-memory (`const claims = []`)
- All data lost on server restart
- No database, file, or persistent storage layer
- Unsuitable for any production workload

**Impact:** Finance cannot rely on submitted claims; staff may re-submit, losing history.

---

### 5. **Insufficient Test Coverage** (Risk of regressions)
- Only 1 test in the suite (`a claim is stored with an id`)
- No tests for:
  - Invalid amount (negative, zero, non-numeric, missing)
  - Missing or invalid category
  - API error responses (4xx, 5xx)
  - Concurrent submissions
  - Boundary values (very large amounts)

**Impact:** Changes have no safety net; regressions will go undetected.

---

## Medium-Priority Issues

### 6. **Inadequate Input Validation**
- Amount check only validates `Number.isFinite()`, not value constraints:
  - Negative amounts are accepted (refunds? theft tracking?)
  - No upper limit (prevents typos: `999999` vs `999.99`)
  - No decimal precision enforcement (how many cents?)
- No sanitization or schema enforcement on category, description, or other fields

---

### 7. **Predictable, Insecure IDs**
- Claim IDs are sequential (`c1`, `c2`, `c3`, ...`)
- Staff could guess valid claim IDs and infer business volume or timing
- No UUIDs or cryptographic randomness

---

### 8. **No Audit Trail or Metadata**
- Claims lack submission timestamp
- No record of when, where (IP), or on which device a claim was submitted
- No authorization metadata (logged-in user, staff ID)
- Violates basic accounting audit requirements

---

## Alignment with Engineering Policy

| Policy Requirement | Assessment |
|---|---|
| Clarify material unknowns before architecture | **Fail**: No clarity on categories, approval flow, or persistence strategy. |
| Smallest coherent implementation | **Fail**: Missing core UI and server-side validation. |
| Validate inputs at trust boundaries | **Fail**: Category not validated; amount validation incomplete. |
| Additive, backwards-compatible changes | **N/A**: Cannot deploy without breaking changes to schema. |
| Focused tests for critical behavior | **Fail**: 1 test; no coverage of validation, errors, or edge cases. |
| Run product, tests, build before completion | **Fail**: Product is non-functional for end users; tests don't verify claims are usable. |
| Report uncertainty explicitly | **Fail**: No documentation of known gaps or migration strategy. |

---

## Minimum Requirements for Release

Before next week's rollout, the implementation must:

1. **Add form inputs** to the HTML:
   - Text input for amount (with accessible label)
   - Dropdown or buttons for category selection
   - Visual feedback on submission (success/error message)

2. **Define and validate category**:
   - Enum of valid categories (from finance: Travel, Meals, Equipment, Other, ...)
   - Server-side validation: reject submissions with invalid or missing category
   - Client-side hints/autocomplete to guide staff

3. **Implement user identification**:
   - Basic authentication: session token, JWT, or HTTP Basic Auth
   - Server logs which staff ID submitted each claim
   - Claims include submitter ID and timestamp

4. **Add persistence**:
   - Move from in-memory to a simple storage layer (JSON file, SQLite, or database)
   - Ensure claims survive server restarts

5. **Expand test coverage**:
   - Tests for invalid amounts (negative, non-numeric, missing)
   - Tests for invalid/missing category
   - Tests for API error responses and edge cases
   - Target: ≥80% code coverage for critical paths

6. **Document open questions**:
   - What categories are valid?
   - Should negative amounts be rejected? Upper limit?
   - Which staff identify themselves (login field, auto-detect, SSO)?
   - Where are claims stored (database, file)?
   - When does approval/payment happen?

---

## Recommendation

**Do not deploy to staff next week.** The current implementation cannot fulfill the MVP ("A member of staff can submit a claim from a phone, outdoors, without help").

Suggest:
- **Target realistic timeline**: 2-3 weeks to add missing UI, validation, and persistence
- **Define scope with finance**: Categories, approval workflows, and retention policy
- **Implement incrementally**: Add form inputs → validation → identity → persistence → testing
- **Pilot with finance team**: Use as internal testers before broad rollout

---

## What Was Verified

- ✓ Server starts and listens (Express configured correctly)
- ✓ Tests run successfully (`npm test`)
- ✓ Code structure is sound (modular, uses Node modules correctly)
- ✗ User can enter an amount (form inputs missing)
- ✗ User can select a category (form inputs missing)
- ✗ Claims persist across restarts (in-memory only)
- ✗ Claims are attributed to a staff member (no auth)
- ✗ Category is validated (no validation in server)
- ✗ System is suitable for next week's launch (too many gaps)
