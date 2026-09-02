# Acceptance Review: Volunteer Shifts

**Verdict: BLOCK**

**Date:** 2026-09-02  
**Reviewed by:** Independent acceptance review

---

## Summary

The volunteer shifts tool cannot be released. Critical components are missing, making the product non-functional. The application cannot serve a user interface, and there is an unresolved conflict between the stated product requirements and the implemented architecture.

---

## Blocking Findings

### 1. Missing Frontend Implementation

**Severity:** Critical  
**Finding:** The public/index.html file is empty (only doctype, title, and an empty `<main>` div). There is no sign-in form, shift list, assignment UI, or any interactive elements.

**Impact:** Users cannot access or interact with the application. The primary job—signing up for shifts or assigning volunteers—cannot be accomplished.

---

### 2. Missing Static File Serving

**Severity:** Critical  
**Finding:** src/server.js has no middleware to serve static files from the /public directory and no GET / route to serve index.html to users.

**Validation:** Review of server.js shows:
- express.json() middleware for POST bodies
- session middleware
- Only /api/* routes that return JSON
- No `app.use(express.static(...))` or GET / handler
- No way for a browser to access index.html

**Impact:** Even if the HTML were complete, the server would not serve it to users visiting the root URL.

---

### 3. Product Requirements vs. Architecture Conflict

**Severity:** Critical  
**Finding:** Fundamental contradiction between stated requirements and architectural design:

- **PRODUCT.md Success criterion:** "A volunteer can see which shifts still need cover and sign up for one themselves"
- **ARCHITECTURE.md Design decision:** "Assignment is a coordinator action. Volunteers do not write to the rota."
- **Server endpoints:** All shift mutation endpoints (/api/shifts/:id/assign, /api/shifts/:id/unassign) require `requireCoordinator` role

The implemented system restricts all shift assignments to the coordinator. Volunteers cannot self-sign-up as stated in the product requirements.

**Impact:** The core success criteria cannot be met by the current implementation.

---

## Other Observations

### UX Walkthrough Misalignment
The ux-walkthrough.md describes the primary job as "the coordinator assigns a volunteer to a shift" and walks through coordinator-only flows. This aligns with the architecture but contradicts PRODUCT.md's statement that volunteers self-sign up. The walkthrough appears reconstructed from the implemented code rather than derived from the original brief.

### What Was Not Checked
- **Runtime behavior:** Could not start the application to test actual functionality due to missing frontend and static file serving.
- **Code audit:** The product-build skill (engineering-assessment) was not run due to the blocking architectural issues.
- **API contract testing:** Could not verify API behavior due to inability to serve the UI and test against real flows.
- **Security properties:** Could not test session handling, CSRF protection, or input validation in context.

---

## Next Steps

Before resubmission, the team must:

1. **Clarify product intent:** Confirm with the volunteer coordinator and volunteers whether:
   - Volunteers should self-sign up (matching PRODUCT.md), OR
   - Coordinator assigns all volunteers (matching current implementation)

2. **Implement the missing frontend:** Build the HTML, CSS, and JavaScript UI to support the chosen model, including:
   - Sign-in form
   - Shift list display
   - Appropriate assignment/sign-up interface per the intent
   - Error states and loading states
   - Mobile-responsive design per design-direction.md

3. **Add static file serving:** Configure the Express server to serve static assets from /public and the index.html at GET /.

4. **Reconcile documentation:** Update PRODUCT.md, ARCHITECTURE.md, and ux-walkthrough.md to reflect the single, consistent design.

---

## Gate Status

The acceptance gate (accept-check.js) was not run due to critical blockers that would prevent any meaningful gate result. These blocking issues must be resolved first.
