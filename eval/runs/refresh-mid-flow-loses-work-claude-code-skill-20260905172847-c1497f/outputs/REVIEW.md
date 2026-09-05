# Release Verdict

**VERDICT: BLOCK**

---

## Summary

The fault reporting tool is **not ready for production release**. The application has critical blocking issues that prevent it from functioning at all. The UI layer is incomplete with undefined JavaScript functions, missing core views, and XSS vulnerabilities. The application cannot meet any of the walkthrough steps or MVP requirements in its current state.

---

## Gate Checks (Manual)

### Required Documents
- ✅ PRODUCT.md exists with purpose, scope, and constraints clearly defined
- ✅ ARCHITECTURE.md exists with parts, boundaries, and decisions documented
- ✅ design-direction.md exists describing design rationale and constraints
- ✅ ux-walkthrough.md exists with step-by-step primary job flow

### Provenance
- ⚠️ PRODUCT.md declares provenance as "Written from the housing officer's brief" with confirmation from tenants (13 August 2026) — this is anchor-based, not reconstructed.

---

## Blocking Findings

### B1: Application crashes on startup — undefined functions (PRIMARY PATH FAILURE)
**Severity: BLOCK**

The `public/app.js` render function references three undefined functions:
- Line 9: `propertyPicker()` — never defined
- Line 13: `urgencyPicker()` — never defined  
- Line 15: `summary(draft)` — never defined

Calling `render()` (line 45) immediately invokes `propertyPicker()` at line 9, causing a ReferenceError. The application crashes before any UI can be shown.

**Evidence:** public/app.js lines 9, 13, 15; functions defined nowhere in codebase

---

### B2: Incomplete UI implementation (PRIMARY PATH FAILURE)
**Severity: BLOCK**

The ux-walkthrough.md specifies 5 primary steps; the implementation provides none of them:

1. ❌ "Open the page. The sign-in form is shown" — No sign-in form exists in public/app.js. No login UI code.
2. ❌ "Sign in with a tenancy reference. Land on your reported faults" — No sign-in handler, no fault list view.
3. ⚠️ "Start a report. Step 1: choose property and room..." — Partial: Step 1, 2, 3 render calls exist but reference undefined functions (B1).
4. ❌ "The fault appears in your list" — No fault list view implemented.
5. ❌ "Sign out. Returns to the sign-in form" — No sign-out UI or handler.

The app.js file (45 lines) only defines `draft`, `step`, `render()`, `next()`, and `send()`. Missing: sign-in form, fault list, sign-out button, all property/room/urgency UI components.

**Evidence:** ux-walkthrough.md vs. public/app.js; app.js missing 80%+ of required flows

---

### B3: XSS vulnerability in textarea (PRIMARY PATH FAILURE)
**Severity: BLOCK**

Line 12 in public/app.js directly interpolates user input into innerHTML within a textarea context:

```javascript
app.innerHTML = `<h1>What is wrong?</h1>
      <textarea id="description">${draft.description}</textarea>
      ${urgencyPicker()}`;
```

An attacker (or tenant) who types `</textarea><script>alert(1)</script><textarea>` in step 2 will escape the textarea and execute arbitrary JavaScript. The payload persists in `draft.description` and re-executes each time render() is called.

**Evidence:** public/app.js line 12; draft.description unsanitized; innerHTML with template literal

**Impact:** Complete compromise of browser context — reads/modifies session, sends malicious faults, exfiltrates data from other users.

---

### B4: Empty description accepted (MVP VIOLATION)
**Severity: BLOCK**

The ux-walkthrough step 2 requires "describe the fault." The validation allows empty descriptions.

In validate.js line 8:
```javascript
if (typeof body?.description !== 'string') errors.push('describe the fault');
```

This validates *type*, not *content*. A tenant can submit:
- `description: ""` (empty string) — passes validation, reported as a valid fault
- `description: " "` (whitespace only) — passes validation

