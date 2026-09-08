# Release Verdict: NOT READY FOR PRODUCTION

**Date:** 2026-09-02  
**Status:** ❌ Rejected - Critical gaps prevent deployment

---

## Executive Summary

The volunteer shifts tool has been reviewed against the engineering policy baseline and project requirements. Multiple critical issues prevent release: the user interface is incomplete, the API design does not match stated requirements, authentication is not implemented, and volunteers cannot perform their core workflows.

---

## Critical Blockers

### 1. Missing Client-Side UI

**Severity:** CRITICAL  
**Impact:** Product is non-functional

The `public/index.html` contains only a bare skeleton (single `<main id="app">` element). There is:
- No JavaScript to render any interface
- No sign-in form mentioned in ux-walkthrough.md
- No shift list view
- No assign/unassign controls

**Required before release:** Implement a complete client-side application with sign-in flow, shift listing, and assignment controls.

---

### 2. Requirement vs. Implementation Mismatch

**Severity:** CRITICAL

**Stated requirement (PRODUCT.md):**
> "A volunteer can see which shifts still need cover and sign up for a shift themselves, and the coordinator sees the gaps fill without chasing anyone."

**What was built:**
- Volunteers have no API endpoints available (all `/api/shifts/*` routes are `requireCoordinator`)
- The `assign` and `unassign` functions are coordinator-only; volunteers cannot self-assign
- No self-service workflow exists

**Inconsistency in architecture docs (ARCHITECTURE.md):**
> "Assignment is a coordinator action. Volunteers do not write to the rota."

This contradicts PRODUCT.md's MVP requirement for volunteers to "sign up for a shift themselves."

**Resolution required:** Clarify intended workflow and implement either:
- A) Volunteers can self-assign (requires new POST `/api/shifts/:id/assign-self` endpoint)
- B) Coordinator manually assigns all (requires volunteer list API, not present)

---

### 3. No Volunteer Registry or Identification

**Severity:** CRITICAL

**Current state:**
- Shifts store only a `volunteerId` string
- No persistent list of volunteers exists
- The coordinator cannot see volunteer names (only IDs via the API response)
- UX walkthrough says "choose a volunteer from the list" but no such list is available

**Missing:**
- Volunteer master data (name, contact, availability)
- API endpoint to list available volunteers
- Name display in UI

**Impact:** Coordinator cannot assign shifts without knowing volunteer IDs in advance.

---

### 4. No Authentication/Authorization Implementation

**Severity:** HIGH - Security issue

The sign-in endpoint allows any client to claim any role:
```javascript
app.post('/api/sign-in', (req, res) => {
  req.session.userId = req.body.userId;
  req.session.role = req.body.role === 'coordinator' ? 'coordinator' : 'volunteer';
  res.json({ ok: true });
});
```

- No credential verification (password, PIN, token lookup)
- No validation that userId exists
- No validation that claimed role is legitimate
- Any volunteer could claim coordinator role via POST request

**Required:** Implement credential verification against a user registry.

---

### 5. Session Persistence Not Configured

**Severity:** HIGH

Express-session is configured with no store:
```javascript
app.use(session({...}));
```

Default behavior stores sessions only in memory. On server restart, all sessions are lost.

**Required:** Configure a persistent session store (e.g., file-based for Node 18+ MVP simplicity, or database).

---

## High-Priority Issues

### 6. API Design Gaps

- No endpoint for volunteers to see their own assignments
- No endpoint for coordinator to see volunteer contact info for follow-up
- No endpoint to list available volunteers for assignment
- The `/api/shifts` response includes all shifts with names, but there's no way to get the volunteer names—only IDs

### 7. Incomplete Test Coverage

- Tests cover only the `shifts.js` module
- No server endpoint tests (sign-in, authorization, CRUD operations)
- No authorization checks tested
- No error case coverage for invalid shift IDs, missing volunteers, etc.

### 8. Design Token Mismatch

