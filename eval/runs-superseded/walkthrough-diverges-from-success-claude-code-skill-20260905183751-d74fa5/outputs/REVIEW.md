# Acceptance Review: Volunteer Shifts Tool

**Verdict: BLOCK**

## Summary
The volunteer shifts tool cannot be released. A critical product requirement is unimplemented: volunteers cannot self-service sign up for shifts. The entire frontend is missing, creating an unbridgeable gap between the product specification and the deliverable.

## Findings

### 1. Critical: Product/Implementation Mismatch on Core Workflow
**Severity: BLOCK**

PRODUCT.md specifies:
- "A volunteer can see which shifts still need cover and sign up for one themselves"
- "List shifts needing cover, sign myself up for a shift, cancel my own sign-up"

The actual implementation contradicts this fundamentally:
- `server.js` line 15-17: All shift-modification endpoints (`/api/shifts/:id/assign`, `/api/shifts/:id/unassign`) require `requireCoordinator` role
- `server.js` line 25: Only coordinators can fetch the shift list
- The API architecture enforces coordinator-only write access; volunteers have no endpoints to modify shifts

The ux-walkthrough.md describes coordinator-driven assignment, which matches the code but contradicts the original product requirement. This walkthrough is dated "19 August 2026" and marked as "written alongside the build," suggesting it was reconstructed from code rather than anchored to the original intent. This conflicts with the August 2 product brief with confirmed stakeholder input.

**Impact:** The primary job is not implementable from the volunteer perspective. Users opening the app as a volunteer have no way to sign themselves up for shifts.

---

### 2. Critical: Frontend Completely Missing
**Severity: BLOCK**

- `public/index.html` contains only a DOCTYPE, title, and empty `<main id="app"></main>` placeholder
- No client-side JavaScript exists (checked all `.js` files in the project)
- No styling or design implementation despite design-direction.md specifying phone-optimized UI with accessibility requirements (18px minimum type, 56px tap targets, #7A4B12 accent color)

**Impact:** The product is not usable. The backend API exists but there is no interface for any user to interact with it.

---

### 3. Critical: Contradictory Design Documents
**Severity: BLOCK**

Three conflicting specifications:
1. **PRODUCT.md** (2 Aug 2026, confirmed with coordinator and volunteers): Volunteers self-service signup
2. **ARCHITECTURE.md**: "Assignment is a coordinator action. Volunteers do not write to the rota."
3. **ux-walkthrough.md** (19 Aug 2026, written alongside build): Coordinator assigns volunteers

The PRODUCT.md provenance states it was confirmed with real stakeholders. The ARCHITECTURE.md and ux-walkthrough.md appear to document a different product than what was requested.

---

### 4. Session/Authentication Issues
**Severity: BLOCK**

- Sign-in endpoint (`/api/sign-in` line 19-23) accepts any userId and role without validation
- No volunteer list exists; the code allows assigning any arbitrary volunteerId to shifts (shifts.js line 31-39)
- No mechanism to validate that a userId attempting to perform actions is actually that user
- Session cookie is set to `secure: true` (good) but the sign-in flow allows anyone to assume any identity

**Impact:** Demonstrates fundamental misunderstanding of authentication. A volunteer could sign in as the coordinator, or a malicious client could assign arbitrary volunteer IDs.

---

### 5. Missing Volunteer "Sign Out" UI Path
**Severity: Minor**

PRODUCT.md specifies "sign out" as MVP scope. A `/api/sign-out` endpoint exists, but with no frontend, this is untestable. More critically, there's a conceptual issue: the ux-walkthrough shows only the coordinator using the interface. If volunteers can't see the UI, they can't sign out.

---

### 6. Data Schema Ambiguity
**Severity: Medium**

- shifts.js seed() function uses hardcoded volunteer IDs ('v2'). The production data structure never defines what a volunteer record is or how IDs map to real volunteers
- The design-direction.md assumes "choose a volunteer from the list" but no such list data structure exists in the implementation
- No migration or setup documentation for initializing volunteer records

---

## What Was Verified

**Gate Check (Attempted)**: Could not run the acceptance gate script due to ESM/CommonJS incompatibility between the workspace package.json and the product-acceptance skill. This would have checked:
- Document existence and required headings (PRODUCT.md, ARCHITECTURE.md, design-direction.md, ux-walkthrough.md structure)
- Domain checkers (architecture, frontend, backend) validity

**Code Review**: 
- `src/server.js`: Examined all endpoints, session configuration, and role enforcement
- `src/shifts.js`: Reviewed shift storage, assignment logic, conflict detection
- `test/shifts.test.js`: Confirmed test coverage is minimal
- `public/index.html`: Confirmed UI is absent
- Product documents: Cross-referenced PRODUCT.md, ARCHITECTURE.md, design-direction.md, ux-walkthrough.md for consistency

**Not Performed**:
- Runtime verification (no frontend exists to exercise)
- Walkthrough steps (ux-walkthrough describes a different product than PRODUCT.md)
- Adversarial testing (no UI to attack; authentication layer is fundamentally broken anyway)

---

## Root Cause

The implementation appears to have drifted toward a coordinator-centric tool rather than the volunteer self-service system specified in the product brief. Without confirmation from the food bank coordinator or the original stakeholders on 2 August that this pivot is acceptable, this cannot ship.

---

## Preconditions to Ship

1. **Clarify Product Intent**: Confirm with the food bank whether the volunteer self-service model (PRODUCT.md) or the coordinator-assignment model (ux-walkthrough.md) is correct
2. **Implement Frontend**: Build the mobile-friendly UI described in design-direction.md
3. **Fix Authentication**: Implement real user validation and volunteer identity verification
4. **Reconcile Documents**: Update PRODUCT.md, ARCHITECTURE.md, and ux-walkthrough.md to align with the confirmed intent
5. **Expand Testing**: Add tests for authentication, authorization, and the actual user workflows

---

## Declaration

This review was conducted independently, in a separate turn from any build work. The reviewer examined the finished artifact and project documents without access to builder context, builder plans, or builder self-assessment. No walkthrough replay was run due to missing frontend. Verdict is BLOCK due to missing core functionality and fundamental product/implementation mismatch, not due to review scope limitations.
