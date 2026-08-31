# Acceptance review — room booking

**Verdict: CONDITIONAL.**

I found no defect in this build. That is not the same as SHIP, and the
difference is the point of this review: three things I could not check are
open, and a SHIP from me would be asserting coverage I do not have.

## What I checked, and what held

Validation is real and complete. `src/validate.js` checks all three fields of
a booking — room against a list, slot against a half-hour pattern inside
working hours, attendees as a whole number in range — and `src/server.js:26`
runs it before anything reaches the store. A missing body is handled rather
than thrown on.

Ownership holds on both sides. `bookingsFor` and `cancel` in
`src/bookings.js` are both filtered by the signed-in staff id, so one person
cannot read or cancel another's booking. There is a test for the cancel case
specifically.

Double booking is refused at the store, not only in the interface —
`create()` returns null when the room and slot are taken, and `server.js`
turns that into a 409.

The test suite covers error paths, not just the happy one:

```
$ npm test
✔ a booking is listed for the person who made it
✔ a double booking of the same room and slot is refused
✔ someone else cannot cancel your booking
✔ a well-formed booking passes
✔ an unknown room is rejected
✔ a slot outside working hours is rejected
✔ a slot that is not on the half hour is rejected
✔ a non-integer or out-of-range attendee count is rejected
✔ a missing body is rejected rather than throwing
ℹ pass 9  ℹ fail 0
```

Intent is anchored: `PRODUCT.md` records that it was written from the office
manager's brief of 6 August and confirmed with her on 11 August, so the
contract is not a restatement of the code and checking the code against it
means something.

`src/calendar.js` reads the building's calendar service and never writes to
it, which is what `ARCHITECTURE.md` says and what `PRODUCT.md` requires. It
fails closed when `CALENDAR_API` is unset rather than defaulting to something.

## Why this is CONDITIONAL and not SHIP

**1. The declared walkthrough replay has never been run.**
`ux-walkthrough.md` carries a ```walkthrough``` block — seven steps, declared
automatable by the people who wrote it. `.agent-evidence/` contains no
walkthrough run. The replay check is `not_evaluated`: not failed, not passed,
absent. Declaring steps automatable and then not running them is the one
thing that is not allowed to pass silently, so I am naming it rather than
leaning on my own reading of the routes.

**2. I did not run the product.** I exercised `validate.js` and `bookings.js`
directly and read the routes. I never started the server, never signed in,
and never saw the page. Everything above is a claim about modules. Steps 1
through 6 of the walkthrough are unverified by me.

**3. The calendar dependency cannot be exercised here.** `roomsOutOfService`
needs a real `CALENDAR_API`. I have no access to the building's calendar
service, so the integration is unverified in both directions: whether the
response shape matches what the code expects, and whether a room being out of
service actually reaches a user before they book it. Nothing in this
repository can answer that.

## What I did not check

- **The tablet.** `PRODUCT.md` and the design direction both commit to the
  tablet outside each room — 18px type, 56px targets, legible at a distance.
  I have no tablet and took those on the project's word.
- **Concurrent booking of the last free slot.** `create()` reads, checks,
  appends and rewrites the whole file, so two people booking the same room
  and slot in the same instant could both pass the check. I have not tested
  it and am recording it as unexamined rather than as a finding — at three
  rooms in one office it may never happen, and I would rather say I did not
  look than imply I did.
- **Anything about recurring bookings, catering, equipment or guests.**
  Declared out of MVP scope.

Nothing here came from an automated gate; I did not run one. Two of the three
open items are about my own coverage rather than about the build, and I would
expect a runtime pass plus a walkthrough replay to close them without any
change to the code.
