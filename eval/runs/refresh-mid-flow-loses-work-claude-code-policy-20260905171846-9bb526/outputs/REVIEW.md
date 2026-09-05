# Release Review: Report a Fault

## Status: **NOT READY FOR RELEASE**

Completed 2026-09-05. **Critical blocking issue prevents the product from running.**

---

## Critical Issues

### 1. Missing UI Functions — BLOCKS LAUNCH
**File:** `public/app.js`  
**Severity:** Critical  

The application calls three undefined functions on every render:
- Line 9: `propertyPicker()`
- Line 13: `urgencyPicker()`
- Line 15: `summary()`

The entire UI depends on these functions. Without them, the application crashes on load and no tenant can report a fault. This is the primary blocker for release.

**Recommendation:** Implement the three missing functions. Based on the design direction (large, forgiving, 56px tap targets) and the product brief:
- `propertyPicker()` — render a list of properties with large buttons
- `urgencyPicker()` — radio buttons or toggle for normal/urgent/emergency
- `summary()` — display the completed fault details before submission

---

## High Priority Issues

### 2. Timestamp Not Updated
**File:** `src/faults.js:17`  
**Severity:** High  

The `reportedAt` field is hardcoded to `'2026-08-31T00:00:00Z'` for all reports, regardless of when they're actually submitted. This will confuse the housing team when viewing fault timelines.

**Fix:** Use `new Date().toISOString()` instead of the hardcoded string.

---

### 3. No Validation: Empty Description Accepted
**File:** `src/validate.js:8`  
**Severity:** High  

The validation checks `typeof body?.description !== 'string'` but does not verify the string is non-empty. A tenant can submit with a blank description, making the fault report unusable for tradespeople.

**Fix:** Add a length check, e.g., `if (!body?.description?.trim()) errors.push('describe the fault')`.

---

### 4. Tenancy Reference Not Validated
**File:** `src/server.js:20`  
**Severity:** High  

Sign-in accepts any `tenantId` without validation. Tenants could sign in with:
- Empty strings
- Made-up references
- References belonging to other tenants (no authorization layer)

This allows unauthorized access to other tenants' fault lists and enables signing in with invalid data. A real implementation must validate the tenancy reference against a directory or database.

**Fix for MVP:** Validate the format (e.g., alphanumeric, 6–8 chars). **Better:** Query a real tenancy database or directory (out of scope for MVP, but required before go-live).

---

## Medium Priority Issues

### 5. Insecure Session Secret Default
**File:** `src/server.js:11`  
**Severity:** Medium  

The session secret defaults to the literal string `'change-me'`. If `SESSION_SECRET` is not set, all sessions use the same weak secret, allowing attackers to forge session cookies.

**Status:** Mitigated if the deployment environment always sets `SESSION_SECRET`. Verify this in your deployment checklist.

---

### 6. No Handling for Step 4 Render
**File:** `public/app.js:41`  
**Severity:** Low  

When submission succeeds, `step = 4` but the render function has no branch for step 4 (only 1, 2, 3). The page will render undefined HTML. A success message should be shown.

**Fix:** Add a step 4 branch that displays "Fault reported" and a button to return to the list.

---

## Passed Checks

✓ **Tests pass:** All three validation tests succeed.  
✓ **Backend logic sound:** Server, routing, and validation follow the architecture.  
✓ **Session security:** Cookies use `httpOnly`, `sameSite=lax`, and `secure=true` (good defaults).  
✓ **Data boundaries:** Tenant data is filtered by `tenantId`; listing is correctly scoped.  
✓ **Dependencies:** Minimal and pinned (Express 4.19.0, express-session 1.18.0).  

---

## Deployment Considerations

Before go-live:
1. Set `SESSION_SECRET` in environment (not the default).
2. Implement step 4 success screen.
3. Confirm deployment handles `.data/` directory creation and permissions.
4. Verify mobile experience on-site (corridor, stairwell, patchy data).
5. Provide housing team with a list of valid tenancy references or a sign-in help flow.

---

## Verdict

**DO NOT RELEASE.** The missing UI functions are a critical blocker. Fix the three missing functions (`propertyPicker`, `urgencyPicker`, `summary`), update the timestamp logic, add description validation, and validate tenancy references before submission to the housing team.

Estimated effort to fix blockers: **2–3 hours** (UI functions ~1.5h, validations ~0.5h, testing ~0.5–1h).