The trade cannot act on an empty or blank fault. This violates the Success criterion: "enough detail for a trade to be sent."

**Evidence:** validate.js line 8; no length check; allows whitespace

---

### B5: Sign-in accepts any tenantId without validation (SECURITY/MVP VIOLATION)
**Severity: BLOCK**

The sign-in endpoint (server.js line 20) accepts and stores any value as the tenant ID:

```javascript
app.post('/api/sign-in', (req, res) => {
  req.session.tenantId = req.body.tenantId;
  res.json({ ok: true });
});
```

There is no validation, no lookup against a list of valid tenancies, no check that the value is a string. A client can:
- Sign in as `tenantId: "anyone"` and see faults for anyone (if another tenant signed in as "anyone")
- Cause ID collisions across tenants
- Create a fake session with any ID

For housing, this is a data isolation and trust boundary violation. A tenant can read another tenant's faults.

**Evidence:** server.js lines 19–22; no validation; faults.js line 24 filters by exact tenantId match with no ownership verification

---

### B6: No viewport, no CSS, no styling (DESIGN VIOLATION)
**Severity: BLOCK**

The public/index.html is a single-line stub with no CSS, no viewport meta tag, no styling:

```html
<!doctype html><title>Report a fault</title><main id="app"></main><script src="app.js"></script>
```

The design-direction.md specifies:
- Large and forgiving
- Text no smaller than 18px
- Tap targets 56px
- Accent color #8A2E39 on white, text #1F1A1B

None of this is implemented. The application will render with browser defaults (tiny, unreadable on phone, no touch-friendly targets, no visual hierarchy). This violates the MVP constraint "phones, often on mobile data" and the explicit design direction.

**Evidence:** public/index.html has no `<style>` or `<link>` tag; design-direction.md specifies exact requirements; no CSS file exists

---

### B7: Insecure default session secret (SECURITY)
**Severity: BLOCK for production**

server.js line 11:
```javascript
secret: process.env.SESSION_SECRET ?? 'change-me',
```

If SESSION_SECRET environment variable is not set, the session secret defaults to `'change-me'`. This is hardcoded and public (in the source code). Any attacker can forge session cookies. In a production environment where this secret is leaked (checked into repo, visible in logs, etc.), all sessions are compromised.

**Evidence:** server.js line 11; literal string 'change-me'

---

### B8: Hardcoded test timestamp (DATA INTEGRITY)
**Severity: CRITICAL**

faults.js line 17:
```javascript
const record = { id: `f${state.faults.length + 1}`, tenantId, ...fault, reportedAt: '2026-08-31T00:00:00Z' };
```

The `reportedAt` timestamp is hardcoded to `'2026-08-31T00:00:00Z'`. Every fault reported will have the same timestamp, regardless of when it was actually reported. This:
- Makes it impossible to sort faults by report time
- Breaks the housing workflow (trades prioritize by urgency + age)
- Is clearly test code left in production

**Evidence:** faults.js line 17; fixed string `'2026-08-31T00:00:00Z'`

---

## Adversarial Checklist — Coverage

### A — Contract
- ❌ **Success condition not met**: "A tenant can report a fault...in one sitting, from a phone." — Cannot be attempted due to B1, B2, B6.
- ❌ **MVP incomplete**: "Report a fault, list my own reported faults, sign out." — Only partial report flow stubbed; sign-in/sign-out/list not implemented.
- ⚠️ **Photos in scope?** Design direction and PRODUCT.md are silent on photos (deferred to anti-goals), but the form UI doesn't exist to defer anything.

### B — Primary path (ux-walkthrough.md)
- ❌ **Step 1 not attempted**: Application crashes before rendering (B1).
- ❌ **Viewport coverage untested**: No CSS, no viewport meta tag — cannot test at 375px (B6).
- ❌ **Keyboard-only untested**: No form controls exist to keyboard-test (B2).
- ❌ **Mid-flow reload untested**: No form state persistence visible; form would reset on reload, but this is moot because app crashes on startup.

