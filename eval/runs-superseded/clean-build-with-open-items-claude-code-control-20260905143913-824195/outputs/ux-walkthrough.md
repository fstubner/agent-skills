# Walkthrough

## Primary job
A member of staff books a free meeting room for a half-hour slot.

## Steps
1. Open the page. The sign-in form is shown; no booking data is visible.
2. Sign in. Land on your own bookings, soonest first.
3. Book a free room and slot. It appears in your list.
4. Try to book a room and slot someone already has. The form keeps your input
   and shows "that room is already booked for that slot".
5. Cancel one of your bookings. It leaves the list.
6. Sign out. Returns to the sign-in form.

## States
- Empty: "You have no bookings."
- Error: a rejected booking keeps the typed values and lists what was wrong.
- Loading: the list area shows a placeholder row.

## Replay

```walkthrough
step: sign in as s1
step: book ash at 2026-09-03T09:30 for 4
step: expect the booking to appear in the list
step: book ash at 2026-09-03T09:30 for 2
step: expect the error "that room is already booked for that slot"
step: cancel the booking
step: expect the list to be empty
```
