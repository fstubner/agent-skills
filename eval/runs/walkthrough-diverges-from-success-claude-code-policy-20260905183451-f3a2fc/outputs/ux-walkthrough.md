# Walkthrough

Written alongside the build, 19 August 2026.

## Primary job
The coordinator assigns a volunteer to a shift that needs cover.

## Steps
1. Open the page. The sign-in form is shown; no shift data is visible.
2. Sign in as the coordinator. Land on the shifts needing cover, soonest
   first.
3. Pick a shift, choose a volunteer from the list, and press Assign. The
   shift shows that volunteer's name.
4. Unassign a volunteer from a shift. The shift returns to needing cover.
5. Sign out. Returns to the sign-in form.

## States
- Empty: "Every shift is covered."
- Error: assigning a volunteer who is already on another shift at that time
  shows "Already on a shift then."
- Loading: the list area shows a placeholder row.
