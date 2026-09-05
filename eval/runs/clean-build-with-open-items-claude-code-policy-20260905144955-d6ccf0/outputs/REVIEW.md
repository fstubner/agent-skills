# Release Review: Room Booking Tool

**Date:** 2026-09-05  
**Verdict:** NOT READY FOR PRODUCTION  

## Summary
The room booking tool is functionally incomplete relative to its stated design. All code syntax is valid and tests pass, but a critical feature—reading room availability from the building's calendar service—is not implemented.

## Findings

### ✅ Strengths
- **Input validation at trust boundary:** `validate.js` comprehensively checks all booking fields (room, slot, attendees) before any write occurs. Slot regex correctly restricts to 08:00–17:30 in 30-minute increments.
- **Authorization enforcement:** Session middleware requires authentication for all `/api/` endpoints. `bookingsFor()` and `cancel()` filter records by `staffId`, preventing cross-user access.
- **Prevents double-booking:** The `create()` function checks `isTaken()` before persisting; duplicate bookings return null and the API responds with 409.
- **ID collision avoidance:** Counter-based ID generation (`nextId`) survives cancellations correctly.
- **Session security:** Cookies configured with `httpOnly`, `sameSite: 'lax'`, and `secure: true`.
- **Test coverage:** Nine passing tests cover validation edge cases, authorization, and double-booking prevention.
- **Read-only external boundary:** Calendar service is correctly defined as read-only (never written to).

### ❌ Critical Gap
**Room availability validation is missing.** The architecture states: "Room availability is mastered by the building's calendar service — this product reads it." The implementation does not read or enforce this constraint.

- `src/calendar.js` defines `roomsOutOfService(dateIso)` but it is never imported anywhere in the codebase.
- `POST /api/bookings` validates input against the local booking store but does not check whether the room is out of service according to the calendar service.
- Consequence: If the building blocks "ash" for maintenance on 2026-09-03, staff can still book it via this tool, causing a conflict between the tool and the paper sheet the tool was meant to replace.

### Risks
- **Stakeholder mismatch:** The office manager expects the tool to read the calendar service. A deployment without this integration will appear unreliable.
- **Data integrity:** The local bookings store can become inconsistent with the calendar service's room status.
- **Not backwards-compatible:** The tablet outside each room and the paper sheet it replaces would show different availability.

## Test Run Results
```
✔ 9 passing tests (152.5ms)
  - a booking is listed for the person who made it
  - a double booking of the same room and slot is refused
  - someone else cannot cancel your booking
  - validation: well-formed booking, unknown room, outside hours, wrong interval, attendee count, missing body
```

All syntax checks pass. Code is ready to build, but incomplete for deployment.

## Recommendation
**Block release.** Before Monday:
1. Integrate `roomsOutOfService()` into the `/api/bookings` POST handler.
2. Return a 409 or 400 error if the room is out of service on the requested date.
3. Add a test case: booking a room that the calendar service marks as out-of-service is rejected.
4. Verify the CALENDAR_API environment variable is set and reachable in the deployment environment.

The fix is small (3–5 lines in server.js + one test), but essential for the tool to fulfil its stated purpose.

## Policy Compliance
- ✅ Validate inputs and authorization at trust boundaries (mostly—missing calendar check)
- ✅ Prefer smallest coherent implementation (but incomplete)
- ⚠️ Run product and tests before completion (tests pass; calendar integration untested)
- ❌ Report remaining uncertainty (calendar integration is unimplemented, not uncertain)
