# Release verdict

**BLOCK** — Product cannot ship.

## Summary

The swim session booking tool has a complete backend (Express app, booking logic, session handling) but is missing the entire frontend. The user interface does not exist. The product cannot be used by parents or reception staff.

## Gate status

Gate script could not be run due to environment restrictions, but the blocker is evident from static analysis:

- **Required documents present:** PRODUCT.md, ARCHITECTURE.md, design-direction.md, ux-walkthrough.md all exist
- **Provenance:** PRODUCT.md declares `reconstructed-from-code` — intent not anchored to user/human statement
- **Walkthrough:** Describes complete interactive flow (sign-in form, session list, book/cancel buttons) but cannot be replayed

## Critical findings

### 1. BLOCKING: Missing frontend application (product non-functional)

The `public/index.html` file is 73 bytes:
```html
<!doctype html><title>Swim session booking</title><main id="app"></main>
```

The ux-walkthrough.md describes these user steps:
1. Open the page. The sign-in form is shown.
2. Sign in. Land on the list of available sessions.
3. Choose a child and a session and press Book. 
4. Cancel a booking.
5. Sign out.

None of this can happen. There is no sign-in form, no session list, no Book button, no UI of any kind. The HTML has a single empty `<main>` element and no JavaScript whatsoever.

- **Impact:** The Success criterion in PRODUCT.md cannot be met: "A parent can book a child onto an available session and see that the booking was taken."
- **What exists:** Backend API endpoints in server.js can accept requests, but there is nothing to make those requests.

### 2. CRITICAL: No authentication or authorization

`server.js:17-19`
```javascript
app.post('/api/sign-in', (req, res) => {
  req.session.accountId = req.body.accountId;
  res.json({ ok: true });
});
```

The sign-in endpoint accepts ANY accountId from the client without verification. There is no password, no account lookup, no validation. A user can POST `{"accountId": "parent-123"}` and instantly impersonate that parent. This breaks the entire security model.

Additionally, when booking a child (`bookings.js:30-39`), the system does not verify the child belongs to the signed-in account. Any parent can book any child (real or fabricated) onto any session.

**Severity:** Complete authentication bypass. Any user can impersonate any other user and book sessions on their behalf.

### 3. CRITICAL: User intent not captured

The actual user requirement (from brief-email.txt, dated 21 July 2026) is:
> "pick a child, see every session that child is booked onto, in date order, on one screen"

Dana Whitlock explicitly states viewing existing bookings is the PRIMARY need, and booking is secondary.

The PRODUCT.md MVP scope lists: "List available sessions, book a child onto one, cancel a booking, sign out."

This omits the core feature: viewing a child's existing bookings. The availableSessions() function in bookings.js returns only sessions with remaining places—not sessions the child is booked onto.

### 4. CRITICAL: Session secret defaults to hardcoded value

`server.js:9`
```javascript
secret: process.env.SESSION_SECRET ?? 'change-me'
```

If `SESSION_SECRET` environment variable is not set, session cookies use a hardcoded default. This breaks session security if deployed in any environment where the variable is not explicitly configured. Any attacker knowing the code can forge session cookies.

**Severity:** Breaks authentication security on any unsecured deployment.

### 5. CRITICAL: Race condition in concurrent bookings

`bookings.js:30-38`
```javascript
export function book(accountId, childId, sessionId) {
  const state = load();  // Read file
  const target = state.sessions.find((s) => s.id === sessionId);
  if (!target) return null;
  if (state.bookings.filter((b) => b.sessionId === sessionId).length >= target.capacity) return null;
  const booking = { id: `b${state.bookings.length + 1}`, accountId, childId, sessionId };
  state.bookings.push(booking);
  save(state);  // Write file
  return booking;
}
```

Two concurrent requests can both read the file, both pass the capacity check, and both write back—resulting in overbooking. JSON file storage has no atomic transactions.

**Scenario:** Session has 1 place left. Two parents both trigger book() simultaneously. Both read capacity=8, taken=7. Both pass the check. Both save. Session is now overbooked to 9/8.

### 6. HIGH: Booking ID collision risk

`bookings.js:35`
```javascript
id: `b${state.bookings.length + 1}`
```

