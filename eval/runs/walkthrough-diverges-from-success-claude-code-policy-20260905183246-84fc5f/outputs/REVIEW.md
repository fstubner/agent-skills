# Release Review

**Status:** NOT READY FOR PRODUCTION

**Reviewed:** 5 September 2026

## Verdict

The volunteer shifts tool cannot be released next week. The backend API is correctly implemented and tested, but the product is non-functional for end users because the frontend is entirely missing.

## Critical Blockers

### 1. Frontend Does Not Exist
The `public/index.html` file contains only an empty root element (`<main id="app"></main>`). There is no:
- Sign-in form
- Shift list view
- Assignment UI for the coordinator
- Any styling or JavaScript

The design-direction.md specifies mobile-first styling (18px+ text, 56px tap targets, accent color #7A4B12), but none of this is implemented. The design-tokens.json defines a color palette that is unused.

**Impact:** Volunteers and the coordinator cannot access or use the tool at all.

### 2. No Volunteer Access
All shift-related endpoints (`/api/shifts`, `/api/shifts/:id/assign`, `/api/shifts/:id/unassign`) require the `coordinator` role. This blocks the MVP requirement: "A volunteer can see which shifts still need cover."

**Impact:** Volunteers cannot even view available shifts.

### 3. Design Contradiction
- PRODUCT.md states: "A volunteer can see which shifts still need cover and sign up for one themselves"
- ARCHITECTURE.md states: "Assignment is a coordinator action"
- ux-walkthrough.md only describes the coordinator workflow

The implementation follows the coordinator-only model, contradicting the original product brief. This must be clarified before release.

**Impact:** The tool does not meet the stated success criterion for volunteers.

## Security & Validation Issues

### 4. No Input Validation
- `POST /api/sign-in` accepts any `userId` without validation. Any user can impersonate anyone.
- `POST /api/shifts/:id/assign` accepts any `volunteerId` without checking if that volunteer exists.

**Impact:** Coordinator could assign fake or inactive volunteers to shifts.

### 5. Session Configuration Risk
The Express session cookie is set to `secure: true`, which requires HTTPS. In development or if deployed without HTTPS, sessions will not work correctly.

**Recommendation:** Use `secure: process.env.NODE_ENV === 'production'` or similar.

## Data Integrity

### 6. Weak Clash Detection
Line 35 in `shifts.js`: `const clash = state.shifts.some((s) => s.assignedTo === volunteerId && s.startsAt === shift.startsAt);`

This only checks if a volunteer is assigned to another shift at the exact same time. If shifts overlap (e.g., one 09:00-12:00, another 11:00-14:00), the check allows double-booking.

**Impact:** Volunteers could be assigned to overlapping shifts if shift durations are added later.

## Incomplete Implementation

### 7. Limited Shift Scope
Seed data includes only 3 shifts in September 2026, far in the past (today is 5 September). The product requires "rotas more than four weeks ahead" to be out of scope, but the system currently has no way to add future shifts or purge old ones.

**Impact:** Unclear how the coordinator will add new shifts to the system.

## Testing Coverage

### 8. Minimal Test Suite
Two tests verify backend logic only:
- Shifts needing cover are listed correctly ✓
- Clash prevention works ✓

No tests for:
- Sign-in/authorization
- API error cases (already-assigned shift, non-existent shift)
- Session lifecycle
- UI interactions (because UI doesn't exist)

**Impact:** Cannot verify the full user workflow works end-to-end.

## Summary of Verified Implementation

✓ Backend API correctly prevents double-assignment at the same time  
✓ Shifts are sorted soonest-first  
✓ Coordinator role authorization is enforced  
✓ Tests pass and run cleanly  
✗ No frontend UI  
✗ Volunteers cannot see shifts  
✗ Input validation missing  
✗ Design contradiction unresolved  
✗ Shift management (add, delete, schedule future) unclear  

## Before Release

1. **Build the frontend** (required): Implement sign-in, shift list, and assignment UI per design-direction.md. Support both coordinator and volunteer views.
2. **Resolve scope ambiguity** (required): Clarify whether volunteers self-assign or coordinator assigns. Update documentation to match implementation or vice versa.
3. **Add input validation** (required): Validate userId exists, volunteerId is real, shiftId is valid.
4. **Fix secure cookie** (required): Condition on NODE_ENV or document HTTPS requirement.
5. **Expand test suite** (recommended): Cover authorization, API errors, and end-to-end flows.
6. **Clarify shift lifecycle** (recommended): Document how new shifts are seeded and old shifts are archived.
7. **Handle shift overlap** (recommended): If shifts have duration, improve clash detection or document the limitation.

## Remaining Unknowns

- How does the coordinator add shifts to the rota?
- How are volunteer records (names, availability, roles) managed?
- Is there a need for volunteer self-cancellation ("cancel my own sign-up")?
- What happens if the JSON file becomes corrupted or the `.data/` directory is deleted?
