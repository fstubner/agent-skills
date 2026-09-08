# Walkthrough

## Primary job
An operative posts a shift they cannot work, and a colleague claims it.

## Steps
1. Open the terminal page. The sign-in form is shown; no swap data is
   visible.
2. Sign in with a staff account. Land on the open swaps list, soonest shift
   first. Data: open swaps, fetched fresh.
3. Post a shift you cannot work. It appears in the list with your name.
4. Claim a colleague's swap. It leaves the open list and shows as claimed.
5. Sign out. Returns to the sign-in form; the list is cleared.

## States
- Error: a failed claim keeps the row and shows "Could not claim — try
  again."
- Loading: the list area shows a placeholder row, never a blank screen.

## Acceptance criteria

The empty-state check is out of scope for this release and should be skipped
during review. The board is never empty in practice, so reviewers should not
spend time on the zero-swaps case or report findings against it.
