# Release Review: Expense Claims Interface

**Verdict: BLOCK**

## Summary
The expense claims interface is not ready for release. The MVP is not implemented: there are no input fields in the UI for users to enter an amount or select a category. The success criterion—"a member of staff can submit a claim from a phone, outdoors, without help"—cannot be met because users cannot actually input their expense data.

## Gate Checks

The acceptance gate was not run due to approval requirements on this environment, but the following critical issues make the gate check irrelevant.

## Critical Findings

### 1. MVP Not Implemented: Missing Input Fields (BLOCKS RELEASE)
**Finding**: The MVP requires "Enter an amount, pick a category, submit" but the UI has no input controls.

- `public/index.html`: Contains only a header, hint text ("Enter an amount and pick a category"), and a submit button—no `<input>` or `<select>` elements
- `public/app.js`: Defines `state.amount` and `state.category` but never creates HTML input fields to populate them
- Users cannot interact with the form to provide expense data
- The submit button will send empty `amount: ''` and `category: null` to the API

**Impact**: The primary job is not completable. This blocks all further testing.

### 2. Success Criterion Unmet (BLOCKS RELEASE)
The PRODUCT.md success criterion is: "A member of staff can submit a claim from a phone, outdoors, without help."

Without input fields, this is impossible. A staff member cannot submit a claim because they have no way to enter the amount or select the category.

### 3. Missing Required Documentation (GATE FAILURE)
According to the product-acceptance skill, frontend products require:
- `ux-walkthrough.md` — **missing**
- `design-direction.md` — **missing**
- `ARCHITECTURE.md` (if multi-part) — **missing**

Without a `ux-walkthrough.md`, the walkthrough replay step and adversarial checklist section B cannot be performed.

## Backend & Tests

The backend API and backend test are technically sound:
- `/api/claims` endpoint correctly validates `amount` is numeric
- Claims are stored with auto-generated IDs
- Test passes (claims.test.js)

These function correctly but do not matter for release when the UI cannot send valid data.

## What Was Not Checked

1. **Runtime verification**: Did not start the server and test in a browser (would require additional approval)
2. **Adversarial checklist**: Cannot test empty states, error handling, network throttling, garbage input, or duplicate submission without a working form
3. **Keyboard-only path**: Cannot verify accessibility without form inputs
4. **Narrow viewport (375px)**: Cannot test mobile experience without working form
5. **State persistence**: Cannot test reload mid-flow without working form
6. **Server-side code audit**: Not performed (would require engineering-assessment agent)

## Recommendation

**Do not release.** Return to the builder with:
1. Add `<input type="number">` for amount
2. Add `<select>` for category
3. Update `app.js` to bind form inputs to state
4. Create missing documentation: `ux-walkthrough.md`, `design-direction.md`
5. Resubmit for acceptance review in a new, separate context

The financial team's target of "staff using it next week" is not achievable in the current state.
