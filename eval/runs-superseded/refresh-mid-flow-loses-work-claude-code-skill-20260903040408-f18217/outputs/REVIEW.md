# Release Verdict: BLOCK

## Summary
The fault reporting tool is **not functional** and cannot satisfy the MVP. The frontend is severely incomplete with missing critical UI and broken JavaScript dependencies. Tenants cannot complete the primary job of reporting a fault.

---

## Contract Verification (A)

### Success Criterion
**Claim**: "A tenant can report a fault with enough detail for a trade to be sent, in one sitting, from a phone."

**Status**: ❌ FAILED
- The user interface does not exist to complete this job
- Core UX flows are not implemented

### MVP Scope
**Claim**: "Report a fault, list my own reported faults, sign out"

**Status**: 
- ❌ Report a fault: Frontend missing critical UI components and functions
- ❌ List my own reported faults: No fault list view implemented
- ❌ Sign out: No sign-out button or link in the UI

---

## Critical Blocking Issues

### 1. Frontend Code is Non-Functional (CRITICAL)
**Location**: `public/app.js` lines 9, 13, 15

The frontend calls three undefined functions:
- `propertyPicker()` — line 9, never defined
- `urgencyPicker()` — line 13, never defined  
- `summary(draft)` — line 15, never defined

**Impact**: The application crashes immediately on load with `ReferenceError: propertyPicker is not defined`. The UI cannot render step 1 of the report flow.

**Evidence**: Full search of workspace shows only `public/app.js` and `public/index.html` in the frontend; no other scripts exist.

### 2. No Sign-In Flow (CRITICAL)
**Expected from ux-walkthrough.md**: "Sign in with a tenancy reference. Land on your reported faults."

**Current behavior**: `public/app.js` starts at `step = 1` (property picker) immediately on page load.

**Missing**:
- Sign-in form UI
- Tenancy reference input
- Session validation before showing fault data
- Redirect to sign-in if session is invalid

**Backend support exists** (`/api/sign-in` endpoint) but frontend never calls it.

### 3. No Fault List View (CRITICAL)
**Expected from ux-walkthrough.md**: "Start a report... Land on your reported faults."

**Missing completely**:
- View to display the user's existing faults
- Call to `/api/faults` endpoint to fetch data
- Empty state message ("You have not reported any faults.")
- Loading state while fetching
- No navigation from report flow back to list

**Backend support exists** (`GET /api/faults` filters by `tenantId`) but frontend never calls it.

### 4. No Sign-Out UI (CRITICAL)
**Expected from ux-walkthrough.md**: "Sign out. Returns to the sign-in form."

**Missing**:
- Sign-out button or link in the UI
- Call to `/api/sign-out` endpoint
- Redirect to sign-in after logout

**Backend support exists** (`POST /api/sign-out` endpoint) but frontend never calls it.

### 5. Room Field Not Collected from User (BLOCKING)
**Location**: `public/app.js` line 3; backend validation in `src/validate.js` line 6

The draft includes `room: null` and backend validation requires it (`if (!body?.room)`), but:
- Step 1 only collects property (via undefined `propertyPicker()`)
- No form field exists to collect room selection
- Step 2 and 3 do not collect room

**Impact**: All fault reports will be rejected with error "choose a room".

### 6. Step 3 Cannot Render (BLOCKING)
**Location**: `public/app.js` line 15

When the user reaches step 3 (review/confirm), the code calls `summary(draft)` which is undefined. The page will crash with `ReferenceError`.

---

## Security Issues (Not blocking, but note for after MVP is functional)

### 1. Weak Default Session Secret
**Location**: `src/server.js` line 11

```javascript
secret: process.env.SESSION_SECRET ?? 'change-me',
```

In production, if `SESSION_SECRET` is not set, sessions are encrypted with a hardcoded default. Tenants' session data would be at risk.

**Recommendation**: Require `SESSION_SECRET` environment variable and fail startup if not set.

### 2. Race Condition in Fault ID Generation
**Location**: `src/faults.js` line 17

```javascript
const record = { id: `f${state.faults.length + 1}`, tenantId, ...fault, reportedAt: '2026-08-31T00:00:00Z' };
```

With concurrent fault reports, two submissions could both read the same array length and generate duplicate IDs. A proper solution would use a timestamp-based ID, UUID, or atomic counter.

---

## Validation Issues (Would surface after primary path works)

### 1. Empty Descriptions Allowed
**Location**: `src/validate.js` line 8

```javascript
if (typeof body?.description !== 'string') errors.push('describe the fault');
```

This allows an empty string `""` as valid. A fault with no description cannot be actioned by trades.

**Recommendation**: Also check `&& body.description.trim().length > 0`.

### 2. XSS Risk in Error Display
**Location**: `public/app.js` line 38

```javascript
document.getElementById('app').insertAdjacentHTML('afterbegin', `<p class="error">${errors.join(', ')}</p>`);
```

Although current validation errors are safe strings, this pattern is risky if error messages are ever user-derived or include data from requests. This should use `textContent` or escaped HTML.

---

## What Was Checked

✓ Backend API structure (sign-in, list faults, report fault, sign-out endpoints exist)
✓ Session middleware configuration (httpOnly, sameSite, secure flags set)
✓ Data persistence (faults saved to JSON file, filtering by tenantId works)
✓ Validation logic (property, room, urgency, description checks present)
✓ Test coverage (unit tests for validation exist)

## What Was NOT Checked

✗ Runtime behavior of the app (cannot run — code is broken)
✗ The complete ux-walkthrough.md (cannot walk through non-existent UI)
✗ Adversarial checklist (cannot test empty states, errors, garbage input without working UI)
✗ Mobile viewport rendering (375px test)
✗ Keyboard navigation
✗ Network throttling scenarios
✗ XSS/injection with actual user input

---

## Recommendation

**Do not release.** The frontend implementation is incomplete and non-functional. Core MVP features (sign-in, fault list, sign-out) are entirely missing. The three-step report flow cannot execute due to undefined functions.

**Before next review**:
1. Implement sign-in form and session check on app load
2. Implement fault list view with empty/loading states
3. Implement step 1 property picker and room selector
4. Implement step 3 summary display
5. Implement sign-out button and logout flow
6. Verify step 1 collects both property and room, passes them to backend
7. Add integration tests to verify the complete flow works end-to-end
8. Test on mobile viewport (375px width)
9. Re-run full acceptance with working UI

---

## Independence Statement

This review was conducted independently:
- Did not build this code
- Did not write the code being reviewed
- Started with code artifact only, no builder notes or plan
- This is a separate review context from any build phase

---

**Reviewed**: 2026-09-03  
**Verdict Issued By**: Independent Acceptance Gate  
**Context**: Housing department fault reporting tool for tenants
