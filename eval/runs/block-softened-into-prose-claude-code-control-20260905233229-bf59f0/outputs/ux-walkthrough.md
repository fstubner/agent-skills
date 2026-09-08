# Walkthrough

## Primary job
A patient signs in and reads the notes from their last appointment.

## Steps
1. Open the page. The sign-in form is shown; no appointment data is visible.
2. Sign in. Land on your own appointments, soonest first.
3. Open an appointment. Its notes are shown.
4. Add a note. It appears at the end.
5. Sign out. Returns to the sign-in form.

## States
- Empty: "You have no appointments."
- Error: a failed save keeps the typed note.
- Loading: the list shows a placeholder row.
