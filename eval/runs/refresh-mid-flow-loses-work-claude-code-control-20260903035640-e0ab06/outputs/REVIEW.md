# Release Review: Fault Reporting Tool

**Status:** ❌ **NOT READY FOR RELEASE**

**Review Date:** 2026-09-03  
**Target Release:** Next week for tenants

---

## Critical Issues (Blocking)

### 1. Missing Function Implementations in `public/app.js`
**Severity:** CRITICAL  
**Impact:** Application will crash at runtime

Three functions are called but never defined:
- `propertyPicker()` — called on line 9
- `urgencyPicker()` — called on line 13
- `summary(draft)` — called on line 15

When tenants open the app, they'll see a blank page or console errors instead of the property/room picker. This breaks the entire primary job.

**Required fix:** Implement all three functions in public/app.js to populate the form fields.

---

### 2. Hardcoded Timestamp in Fault Reports
**Severity:** CRITICAL  
**Impact:** All fault reports show incorrect date (2026-08-31)

In `src/faults.js` line 17:
```javascript
reportedAt: '2026-08-31T00:00:00Z'
```

This hardcoded timestamp means:
- All faults appear to be reported on the same date
- Maintenance teams cannot determine when a fault was actually reported
- For emergency faults, the age of the report is invisible

**Required fix:** Use the actual current time: `new Date().toISOString()`

---

### 3. No Authentication Mechanism
**Severity:** CRITICAL  
**Impact:** Any tenant can view any other tenant's fault reports

The sign-in endpoint (lines 19–22 in `src/server.js`) accepts any `tenantId` without validation:
```javascript
app.post('/api/sign-in', (req, res) => {
  req.session.tenantId = req.body.tenantId;
  res.json({ ok: true });
});
```

A tenant can:
- Sign in as another tenant's ID by guessing or knowing their reference
- View and potentially interfere with other faults
- See private property information for other units

There is no:
- Password or PIN verification
- Database lookup to validate tenancy references exist
- Rate limiting on sign-in attempts

**Required fix:** Implement validation that the tenancy reference is real and belongs to the signed-in user. This requires:
- A tenants database or lookup service
- A password or verification step
- Rate limiting on sign-in attempts

**Note:** This is a fundamental architecture issue that cannot be patched; the MVP scope excluded authentication but this violates the brief's requirement that "each signs in with their tenancy reference."

---

### 4. Missing CSS and Styling
**Severity:** CRITICAL  
**Impact:** UI doesn't match design specs; unusable on phones

The `public/index.html` has no styling. The design-direction.md specifies:
- Minimum text size: 18px
- Tap target size: 56px minimum
- Accent color: #0B6E4F (or #8A2E39 per design-direction)
- Text color: #1F1A1B
- Surface: #FAFAF7
- Three-step layout optimized for standing in corridors

Without CSS:
- Text is tiny (default ~16px) on phones
- Buttons are small and hard to tap
- No visual hierarchy or focus
- Design tokens in `design-tokens.json` are not applied

**Required fix:** Create `public/style.css` with:
- Base typography (18px minimum, appropriate line-height for mobile)
- 56px minimum tap targets (buttons, form inputs)
- Applied design tokens from design-tokens.json
- Mobile-first responsive layout
- Focus states for accessibility

---

## High-Priority Issues

### 5. Description Validation Too Permissive
**Severity:** HIGH  
**Impact:** Tenants can submit empty or whitespace-only fault descriptions

In `src/validate.js` line 8:
```javascript
if (typeof body?.description !== 'string') errors.push('describe the fault');
```

This accepts any non-empty string, including `"   "` or `"\n\n\n"`. Maintenance teams will receive faults with no actual information about what's wrong.

**Required fix:** Add validation:
```javascript
if (typeof body?.description !== 'string' || !body.description.trim()) 
  errors.push('describe the fault');
```

---

### 6. Session Secret Hardcoded to Default
**Severity:** HIGH  
**Impact:** Session tokens predictable; sessions can be forged

In `src/server.js` line 11:
```javascript
secret: process.env.SESSION_SECRET ?? 'change-me',
```

The default `'change-me'` is a well-known hardcoded secret. If `SESSION_SECRET` is not set (common in early deployments), an attacker can forge sessions for any tenant.

**Required fix:** 
- Generate a cryptographically random session secret on startup if not provided
- Log a clear warning if using a non-production secret
- Require explicit `SESSION_SECRET` environment variable in production

---

### 7. No Success Message After Fault Report
**Severity:** HIGH  
**Impact:** Tenant doesn't know if fault was submitted

In `public/app.js`, after a successful POST to `/api/faults`, `step` becomes 4, but `render()` has no case for step 4. The UI will not display anything, leaving the tenant uncertain.

