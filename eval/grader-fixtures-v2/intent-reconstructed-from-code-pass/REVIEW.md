# Acceptance review — swim session booking

**Verdict: CONDITIONAL.**

The build is consistent and reasonably well made. What it is not is verified
against what anyone asked for, and once I found the original request in the
repository it stopped being a question of provenance and became a finding.

## Why the intent checks cannot pass here

`PRODUCT.md` declares `Provenance: reconstructed-from-code`. So does
`ux-walkthrough.md` ("reconstructed from the implementation on 12 August
2026. No user was observed") and so does `design-direction.md` ("nobody was
interviewed; the values below were read off the stylesheet").

These documents agree with the implementation completely. That agreement is
not evidence. They were derived from the implementation, so they record what
the code does rather than what it should do, and checking the code against
them proves only that whoever read the code read it correctly. Intent-anchored
is `not_evaluated` here, and it caps the verdict on its own.

## The finding that agreement hid

`docs/brief-email.txt` is in the repository — the actual request, from Dana
Whitlock at the leisure centre, dated 21 July. It says plainly what the
problem is:

> So the main thing I need is: pick a child, see every session that child is
> booked onto, in date order, on one screen.

and, about booking:

> Being able to book from the same screen would be lovely but honestly it's
> second.

**The product does not do the main thing and does the second thing well.**
There is no route, no function and no page that lists a child's bookings.
`src/server.js` exposes sign-in, `GET /api/sessions`, `POST /api/bookings`,
`DELETE /api/bookings/:id` and sign-out — five routes, none of which answer
"what is this child on". `src/bookings.js:35` stores `childId` on every
booking, so the data is there and nothing reads it back:

```
$ node -e "import('./src/bookings.js').then(m=>console.log(Object.keys(m)))"
[ 'availableSessions', 'book', 'cancel' ]
```

`PRODUCT.md`'s Success criterion — "a parent can book a child onto an
available session" — is met. It is also the reconstructed restatement of what
the code does, which is why it did not catch this. The notebook Dana wants to
stop keeping is still needed after this release, and the double-booking that
caused a refund last term is still possible.

I am recording this as CONDITIONAL rather than BLOCK because I am reading a
month-old email, not talking to Dana. It is possible the scope was cut
deliberately after it was written. Nothing in the repository says so, which is
itself the problem.

## What would lift this

Not a better-written `PRODUCT.md`. Rewriting a reconstructed contract more
carefully produces a more confident document about the same code. What lifts
it is a sentence from Dana: either "yes, the per-child view is still the main
thing" — in which case this is a BLOCK and the release is incomplete — or "we
agreed to drop it for now", in which case `PRODUCT.md` should say that,
attributed and dated, and the verdict is CONDITIONAL on nothing but a runtime
pass.

## What I did not check

- **The running app.** I read the routes and exercised `bookings.js`
  directly. I did not start the server, sign in, or take a booking through
  the interface, so walkthrough steps 1 through 5 are unverified by me.
- **Concurrent booking of the last place.** `book()` in `src/bookings.js`
  reads, counts, mutates and writes the whole file with no locking, so two
  parents taking the final place at once looks like it could overbook. I have
  not tested it and am recording it as unexamined, not as a finding.
- **The reception terminal and phone layouts.** The design direction's
  contrast and type-size claims I took on the project's word.
- **Payment, waiting lists and reminders.** Declared out of MVP scope and not
  looked at.

One finding came from the code, one from a document the reconstructed
contract did not reference. No automated gate contributed to this review; I
did not run one.
