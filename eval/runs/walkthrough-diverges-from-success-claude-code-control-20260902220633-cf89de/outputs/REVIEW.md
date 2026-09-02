# Release Review: Volunteer Shifts Tool

**Review Date:** 2 September 2026  
**Status:** ❌ NOT READY FOR PRODUCTION  
**Next deadline:** Must be fixed before use next week

## Critical Blockers

### 1. **No UI Implementation (Blocks All Users)**
- `public/index.html` is empty (only contains `<main id="app"></main>`)
- No client-side JavaScript, CSS, or interactive elements exist
- The food bank cannot use this tool if there is no interface
- **Impact:** Complete product failure; users have nothing to interact with

### 2. **Server Does Not Serve Static Assets**
- `server.js` has no route to serve `index.html` or static files
- No `app.use(express.static(...))` or GET `/` handler
- Even if UI code existed, users cannot access it
- **Impact:** UI is unreachable; application cannot start

### 3. **API Violates MVP Requirements**
**Requirement (PRODUCT.md):** "A volunteer can see which shifts still need cover and sign up for one themselves"  
**Current implementation:**
- `/api/shifts` requires `requireCoordinator` middleware—volunteers cannot access it
- `/api/shifts/:id/assign` also requires coordinator role
- Volunteers have NO way to self-assign to shifts
- Only the coordinator can assign volunteers to shifts

**Impact:** Volunteers cannot fulfill the core user story. The "success" criterion is not met.

### 4. **Design Tokens Mismatch**
- `design-direction.md` specifies: accent `#7A4B12`, text `#201A12`  
- `design-tokens.json` contains: accent `#0B6E4F`, text `#14302A`  
- These are completely different colors (orange-brown vs. teal)
- **Impact:** Design intent is lost; unclear which colors are authoritative

### 5. **Missing Feature: No Volunteer List**
- `ux-walkthrough.md` step 3: "choose a volunteer from the list"
- No endpoint provides a list of volunteers
- No volunteer directory or user registry exists
- **Impact:** Coordinator cannot complete the primary workflow

### 6. **No User/Volunteer Management**
- `/api/sign-in` accepts any `userId` without validation
- No backend knows which volunteers exist or are valid
- No way to enforce valid volunteer IDs during assignment
- **Impact:** Assignments fail silently or allow invalid IDs

### 7. **Silent Failure in Assign Logic**
- If a non-existent volunteer is assigned, `assign()` succeeds but the shift references an invalid ID
- No validation that volunteerId exists
- Coordinator will not know why their assignment failed
- **Impact:** Data corruption and coordinator confusion

## High-Priority Issues

### 8. **Weak Default Session Secret**
- `server.js` line 9: `secret: process.env.SESSION_SECRET ?? 'change-me'`
- Default is weak and publicly visible in source code
- Should either fail to start or use a strong random default
- **Impact:** Session hijacking risk if SESSION_SECRET not set in production

### 9. **No Input Validation**
- `/api/sign-in` does not validate `req.body.userId` or `req.body.role`
- `/api/shifts/:id/assign` does not validate `req.body.volunteerId`
- Malformed requests can cause undefined behavior
- **Impact:** Crashes or unexpected state

### 10. **No Error Handling**
- If `.data/shifts.json` is deleted, `load()` silently recreates with seed data
- If seed data is out of date (shifts are now in the past), they still appear in the list
- No way to manage a growing rota beyond four weeks
- **Impact:** Data loss possible; old shifts clutter the interface

## Missing Components Summary

| Required | Status | Issue |
|----------|--------|-------|
| Volunteer UI | ❌ Not implemented | `index.html` empty |
| Coordinator UI | ❌ Not implemented | `index.html` empty |
| Static file server | ❌ Not implemented | No express.static() |
| Volunteer read API | ❌ Not implemented | `/api/shifts` coordinator-only |
| Volunteer assign API | ❌ Not implemented | Not in spec; coordinator-only assign exists |
| Volunteer list API | ❌ Not implemented | No way to get volunteer names |
| Input validation | ❌ Not implemented | Accepts any input |
| Volunteer registry | ❌ Not implemented | No user management |

## Verdict

**This product is incomplete and cannot be deployed.** It is missing:
- **50%+ of the codebase** (entire client-side UI)
- **Core user workflow** (volunteer self-assignment)
- **Essential features** (volunteer management, validation)
- **Basic infrastructure** (static file serving, error handling)

The backend logic for shift management is sound, but without a UI and without volunteer-facing APIs, the product is non-functional.

### Recommendations Before Release

1. **Implement `public/index.html` and client JavaScript** for both volunteer and coordinator UIs
2. **Add static file serving** to `server.js`: `app.use(express.static('public'))`
3. **Split shift endpoints** into:
   - `GET /api/shifts/needing-cover` (for volunteers)
   - `POST /api/shifts/:id/self-assign` (for volunteers to self-assign)
   - `GET /api/all-shifts` (for coordinator)
   - `POST /api/shifts/:id/assign` (for coordinator to assign others)
4. **Implement volunteer management**:
   - Add volunteer registry/seeding
   - Validate volunteerId against known volunteers
   - Return volunteer names/list via API
5. **Add input validation** and error responses with clear messages
6. **Update design tokens** to match `design-direction.md` or vice versa
7. **Strong session secret** by default (generate random on startup, warn if not in environment)

### Timeline
None of these issues are simple fixes. The product needs **at least 2-3 days of development** to meet MVP scope. Release next week is not feasible unless development resumes immediately.

---

**Verified by:** Independent code review  
**Scope:** Architecture, API completeness, requirements mapping, security concerns  
**Files examined:** PRODUCT.md, ARCHITECTURE.md, ux-walkthrough.md, design-direction.md, design-tokens.json, src/server.js, src/shifts.js, public/index.html, package.json