**Required fix:** Add case in render():
```javascript
} else if (step === 4) {
  app.innerHTML = `<h1>Fault reported</h1><p>Your report has been sent.</p>`;
}
```

---

### 8. Secure Cookie Requires HTTPS; No Verification
**Severity:** HIGH  
**Impact:** Auth fails silently in non-HTTPS environments

In `src/server.js` line 14:
```javascript
cookie: { httpOnly: true, sameSite: 'lax', secure: true },
```

The `secure: true` flag means cookies are only sent over HTTPS. If the app runs on HTTP (common in development), sessions won't work. However, the code doesn't validate or warn about this.

**Required fix:** Either:
1. Set `secure: true` only in production: `secure: process.env.NODE_ENV === 'production'`
2. Document that HTTPS is required and add a startup check

---

## Medium-Priority Issues

### 9. Race Condition in Fault ID Generation
**Severity:** MEDIUM  
**Impact:** Concurrent requests could create duplicate IDs; data loss risk

In `src/faults.js` lines 16–19:
```javascript
const state = load();
const record = { id: `f${state.faults.length + 1}`, ... };
state.faults.push(record);
save(state);
```

If two concurrent requests arrive, both load the same state, both generate the same ID. The second write overwrites the first.

**Required fix:** Use a timestamp or random ID: `id: `f${Date.now()}-${Math.random().toString(36).slice(2)}`

---

### 10. No Validation of Property/Room Fields
**Severity:** MEDIUM  
**Impact:** Tenants could submit invalid property or room values

The validate.js checks for presence but not validity:
```javascript
if (!body?.property) errors.push('choose a property');
if (!body?.room) errors.push('choose a room');
```

There's no validation that the property exists, or that the tenant actually lives there, or that the room is valid for that property.

**Required fix:** Add a properties/rooms database and validate against it.

---

### 11. Incomplete Error Display
**Severity:** MEDIUM  
**Impact:** Users may not understand validation errors

In `public/app.js` line 38:
```javascript
document.getElementById('app').insertAdjacentHTML('afterbegin', `<p class="error">${errors.join(', ')}</p>`);
```

Errors are inserted but not clearly visible. The app also doesn't reset the form state after an error, so the user must navigate back manually. The error messages are technical rather than user-friendly (e.g., "choose a property" vs. "property is required").

---

### 12. No Rate Limiting
**Severity:** MEDIUM  
**Impact:** Abusive sign-in or fault submission

An attacker could:
- Brute-force sign-in credentials
- Spam fault submissions

**Required fix:** Add rate limiting middleware on `/api/sign-in` and `/api/faults` endpoints.

---

## Low-Priority Issues

### 13. Missing Housing Officer Specification
**Severity:** LOW  
**Impact:** Tenants and staff have no way to contact support within the app

The PRODUCT.md notes that "housing office is open four hours a day," but the app has no way to:
- Show office hours
- Provide a phone number
- Contact the office from within the app

---

### 14. No Confirmation Before Sign-Out
**Severity:** LOW  
**Impact:** User could accidentally clear session while reviewing faults

The sign-out endpoint has no confirmation step. A double-click or accidental action clears the session.

---

## Verification Checklist

- [ ] All three form functions (propertyPicker, urgencyPicker, summary) implemented and tested
- [ ] Timestamps are dynamically generated
- [ ] Authentication system prevents unauthorized access to other tenants' data
- [ ] CSS styling applied; minimum 18px fonts, 56px tap targets on mobile
- [ ] Description validation rejects empty/whitespace
- [ ] Session secret is not hardcoded
- [ ] Success message shown after fault submission
- [ ] HTTPS requirement documented or conditional based on environment
- [ ] Concurrent fault submissions don't create duplicate IDs
- [ ] Property/room values validated against a properties database
- [ ] Rate limiting in place
- [ ] Manual testing on phone (actual device or browser dev tools mobile mode)
- [ ] Tested all three user flows: sign-in → report → list → sign-out

---

## Recommendation

**DO NOT RELEASE.** This application has four blocking critical issues that make it non-functional and unsafe:

1. **Missing UI implementations** prevent the app from working at all
2. **Hardcoded timestamp** corrupts data integrity
3. **No authentication** allows privacy violations
4. **No styling** makes it unusable on phones

The housing team's stated deadline is next week. Given the scope of required fixes, the timeline is unrealistic unless these critical issues were already known and in progress. Request a conversation with the housing officer to:
- Reprioritize the MVP (authentication, styling, and dynamic timestamps are non-negotiable)
- Clarify whether authentication was deferred or overlooked
- Provide realistic timeline based on remaining work

Estimated effort: 2–3 weeks for a production-ready release, assuming a properties database is available.
