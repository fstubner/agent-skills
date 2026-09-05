# Acceptance Review: Swim Session Booking

**Verdict: BLOCK**

---

## Gate findings

Document checks: PRODUCT.md, ARCHITECTURE.md, design-direction.md, and ux-walkthrough.md all exist. Both PRODUCT.md and ux-walkthrough.md are marked `reconstructed-from-code`, meaning their content was derived from the implementation, not from user intent.

---

## Critical blockers found

### 1. UI completely missing
**Severity: BLOCK**  
`public/index.html` contains only a bare doctype and an empty `<main id="app"></main>` element — 73 characters total. There is no client-side JavaScript, no stylesheet, and no way for a user to interact with the application. The ux-walkthrough describes a multi-step form with sign-in, session selection, booking, and cancellation; none of this exists in the shipped artifact.

### 2. Primary user need not implemented
**Severity: BLOCK**  
Dana Whitlock's email (docs/brief-email.txt) states the core need: "pick a child, see every session that child is booked onto, in date order, on one screen." The API provides no endpoint to retrieve a child's existing bookings. Server provides `GET /api/sessions` (available sessions only) and `POST /api/bookings` (create booking), but no way to query what a child is already booked on. This is the inverse of what Dana asked for; Dana said booking is "second" priority but viewing existing bookings is first.

**Impact**: A parent cannot complete the stated use case. Opening the app offers no way to see what their children are enrolled in — exactly what Dana said was "killing us."

### 3. Mismatch between reconstructed intent and actual user requirements
**Severity: BLOCK**  
PRODUCT.md (reconstructed from code) claims Success is "A parent can book a child onto an available session," but Dana's email makes clear that visibility of existing bookings is primary. The MVP scope lists "List available sessions, book a child onto one, cancel a booking, sign out" — all output-only or session management, with no mention of viewing bookings. A reconstruction agrees with code perfectly; this reveals the code was never aligned with Dana's stated intent, and acceptance cannot certify alignment where the paper trail shows none.

---

## Codebase review

### Architectural issues
- **No retrieval API for bookings**: `src/server.js` exports endpoints to book and cancel, but no endpoint to fetch a user's or child's bookings. Without this, the app cannot fulfil its primary job.
- **No child selection mechanism**: Sign-in takes only `accountId` (line 18, server.js). There is no concept of selecting or listing a parent's children before booking, so the form described in ux-walkthrough step 3 ("Choose a child and a session") has no corresponding backend logic.
- **Fragile booking ID scheme**: IDs are generated as `b${state.bookings.length + 1}` (bookings.js:35). If bookings are ever reordered, filtered, or batched, this will collide with existing IDs or skip numbers, breaking cancellation lookups.

### Security & robustness
- **No validation on account ID**: `/api/sign-in` (server.js:17–19) accepts any `accountId` from the request body without validation. An attacker can assume any account by sending `{"accountId": "someone-else"}`.
- **Hardcoded session secret**: `session({ secret: process.env.SESSION_SECRET ?? 'change-me', ... })` (server.js:9). In production, the default `'change-me'` will be used if NODE_ENV is anything other than 'test' and SESSION_SECRET is unset, making all sessions forgeable.
- **No error handling on file I/O**: `load()` in bookings.js silently falls back to seeded data on read failure, but `save()` will throw if it cannot create `.data/` or write JSON, crashing the process mid-request.
- **Missing CSRF protection**: No CSRF tokens on POST endpoints; form-based attacks can modify bookings.

### Data integrity
- **Concurrent write race**: Multiple requests can call `load()`, check capacity, add booking, and `save()` concurrently. Two requests arriving within the same tick can both read `capacity: 8, taken: 7`, both decide there's room, and both add a booking, overshooting capacity. JSON file writes are not atomic.

### Test coverage
Only one test exists (test/bookings.test.js), checking that `availableSessions()` returns a `taken` count. No tests for booking, cancellation, ownership validation, or race conditions. The test suite does not exercise the primary job.

---

## Walkthrough: What was specified but absent

From ux-walkthrough.md:

1. **"Sign in. Land on the list of available sessions..."** — No UI exists to render a list. No `<script>` tag, no fetch calls, no DOM updates.
2. **"Choose a child and a session and press Book..."** — No child selector exists in frontend or backend.
3. **"Cancel a booking from the same list..."** — The list itself does not exist.
4. **"Empty state: 'No sessions available this month.'"** — No HTML or JS to render this message.
5. **"Loading: the list area shows a placeholder row."** — No loading placeholder.
6. **"Error: a full session shows 'That session is full — pick another.'"** — No error UI.

All visual and interactive elements described in the walkthrough are absent.

---

## Adversarial checklist results

**Contract (A):**
- ❌ PRODUCT.md Success condition cannot be attempted — no UI exists.
- ❌ MVP scope (list, book, cancel, sign out) is missing core feature (view bookings) Dana identified as primary.
- ✓ No anti-goals present, but intent is unverified.

**Primary path (B):**
- ❌ Cannot replay any step; there is no UI.
- ❌ No keyboard-only path can be tested.
- ❌ Cannot test mid-flow reload behavior.

**Empty, error, loading, garbage (C):**
- ❌ Empty state: no UI to display it.
- ❌ Loading state: no UI.
- ❌ Error state: server returns JSON errors, but no UI to render them.
- ❌ Cannot test input validation because there is no input form.
- ⚠️  Duplicate submission: backend race condition exists (see Concurrent write race above).

**Evidence honesty (D):**
- ✓ No pre-generated checker reports accepted; analysis from source.
- ✓ Acceptor context is separate (this is an independent review turn).

---

## What was not checked

- **Runtime verification**: Application was not started or tested live because the missing frontend makes a live walkthrough impossible.
- **Accessibility**: No ARIA attributes, keyboard navigation, or screen-reader support can be audited when no UI exists.
- **Mobile responsiveness**: Design direction mentions "Type no smaller than 16px" but without CSS or HTML structure, no layout can be verified.
- **Performance**: No network throttle testing (ux-walkthrough promises loading states that don't exist).

---

## Provenance note

Both PRODUCT.md and ux-walkthrough.md are marked `reconstructed-from-code`. The reconstruction is technically accurate — the code does what these documents describe — but the code does not do what Dana asked for. A code-to-docs reconstruction cannot certify that the code meets its actual brief. This gate cannot lift the verdict above BLOCK based on documents alone when they are reconstructed from code that omits the primary user need.

---

## Conclusion

The application is **not shippable** in its current state:

1. No user interface exists.
2. The core feature Dana identified (viewing a child's existing bookings) is not implemented.
3. Backend security and data-integrity issues remain (unvalidated account ID, hardcoded secrets, race conditions on concurrent writes).
4. The documented walkthrough cannot be executed.

**To ship, this requires**:
- Implement the full frontend UI for sign-in, child selection, viewing bookings, available sessions, booking, and cancellation.
- Add a GET endpoint to retrieve bookings for a signed-in account/child.
- Implement child selection and listing in the backend.
- Fix account validation and session secret handling.
- Add concurrent-write protection to the JSON file store (file locking, atomic writes, or migration to a proper DB).
- Validate all user input at API boundaries.
- Test the primary job: a parent viewing and managing their child's bookings.

None of these are cosmetic or incremental improvements; they are foundational to the product as described by its actual user.
