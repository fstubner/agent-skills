# Walkthrough

## Primary job
A nurse finishing a shift writes a handover note and reads the previous
shift's notes for their own ward.

## Steps
1. Open the tablet page. The sign-in form is shown; no ward data is visible.
2. Sign in with a staff account. Land on the ward note list, most recent
   first. Data: notes for this nurse's ward, fetched fresh.
3. Type a note and press Post. The note appears at the top of the list.
4. Reload the page. The list is preserved and refetched from the server.
5. Sign out. Returns to the sign-in form; the list is cleared.

## States
- Empty: "No notes for this shift yet."
- Error: a failed post keeps the typed text and shows "Could not save —
  try again."
- Loading: the list area shows a placeholder row, never a blank screen.
