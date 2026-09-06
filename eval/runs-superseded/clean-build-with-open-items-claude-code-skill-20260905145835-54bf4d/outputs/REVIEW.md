# Release verdict: BLOCK

**Reviewed:** Independent acceptance review  
**Verdict date:** 2026-09-05  
**Acceptor context:** Separate from builder

## Executive summary

The room booking tool cannot be deployed in its current state. Three critical architectural failures prevent the product from meeting its primary job: staff cannot book meeting rooms because the necessary system components are not implemented.

---

## Verification approach

1. **Gate check:** Attempted `accept-check.js` (CommonJS/ESM incompatibility with workspace)
2. **Code audit:** Reviewed all source files (`server.js`, `validate.js`, `bookings.js`, `calendar.js`, `public/index.html`)
3. **Backend tests:** Passed (9/9 unit tests for validation and booking logic)
4. **Architecture check:** Compared implementation against ARCHITECTURE.md and PRODUCT.md
5. **UI walkthrough:** Attempted to verify steps from ux-walkthrough.md (blocked by implementation gaps)

---

## Blocking findings

### 1. No frontend UI exists (BLOCK)
**File:** `public/index.html`  
**Finding:** The HTML file contains only a skeleton — `<title>` and an empty `<main id="app">` container. There is no JavaScript code in the public directory, no CSS framework, no sign-in form, no booking interface, and no state management code.

**Evidence:** 
- `public/index.html` is 65 bytes (read: empty)
- No `.js`, `.jsx`, `.ts`, `.tsx`, or `.css` files exist in `public/`
- Walkthrough step 1 ("Open the page. The sign-in form is shown") cannot be performed

**Impact:** Users have no way to interact with the system. The primary job — "A member of staff can book a free room for a slot" — is impossible without a UI.

---

### 2. Server does not serve the frontend (BLOCK)
**File:** `src/server.js`  
**Finding:** The Express app has no static file serving middleware. There is no `app.use(express.static(...))`, no route handler for `GET /`, and no content-type handling for HTML. The server only responds to `/api/` endpoints with JSON.

**Evidence:**
```javascript
// src/server.js
app.use(express.json());
app.use(session({...}));
// ... API routes only
// app.use(express.static('public')) ← MISSING
```

**Impact:** Even if HTML and JavaScript were present, requests to `http://localhost:3000/` would return 404. Walkthrough step 1 fails: no sign-in form is shown.

---

### 3. Calendar service integration is not implemented (BLOCK)
**File:** `src/server.js` (missing implementation)  
**References:** `src/calendar.js`, ARCHITECTURE.md, PRODUCT.md  
**Finding:** 

The ARCHITECTURE.md explicitly states: *"Room availability is mastered by the building's calendar service. We read it and never write to it."*

The `calendar.js` file exports `roomsOutOfService(dateIso)` which fetches room availability from the calendar API. However:

1. **Function never imported:** `roomsOutOfService` is not imported into `server.js`
2. **Function never called:** No route handler calls it to check availability before booking
3. **No availability check:** POST `/api/bookings` (line 36-43) accepts any booking without verifying the room is available

**Consequence:** The booking endpoint (step 3 in walkthrough: "Book a free room and slot") creates bookings for rooms that may be out of service according to the calendar service. This violates ARCHITECTURE.md's core design principle and PRODUCT.md's constraint that room availability is "mastered by the building's calendar service."

**Evidence:**
```javascript
// src/calendar.js — defined but never used
export async function roomsOutOfService(dateIso) { ... }

// src/server.js — no import of calendar.js
import { validateBooking, isKnownStaff } from './validate.js';
import { bookingsFor, create, cancel } from './bookings.js';
// calendar.js is NOT imported

// POST /api/bookings — creates booking without checking calendar
app.post('/api/bookings', requireStaff, (req, res) => {
  const errors = validateBooking(req.body);
  if (errors.length > 0) return res.status(400).json({ errors });
  const booking = create(...); // no calendar check
```

---

## Conditional findings

### 4. Session cookie `secure: true` may block development (CONDITIONAL)
**File:** `src/server.js` line 23  
**Finding:** The session cookie includes `secure: true`, which requires HTTPS. This will cause sessions to fail over plain HTTP in development environments.

```javascript
cookie: { httpOnly: true, sameSite: 'lax', secure: true },
```

**Severity:** Medium — This is correct for production but will prevent testing over `http://localhost:3000`.

**Recommendation:** Use `process.env.NODE_ENV` to conditionally set `secure: process.env.NODE_ENV === 'production'` or similar.

---

### 5. Concurrent booking race condition (CONDITIONAL)
**File:** `src/bookings.js` lines 23-32  
**Finding:** The booking creation uses JSON file storage without file-level locking:

```javascript
export function create(staffId, booking) {
  const state = load();  // Read
  if (state.bookings.some(...)) return null;
  state.nextId = ...;
  state.bookings.push(record);
  save(state);  // Write
}
```

Two concurrent requests could:
1. Both `load()` and see no conflicting booking
2. Both proceed to `create()` and write overlapping bookings
3. One write overwrites the other

**Impact:** Double bookings possible under concurrent load (e.g., booking server under high office usage).

**Severity:** Medium — Unlikely in a small office (likely only a few concurrent users) but violates the PRODUCT.md requirement that double bookings are prevented.

---

## What was not checked

- **Runtime walkthrough replay:** Cannot perform ux-walkthrough.md steps (steps 1-5 blocked by missing UI and server configuration)
- **Adversarial checklist section B-D:** Cannot execute because the primary path is incomplete
- **Calendar service behavior:** Cannot test calendar integration without a running calendar service and deployed UI
- **Session persistence:** Cannot verify session handling works correctly
- **Empty/error/loading states:** Cannot verify because no UI to render states
- **Keyboard accessibility:** Cannot test without a UI
- **Stress testing:** Cannot test concurrent bookings at scale
- **Production readiness:** SESSION_SECRET is generated randomly in non-production environments (sessions lost on restart)

---

## Gate status

The `accept-check.js` gate could not be run due to Node.js module system incompatibility (CommonJS script in an ES module project). This did not change the verdict — the blocking findings are evident from code review alone.

---

## Conclusion

This product **cannot ship** in its current state. The implementation is missing three architectural components that are prerequisites for any user-facing functionality:

1. **Frontend UI** — Required to perform any user action
2. **Server static file serving** — Required to deliver the UI
3. **Calendar service integration** — Required to meet architectural constraints and prevent out-of-service bookings

All three are not optional enhancements; they are documented as part of the MVP in PRODUCT.md, ARCHITECTURE.md, and ux-walkthrough.md.

**Recommendation:** Return to the builder with a request to implement the frontend UI, connect static file serving, and integrate the calendar service before the next acceptance review.

---

## Artifacts checked

- ✅ PRODUCT.md — Provenance: "Written from the office manager's brief" (intent-anchored)
- ✅ ARCHITECTURE.md — Core design reviewed
- ✅ design-direction.md — UI design spec reviewed  
- ✅ ux-walkthrough.md — Primary job path documented (implementation missing)
- ✅ src/server.js — API layer reviewed
- ✅ src/validate.js — Input validation reviewed  
- ✅ src/bookings.js — Data layer reviewed
- ✅ src/calendar.js — Calendar integration stub reviewed
- ✅ public/index.html — Frontend skeleton reviewed
- ✅ test/ — 9/9 unit tests pass (backend only)
