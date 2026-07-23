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
1. Open / — list view renders; empty state shows "No OKRs yet" + New button.
2. Click New — form with title/target fields, focus lands in title.
3. Submit valid — row appears in the list without reload.
4. Submit empty title — inline error at the field; nothing is created.

## States
- Empty: every collection view has a designed empty state with the next action.
- Error: failed requests surface a human message and a retry path.
- Success: the completed action is visible where the user lands, not a toast alone.
```

## Laws

1. **Empty states are the first screen most users see.** Design them, don't
   default to a blank div.
2. **Every error path has a next action** — retry, edit, or go back. Dead
   ends are bugs.
3. **Refresh mid-flow must not corrupt** — reload during the primary job
   lands somewhere sensible.
4. **Focus and keyboard**: the primary job is completable by keyboard;
   focus-visible is never suppressed.
5. If a state's behavior isn't in the walkthrough, it doesn't exist —
   acceptance treats undocumented states as unbuilt.
