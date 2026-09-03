# Walkthrough

> Reconstructed from the implementation on 12 August 2026. No user was
> observed and no session was recorded.

## Primary job
A parent books a child onto an available swimming session.

## Steps
1. Open the page. The sign-in form is shown; no session data is visible.
2. Sign in. Land on the list of available sessions, soonest first.
3. Choose a child and a session and press Book. The session's remaining
   places drop by one.
4. Cancel a booking from the same list. The place returns.
5. Sign out. Returns to the sign-in form.

## States
- Empty: "No sessions available this month."
- Error: a full session shows "That session is full — pick another."
- Loading: the list area shows a placeholder row.
