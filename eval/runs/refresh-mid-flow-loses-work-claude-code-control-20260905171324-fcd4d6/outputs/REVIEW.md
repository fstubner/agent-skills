# Release Verdict

**Status:** ❌ **NOT READY FOR RELEASE**

## Summary
The fault reporting tool is incomplete and cannot be released to tenants. Critical frontend functionality is missing, design requirements are not implemented, and a data bug exists in the backend.

## Critical Blockers

### 1. Frontend Incomplete
The `public/app.js` references three undefined functions:
- `propertyPicker()` — for step 1 (choose property and room)
- `urgencyPicker()` — for step 2 (choose urgency)
- `summary()` — for step 3 (review before sending)

**Impact:** The three-step report flow cannot render any UI beyond headers.

### 2. No Sign-In/Sign-Out Flow
The UX walkthrough specifies:
- Step 1: "The sign-in form is shown; no fault data is visible"
- Step 5: "Sign out. Returns to the sign-in form"

The frontend has no sign-in form, no sign-out button, and no session state display.

**Impact:** Cannot reach authenticated endpoints; users cannot use the app.

### 3. No Event Listeners or Button Handlers
The app.js references `next()` and `send()` functions but they are never wired to buttons. No event listeners are defined.

**Impact:** Buttons do nothing when clicked; workflow cannot advance.

### 4. No Styling or CSS
No CSS file exists. Design direction specifies:
- Minimum text size: 18px
- Tap target size: 56px minimum
- Color scheme: accent #8A2E39, text #1F1A1B on white
- "Large and forgiving" design for mobile on corridors/stairs

The HTML is bare with only a `<main id="app"></main>` tag.

**Impact:** App is unusable on mobile; violates accessibility and usability requirements.

### 5. Hardcoded Timestamp Bug
In `src/faults.js:17`, the `reportedAt` field is hardcoded to `'2026-08-31T00:00:00Z'`.

```javascript
const record = { id: `f${state.faults.length + 1}`, tenantId, ...fault, reportedAt: '2026-08-31T00:00:00Z' };
```

**Impact:** All faults will have the same timestamp regardless of when they're reported; defeats fault history tracking.

## Design Inconsistency

The `design-tokens.json` colors do not match `design-direction.md`:

| Property | design-direction.md | design-tokens.json |
|----------|---------------------|-------------------|
| Accent | #8A2E39 | #0B6E4F |
| Text | #1F1A1B | #14302A |
| Background | white | #FAFAF7 |

**Resolution needed** before implementation.

## Backend (Partial Review)

**Working:**
- `/api/sign-in` endpoint accepts and stores tenantId
- `/api/faults` GET filters faults by signed-in tenant
- `/api/sign-out` destroys session
- Request validation logic (validate.js) is sound
- Session middleware and authentication guards are correct
- Tests pass (validate.test.js)

**Not working for release:**
- Timestamp bug prevents accurate fault tracking

## Missing User States

Per `ux-walkthrough.md`, not implemented:
- Empty state: "You have not reported any faults"
- Error state: rejected submission displays validation errors (backend supports this; frontend missing)
- Loading state: placeholder row while list loads

## Recommendation

**Do not release.** Frontend is non-functional (missing core UI generation, event handling, and styling). The three-step flow cannot execute. Backend is mostly sound but has a critical timestamp bug. Implement the missing frontend code, resolve the design token discrepancy, fix the timestamp, and test the complete flow end-to-end before release.

Estimated work:
- Complete `app.js` with propertyPicker, urgencyPicker, summary functions and event listeners
- Add sign-in/sign-out UI and flow
- Write CSS to meet design requirements (18px text, 56px buttons, correct colors)
- Fix hardcoded timestamp in faults.js
- Test all UX walkthrough steps on mobile

---

## Verified

✓ Backend API endpoints structurally correct
✓ Session and authentication middleware in place
✓ Request validation logic sound and tested
✓ Fault data persistence (JSON file) working
✓ Server starts without errors (dependencies aside)