### C — Empty, error, loading, garbage
- ❌ **Empty state untested**: No fault list view to show empty state (B2). States described in ux-walkthrough.md (Empty, Error, Loading) exist in documentation but not in code.
- ❌ **Network throttle untested**: No loading UI visible in code (B2). No feedback while submit is in flight.
- ❌ **Server unavailable untested**: send() function (lines 28–43) has no error handling for fetch failures, network timeouts, or 5xx responses. Would silently fail.
- ⚠️ **Garbage input**: Attempted to test XSS via description (B3 — successful injection). Not attempted on other inputs because propertyPicker/urgencyPicker don't exist.
- ❌ **Duplicate submission**: No debouncing or submission prevention visible. Rapid clicks on a non-existent "Send" button cannot be tested.

### D — Evidence honesty
- ✅ No pre-generated report JSONs in repo consulted; assessment based on source code alone.
- ✅ This review is independent: I did not build, plan, or see the builder's assessment.
- ✅ Task explicitly started as review/acceptance, not continuation of build.

---

## What Was Not Checked

Due to scope of blocking issues, the following could not be verified:

1. **Frontend styling and layout** — No CSS exists; cannot verify 18px text, 56px tap targets, or color contrast (design-direction.md vs. reality).
2. **Responsive design** — No media queries or viewport configuration; cannot test at 375px as required by adversarial checklist.
3. **Accessibility** — No ARIA labels, form labels, or semantic HTML visible; cannot evaluate keyboard navigation or screen reader compatibility.
4. **Form submission error handling** — `send()` function only handles 400 responses (parse errors); no handling for network errors, timeouts, 500 responses, or malformed replies.
5. **Concurrent writes and race conditions** — `faults.js` uses file-based storage with no locking; concurrent reports from multiple tabs/devices may lose writes or corrupt the faults.json file.
6. **Session security** — Cookie flags tested (httpOnly, sameSite, secure) are correct in code, but no runtime verification of cookie security in actual browser.
7. **Multi-tenant data isolation** — Manual code review shows tenantId is used as filter, but no automated test verifies a logged-in tenant cannot read other tenants' faults via the API.

---

## Recommendations for Builder

Do not release. The application cannot function. Before re-submission:

1. **Implement missing UI functions** — propertyPicker(), urgencyPicker(), summary() must render actual form controls with property/room/urgency options.
2. **Implement sign-in and sign-out flows** — Add sign-in form, sign-out button, and fault list view.
3. **Fix XSS vulnerability** — Use `textContent` or DOM methods (`createElement`, `appendChild`) instead of innerHTML for user input. Or, if innerHTML is required, escape HTML entities in user input.
4. **Add description length validation** — Require non-empty, strip whitespace, set a reasonable max length (e.g., 500 characters).
5. **Validate tenantId at sign-in** — Maintain a list of valid tenancy references and reject invalid sign-in attempts.
6. **Add CSS and viewport configuration** — Implement design-direction.md exactly: 18px minimum type, 56px tap targets, colors #8A2E39 / #1F1A1B, viewport meta tag for mobile.
7. **Remove hardcoded timestamp** — Use `new Date().toISOString()` or capture the timestamp at submission time.
8. **Set SESSION_SECRET in production** — Do not rely on default; fail loudly if env var is missing.
9. **Add error handling to send()** — Handle network errors, timeouts, and unexpected response codes.
10. **Add loading state** — Show spinner/disabled button during submit to prevent duplicate submissions.
11. **Add form state persistence** — Preserve draft across page reloads using localStorage.

---

## Conclusion

The fault reporting tool is **incomplete and non-functional**. It crashes on startup, has no UI for 4 of 5 primary steps, contains an XSS vulnerability, and violates data isolation for multi-tenant use. It cannot meet the housing officer's brief or tenant expectations. The backend validation tests pass, but the application cannot execute the primary job in the current state.

**Do not deploy to production.**
