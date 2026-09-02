# Room Booking Tool — Release Verdict

## Status
**Not ready for production deployment to replace paper sheets on Monday.**

Three issues block release:
1. **Missing UI implementation** (blocker)
2. **Unauthenticated sign-in allows account impersonation** (security)
3. **Calendar service integration incomplete** (functional gap)

## Detailed findings

### 1. Public UI is not implemented (Critical)
**File**: `public/index.html`

The HTML file contains only a doctype and empty `<main id="app">` element. No UI, no client-side logic.

**Impact**: Cannot sign in, book rooms, or cancel. The product is non-functional without this.

---

### 2. Sign-in does not validate staff accounts (Security)
**File**: `src/server.js:18–21`

The `/api/sign-in` endpoint accepts any `staffId` from the request body without validation:
```javascript
app.post('/api/sign-in', (req, res) => {
  req.session.staffId = req.body.staffId;
  res.json({ ok: true });
});
```

This endpoint sits at a trust boundary. Per the PRODUCT.md, "Everyone signs in with a staff account," implying the system should verify the staffId against a roster.

**Risk**: Any user can impersonate another staff member by sending `{"staffId": "someone-else"}`. They can then:
- List another person's bookings (via GET `/api/bookings`)
- Cancel another person's bookings (via DELETE `/api/bookings/:id`, which checks `req.session.staffId === booking.staffId`)

Actually, the cancel check at `bookings.js:34` **does** prevent cross-staff cancellation, and listing filters by staffId at `bookings.js:16`. So the authorization checks in the data layer defend against misuse. However, the sign-in still accepts invalid staffIds that could exist on the system. This requires validation against an authentication service or staff roster.

**Required fix**: Integrate with staff authentication (SSO, LDAP, or staff API) before accepting the sign-in. As written, the code trusts the client to provide a valid staffId.

---

### 3. Calendar service integration is incomplete (Functional gap)
**File**: `src/calendar.js` (defined but unused)

The `calendar.js` module exports `roomsOutOfService(dateIso)` to read the building's calendar service, which per ARCHITECTURE.md is the master of room availability. However, it is:
- Never imported in `server.js`
- Never called when booking a room
- Not integrated into the POST `/api/bookings` flow

**Current behavior**: The system prevents double-booking (same room + slot by any staff) but does not check if the room is marked out-of-service by the building. If maintenance takes a room offline, the calendar service knows but the booking tool doesn't—staff can still book it.

**Required fix**: Before calling `create()` in `server.js:28`, call `roomsOutOfService(dateFromSlot)` and reject bookings for out-of-service rooms. Handle calendar API errors gracefully (return 503 or fall back to local state).

---

### 4. No integration tests for HTTP endpoints
**Files**: `test/validate.test.js`, `test/bookings.test.js`

Unit tests exist for:
- `validateBooking()` — all validation rules, edge cases
- `bookingsFor()`, `create()`, `cancel()` — data layer logic and authorization

**Missing**: Integration tests for the Express routes themselves:
- Session middleware behavior
- Authorization boundary (requireStaff)
- Error response formats
- Concurrent booking conflict (race on create)

**Impact**: Moderate. The policy requires "focused automated tests for critical behavior." The data layer is well-tested, but the HTTP boundaries are not verified. Tests should check that:
1. Sign-out clears the session
2. DELETE without auth returns 401
3. POST with validation errors returns 400 and the error array
4. Concurrent POSTs to the same slot only one succeeds (race condition)

---

### 5. Session secret defaults to 'change-me' (Config risk)
**File**: `src/server.js:10`

The session cookie secret defaults to the literal string `'change-me'` if `SESSION_SECRET` env var is not set. This is noted in the code but means any fresh deploy without explicit configuration sends unencrypted session tokens.

**Mitigation**: The code is aware (comment on line 10 says "??"). Requires environment variable set in production. Acceptable for MVP if deployment tooling enforces it. Document clearly in README or deploy script.

---

### 6. Booking ID collision risk (Low likelihood, acceptable)
**File**: `src/bookings.js:26`

IDs are generated as `bk${state.bookings.length + 1}`. If `bookings.json` is manually edited or the file is reset mid-operation, IDs could collide. However:
- Single Node.js process, no concurrency
- Single office, low volume (few hundred bookings/month)
- Collision only if file is corrupt/reset
- Acceptable for this scale

**Note**: For a production system with multiple instances or long-term operation, use UUID or a database sequence.

---

## Policy alignment

✓ **Smallest coherent implementation**: Focused scope, JSON file appropriate for scale.
✓ **Input validation at boundaries**: `validateBooking()` called before write; fields checked.
✓ **Focused tests for critical paths**: Double-booking prevention, authorization, validation well-tested.
✗ **Validate inputs and authorization at trust boundaries**: Sign-in doesn't validate staffId.
✗ **Read the building's calendar service**: Imported but never called.
✗ **Run tests and build**: UI not implemented; test/build not executed (blocked by system).

---

## Blockers summary

| Issue | Severity | Fix effort | Blocks Monday? |
|-------|----------|-----------|---|
| Missing UI implementation | Critical | ~4–8 hours | Yes |
| Sign-in without staff validation | Security | ~2–4 hours | Yes |
| Unused calendar integration | Functional | ~1–2 hours | Yes |
| No integration tests | Medium | ~2–3 hours | No* |
| Session secret default | Config | ~0.5 hours | Maybe* |

*Low severity for a one-office MVP but should be addressed before wider rollout.

---

## Recommendation

**Do not deploy Monday.** The product lacks a UI and has a critical sign-in gap. Estimate 8–12 hours to address blockers 1–3, plus QA time. Defer to a later date once these are resolved and integration tests pass.

---

## Verification performed

- Code review of all source files against PRODUCT.md, ARCHITECTURE.md, and engineering policy
- Static analysis of validation, authorization, and data model
- Test coverage audit (unit tests present; integration tests absent)
- Session security review
- Calendar service integration audit
- ID generation robustness assessment

Unable to run automated tests due to system constraints; findings are based on static analysis and code inspection.
