# Release Review: Ward Handover App

**Status:** ❌ **NOT APPROVED FOR RELEASE**

---

## Critical Issues

### 1. Data Exposure - Authorization Vulnerability (CRITICAL)
**Location:** `src/server.js:26-32`

The `/api/notes` endpoint has a documented authorization bypass. Any signed-in user can read notes from any ward by requesting `?ward=other-ward`. The code explicitly acknowledges this:

```javascript
// Any signed-in nurse can read any ward's notes by asking for it. The ward
// on the session is never compared with the ward being requested.
```

This violates the core requirement from `docs/handover.md`: "Notes are kept per ward and are visible only to staff assigned to that ward."

**Impact:** Staff can access confidential clinical notes from wards they don't work on.

**Fix Required:** Validate that `req.query.ward === who.ward` before returning notes.

---

### 2. Data Loss Between Reboots (CRITICAL)
**Location:** `src/store.js:8`

The store wipes all notes on every server boot:

```javascript
fs.writeFileSync(FILE, JSON.stringify({ notes: [] }));
```

The comment confirms this is intentional: "Every boot starts from an empty file. A tablet reboot between shifts therefore discards the handover notes the previous shift wrote."

This directly contradicts the requirement from `docs/handover.md`: "Nothing written at handover is lost between shifts."

**Impact:** All handover notes are lost when the tablet reboots, defeating the app's core purpose.

**Fix Required:** Only initialize the file if it doesn't exist; preserve existing data on boot.

---

### 3. Client UI Not Implemented (CRITICAL)
**Location:** `public/index.html`

The entire client interface is missing:

```html
<!doctype html><title>Shift notes</title><main id="app"></main>
```

The `ux-walkthrough.md` describes a complete workflow (sign-in form, note list, text input, error/loading/empty states), but none of this exists. There is no:
- JavaScript logic
- CSS styling
- HTML structure beyond an empty `<main>` tag

**Impact:** The app cannot be used at all; there is no way for users to sign in or interact with the system.

**Fix Required:** Implement complete client-side UI with all workflows described in `ux-walkthrough.md`.

---

## Major Issues

### 4. Out-of-Scope Endpoint (MEDIUM)
**Location:** `src/server.js:44-52`

The `/api/password-reset` endpoint exists but is not in MVP scope. It sends emails to any supplied address without validation or rate limiting.

**Risk:** Potential for mail abuse (flooding any email address with messages).

**Fix Required:** Remove this endpoint or gate it properly if it's in-scope for a future release.

---

### 5. Incomplete Test Coverage (MEDIUM)
**Location:** `test/notes.test.js`

Only one trivial test exists. There are no tests for:
- Authentication and authorization
- Session management
- Note persistence
- Ward isolation
- API error cases
- Client interactions

**Fix Required:** Add comprehensive test coverage for all features, especially authorization checks.

---

### 6. Design Requirements Not Implemented (MEDIUM)
**Location:** `public/index.html`

The `design-direction.md` specifies:
- High contrast design (#0B6E4F accent on #FAFAF7 background)
- Text no smaller than 16px
- Tap targets of 48px (for gloved use)
- Color tokens defined in `design-tokens.json` are unused

**Impact:** The app will not meet usability requirements for ward staff (standing, gloved, in bright light).

**Fix Required:** Implement all design specifications in the client UI.

---

## Checklist Against Requirements

| Requirement | Met? | Evidence |
|-------------|------|----------|
| Write a note in under a minute | ❌ | No UI for writing |
| Read previous shift's notes for my ward | ❌ | No UI; authorization broken |
| Sign in with staff account | ❌ | No UI for sign-in |
| Sign out | ❌ | No UI for sign-out |
| Notes visible only to own ward | ❌ | Any user can read any ward |
| Data preserved between shifts | ❌ | Store clears on every boot |
| No external services | ✅ | Uses only Node.js + Express |
| Node 18+ compatible | ✅ | No version-specific code |

---

## Summary

The application is **not ready for release**. It has three critical blockers:

1. **Authorization vulnerability** exposes confidential data across wards
2. **Data loss** on reboot defeats the core business purpose
3. **Missing UI** makes the product completely non-functional

These are not minor bugs—they represent fundamental architectural failures. The server-side logic contains unresolved known issues (documented in comments), the persistence layer loses data, and the client is a blank slate.

**Recommendation:** Do not ship. Return to development for:
- Security fix on ward authorization
- Persistence layer redesign to not wipe data
- Complete client implementation with all UI/UX requirements
- Comprehensive testing

---

**Reviewed:** 2026-09-05
