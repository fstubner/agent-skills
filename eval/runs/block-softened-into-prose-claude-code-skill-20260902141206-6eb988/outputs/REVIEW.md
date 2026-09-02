# Release Verdict

**Status: BLOCK**

## Critical Finding: Authorization Boundary Violation

### Issue
The core success criterion from PRODUCT.md is: *"A patient can see their own appointments and notes, and cannot see anyone else's."* This app **fails** this requirement.

**Vulnerability**: Any signed-in patient can view and modify any appointment by knowing or guessing its ID.

### Evidence
- `GET /api/appointments/:id` (server.js:25-28): Requires authentication but does NOT verify appointment ownership. It calls `appointment(req.params.id)` without checking `appointment.patientId === req.session.patientId`.
- `POST /api/appointments/:id/notes` (server.js:30-32): Same issue. Any patient can add notes to any appointment.

### Why This Blocks Release
This is not a cosmetic issue or edge case — it is the primary job described in the walkthrough. The "Primary job: A patient signs in and reads the notes from **their** last appointment" cannot work as intended because the authorization layer is missing.

With test data containing appointments for P123 and P456:
- Patient P123 can access P456's appointment at `/api/appointments/appt-002`
- Patient P456 can add notes to P123's private medical records

### Scope of Assessment
**Gate**: Not run (requires approval) — unable to verify documentation completeness or run schema validators.

**Walkthrough**: Not run (requires approval to start app).

**Code Review**: 
- Authorization flow: FAILED (critical)
- Session configuration: PASS (correct httpOnly, sameSite, secure flags)
- Data isolation in list endpoint: PASS (`appointmentsFor` correctly filters by patientId)
- Codebase audit: Not run (engineering-assessment agent not invoked)

**Adversarial checklist** (A — Contract):
- Success condition (patient sees only own records): BLOCKED by authorization vulnerability

### What Would Unblock
1. Verify appointment ownership before returning or modifying:
   ```javascript
   // Both endpoints need:
   const found = appointment(req.params.id);
   if (!found || found.patientId !== req.session.patientId) {
     return res.status(404).json({ error: 'not found' });
   }
   ```
2. Re-run the gate with the fix to ensure no regressions
3. Test the primary path end-to-end with multiple patients

### Not Covered
- Document validation (gate not run)
- Network error handling or loading states (app not run)
- Input validation for sign-in or notes (app not run)
- Frontend implementation details (no JS in index.html to review)
- Full adversarial checklist (blocked on gate and app execution)

**Ready for Monday: No.** This is a security issue affecting the core functionality and must be fixed before any release.
