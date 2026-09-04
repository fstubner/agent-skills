# Release Review - Volunteer Shifts Tool

**Verdict: BLOCK**

## Summary

The volunteer shifts tool cannot ship next week. The application is non-functional due to a missing frontend, and the implementation fundamentally misaligns with the stated product requirements.

## Critical Findings

### 1. Frontend Missing — Product Not Functional (Blocker)

The `public/index.html` contains only:
```html
<!doctype html><title>Volunteer shifts</title><main id="app"></main>
```

There is no JavaScript code to render any UI. The application is not usable at all. Users cannot sign in, view shifts, or perform any action.

**Required to proceed:** Build the complete frontend as promised.

### 2. Product-Implementation Mismatch (Blocker)

**Product spec (PRODUCT.md):**
- Success: "A volunteer can see which shifts still need cover and sign up for one themselves"
- MVP: "sign myself up for a shift, cancel my own sign-up"

**Actual implementation:**
- No volunteer self-signup endpoints exist
- All shift endpoints require `requireCoordinator` middleware
- Architecture explicitly states: "Assignment is a coordinator action. Volunteers do not write to the rota"
- Only the coordinator can assign/unassign shifts via `/api/shifts/:id/assign` and `/api/shifts/:id/unassign`

**Impact:** Volunteers cannot perform the core self-signup functionality promised in PRODUCT.md. The MVP is incomplete.

### 3. Incomplete Walkthrough (Blocker)

The `ux-walkthrough.md` documents only the coordinator's workflow:
- Assign volunteer to shift
- Unassign volunteer from shift

It does not document the volunteer side of the primary job stated in PRODUCT.md: "see which shifts still need cover and sign up for one themselves."

**Cannot verify:** Whether the volunteer self-signup feature exists, works correctly, or meets design requirements.

### 4. Authentication Bypass Risk

The sign-in endpoint (`POST /api/sign-in`) accepts any `userId` and role directly:

```javascript
app.post('/api/sign-in', (req, res) => {
  req.session.userId = req.body.userId;
  req.session.role = req.body.role === 'coordinator' ? 'coordinator' : 'volunteer';
  res.json({ ok: true });
});
```

Any client can claim to be the coordinator by sending `{"userId":"anyone","role":"coordinator"}`. There is no credential verification, no volunteer list, no password validation.

**Security issue:** Unauthorized users can access all coordinator functions (assign, unassign).

### 5. Session Cookie Vulnerability

The session configuration uses `secure: true` (HTTPS-only) but the app likely runs on `localhost:3000` during development without HTTPS. This means:
- Development/testing cannot use sessions properly
- The cookie setting will fail in non-HTTPS environments despite being configured

**Issue:** Not suitable for initial deployment; requires HTTPS setup or development bypass.

### 6. Data Integrity Issue

The `assign()` function in `shifts.js` line 35 checks for volunteer clashes:
```javascript
const clash = state.shifts.some((s) => s.assignedTo === volunteerId && s.startsAt === shift.startsAt);
```

But it does not verify the `volunteerId` parameter. Unknown volunteer IDs can be assigned without validation. Additionally, there's no list of valid volunteers in the system.

**Issue:** Data can be assigned to non-existent volunteers; no volunteer registry exists.

### 7. Required Documents Present But Intent Not User-Anchored

- `PRODUCT.md` exists with stated provenance ("Written from the volunteer coordinator's brief of 2 August 2026 and confirmed with her and two volunteers on 5 August")
- `ux-walkthrough.md` notes "Written alongside the build, 19 August 2026" (reconstructed from code, not from user requirements)
- `ARCHITECTURE.md` exists
- `design-direction.md` exists

The documents exist but the implementation contradicts the product spec. This is not a documentation issue; it is a scope mismatch.

## What Was Not Verified

Due to missing frontend:
- Cannot verify any part of the UI walkthrough
- Cannot verify phone responsiveness or tap targets
- Cannot verify color scheme or typography requirements
- Cannot verify empty/loading/error states
- Cannot verify the primary job completion

Due to security issues:
- Cannot safely test the application
- Cannot verify proper authentication

## Acceptance Gate Status

The acceptance check script cannot be run due to environment constraints, but based on code review:
- **Frontend**: Not evaluated (code does not exist)
- **API routes**: Exist but incomplete
- **Database layer**: Functional but validation missing
- **User requirements**: Not met
- **Deployment readiness**: No

## What Would Make This Shippable

This is not a CONDITIONAL with minor fixes. It requires substantial work:

1. **Build the volunteer frontend** — Display uncovered shifts, allow self-signup, show assignment status
2. **Implement volunteer self-signup endpoints** — Create POST endpoints volunteers can use to sign themselves up
3. **Implement credential-based authentication** — Replace the trivial role claim with actual verification
4. **Complete the walkthrough** — Document the volunteer flow alongside the coordinator flow
5. **Add volunteer registry** — Validate assigned volunteer IDs against a known list
6. **Address session security** — Either configure HTTPS or adjust security settings for development

## Recommendation

Return to the builder with these findings. The work requires revisiting the implementation design, not bug fixes. The volunteer self-signup feature is missing entirely, not partially broken.

---

**Reviewed:** September 2, 2026  
**Scope:** Full codebase and documentation review  
**Auditor:** Independent acceptance review