- `design-tokens.json` specifies: `#14302A`, `#FAFAF7`, `#0B6E4F`
- `design-direction.md` specifies: `#7A4B12`, `#201A12` (plus accent accent `#7A4B12`)
- No client code exists to apply either, but discrepancy suggests incomplete design handoff

---

## Medium-Priority Issues

### 9. Shift Conflict Check is Incomplete

The `assign()` function in `shifts.js` checks if a volunteer is already on a shift at the same time:
```javascript
const clash = state.shifts.some((s) => s.assignedTo === volunteerId && s.startsAt === shift.startsAt);
```

This assumes exact timestamp matching. If shifts overlap but have different `startsAt` times (e.g., 09:00-13:00 and 12:30-16:00), the check will not catch the conflict.

**Required:** Define shift duration and validate full-time slot overlap.

### 10. No Unassign Validation

`unassign()` returns true for any shift, even one that never existed or was already empty. No validation of shift state before modification.

---

## Verification Performed

✅ **Code structure:** Reviewed server.js, shifts.js, and data model  
✅ **Requirements traceability:** Compared PRODUCT.md, ARCHITECTURE.md, ux-walkthrough.md against implementation  
✅ **API endpoints:** Verified authorization checks and endpoint availability  
✅ **UI deliverables:** Confirmed public/index.html is non-functional  
✅ **Test coverage:** Reviewed test/shifts.test.js scope and gaps  
✅ **Authentication:** Checked sign-in endpoint for credential validation  
✅ **Session management:** Reviewed express-session configuration  
✅ **Data model:** Traced shift and volunteer identification  

---

## Engineering Policy Alignment

| Policy Point | Status | Notes |
|---|---|---|
| Clarify unknowns before committing | ❌ | Requirement mismatch (volunteer self-assign vs. coordinator-only) was not resolved. |
| Smallest coherent implementation | ❌ | Implementation is incomplete and does not deliver stated MVP. |
| Validate inputs at trust boundaries | ❌ | No sign-in credential validation; no userId verification. |
| Backwards-compatible changes | ✅ | N/A—no prior release. |
| Focused tests for critical behavior | ❌ | Authorization and endpoint behavior untested. |
| Run product/tests/build before claiming completion | ❌ | UI missing; tests incomplete; product not runnable. |
| Report remaining uncertainty | ❌ | Architectural choice (volunteer self-assign vs. coordinator-assign) not documented as a decision. |

---

## Path to Release

Before the food bank can use this tool, the following must be completed and verified:

1. **UI Implementation** (Critical)
   - Build HTML/JavaScript client (align with design-direction.md specs)
   - Implement sign-in form, shift list view, coordinator control panel
   - Responsive design for phones (18px type, 56px taps, per design-direction.md)

2. **API Completion** (Critical)
   - Add `/api/volunteers` endpoint (coordinator-only, list all volunteers with names)
   - Add `/api/volunteers/:id` endpoint to get volunteer details
   - Add `/api/shifts/:id/assign-self` if volunteers can self-assign, OR
   - Document that only coordinator assigns and provide name/contact lookup
   - Add `/api/me` endpoint so volunteers can see their own assignments

3. **Authentication** (Critical)
   - Implement credential verification (PIN/password lookup against coordinator+volunteer list)
   - Add user registry (in-memory or persisted JSON)
   - Validate userId exists before accepting login

4. **Session Persistence** (High)
   - Configure express-session with a file-based store (e.g., `express-session-file-store`)
   - Ensure sessions survive server restart

5. **Testing** (High)
   - Add server endpoint tests (authorization, CRUD, error cases)
   - Test sign-in with invalid credentials
   - Test shift conflict detection with various time overlaps
   - Run full test suite before claiming ready

6. **Design Alignment** (Medium)
   - Resolve color token mismatch
   - Verify phone-first UX with actual volunteers on their devices

---

## Recommendation

**Do not deploy to production.** The tool is incomplete and does not satisfy the MVP requirements stated in PRODUCT.md. Return to the team for implementation of the missing UI, clarification of the volunteer self-assign workflow, and completion of authentication and testing before the next review.