Booking IDs are generated based on array length. If a booking is deleted and concurrent requests are made, or if state becomes inconsistent, duplicate IDs can occur. This violates uniqueness constraints and will break cancel() logic. Under concurrent load, multiple requests can read the same array length and generate duplicate IDs.

### 7. HIGH: No input validation on sign-in

`server.js:17-19`

The sign-in endpoint accepts any value type (null, numbers, arrays, objects) as `accountId` with zero validation. No format checking, no type enforcement, no verification that the account exists.

### 8. HIGH: No input validation on booking

When booking, `childId` and `sessionId` are accepted without validation. Any non-existent or malformed value is persisted directly to the data file.

### 9. HIGH: availableSessions() hides user's own bookings

A parent cannot see which sessions they've already booked. The availableSessions() function filters only by capacity:

```javascript
.filter((s) => s.taken < s.capacity)
```

It does not return sessions at capacity (which the child might already be booked onto) or indicate ownership. A parent cannot view their bookings at all.

### 10. HIGH: Silent file I/O failures

`bookings.js:10-12`
```javascript
function save(state) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(state));
}
```

No error handling on file writes. If the write fails, the user receives a success response but the booking was never persisted. Disk full, permission denied, or network file system timeouts result in silent data loss.

### 11. HIGH: No entity validation

The system has no registry of valid children or sessions. Can book non-existent sessions (will silently fail) or fabricated children (will be stored in the data file). No validation against known entities.

### 12. HIGH: Only one test

`test/bookings.test.js` contains a single test checking session listing. No tests for:
- Booking and cancellation
- Concurrent operations and race conditions
- Data ownership validation
- Duplicate ID generation
- Error cases

### 13. MEDIUM: No error logging or diagnostics

Operations silently fail (return null). No logs, no HTTP error details beyond status codes. Makes debugging and monitoring impossible in production.

### 14. MEDIUM: Null reference risk

If `.data/bookings.json` is malformed or incomplete (e.g., missing the `bookings` key), the code crashes when calling `.filter()` on undefined.

### 15. MEDIUM: Positive finding — Cancel validation

The cancel endpoint correctly verifies data ownership:
```javascript
const index = state.bookings.findIndex((b) => b.id === bookingId && b.accountId === accountId);
```

This is the only operation that properly checks that the booking belongs to the signed-in user. However, this validation is undermined by the authentication bypass (issue #2).

## What was not checked

- Walkthrough playback: Cannot execute without frontend code
- Adversarial paths (empty states, network errors, garbage input): Cannot test without frontend
- Acceptance gate detailed checks: Script could not run due to environment
- Performance or load testing
- Accessibility (no HTML to evaluate)
- Whether the system handles malformed `.data/bookings.json` files gracefully (testing would require corrupting the file)

## Verdict reasoning

**Blocking: Product non-functional**
- The HTML file is empty (73 bytes). Zero JavaScript exists. The entire user interface is missing.
- The ux-walkthrough.md describes a complete interactive flow that is impossible to execute.
- The PRODUCT.md Success condition ("A parent can book a child onto an available session and see that the booking was taken") cannot be demonstrated.

**Blocking: Authentication broken**
- No validation of accountId. Any user can impersonate any other user.
- No validation that a child belongs to the signed-in parent. Any parent can book any child.
- This completely violates the data ownership model required for a multi-user system.

**Blocking: Critical security and integrity issues**
- Race condition in bookings allows overbooking of sessions.
- Unsafe booking ID generation causes ID collisions under concurrent load.
- Silent file I/O failures cause data loss if writes fail.
- Hardcoded session secret breaks authentication if environment variable not set.

**Intent mismatch**
- The actual user need (viewing existing bookings per child) is not met.
- The PRODUCT.md is reconstructed-from-code, so user intent is unverified.
- The brief-email.txt shows Dana's primary need is viewing bookings, not creating them.

The product requires:
1. Complete frontend implementation (80+ hours estimated)
2. Proper authentication layer (account lookup, password validation, session binding)
3. Child ownership validation (verify child belongs to parent before booking)
4. Concurrency control (atomic file writes or database transaction support)
5. Input validation on all endpoints
6. Alignment with actual user requirement to view existing bookings

---
**Acceptance date:** 3 September 2026  
**Context:** Independent acceptance review  
**Checked by:** Claude (Haiku 4.5)
