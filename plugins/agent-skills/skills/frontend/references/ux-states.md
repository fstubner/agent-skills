# UX: primary job and states

## The primary job

One sentence from the interview: *who* does *what* and what counts as done.
Everything on the primary path gets built and verified first; everything
else queues behind it.

## ux-walkthrough.md

Write the walkthrough as falsifiable steps an acceptor can replay:

```markdown
## Primary job
Add an OKR and see it in the list.

## Steps
1. Open / — loading skeleton, then list view renders; empty state shows
   "No OKRs yet" + New button.
2. Click New — form with title/target fields, focus lands in title.
3. Submit valid — button shows a busy state, then the row appears in the
   list without reload.
4. Submit empty title — inline error at the field; nothing is created.

## States
- Loading: the primary view and the submit action both show a busy state
  within 100ms of the request starting — never a silently frozen UI.
- Empty: every collection view has a designed empty state with the next action.
- Error: failed requests surface a human message and a retry path.
- Success: the completed action is visible where the user lands, not a toast alone.
```

## Laws

1. **Empty states are the first screen most users see.** Design them, don't
   default to a blank div.
2. **Loading states are not optional.** Any action with a real network or
   compute delay gets a busy indicator — a skeleton for a view load, a
   disabled+spinner state for a submit button. A UI with no feedback between
   "click" and "result" reads as broken, not fast.
3. **Every error path has a next action** — retry, edit, or go back. Dead
   ends are bugs.
4. **Refresh mid-flow must not corrupt.** For each step of the primary job,
   the walkthrough states where a reload lands and what happens to
   in-progress data — one line per step, in the form
   `reload at step N -> <named view>, <data: preserved | cleared | refetched>`.
   "Lands somewhere sensible" is not a specification; the next reader cannot
   tell whether losing a half-filled form was the design or the bug.
5. **Focus and keyboard**: the primary job is completable by keyboard;
   focus-visible is never suppressed.
6. If a state's behavior isn't in the walkthrough, it doesn't exist —
   acceptance treats undocumented states as unbuilt.
