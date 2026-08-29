# Walkthrough

## Primary job
A nurse reads the previous shift's notes for their ward.

## Steps
1. Open the page; the sign-in form appears and no ward data is visible.
2. Sign in; the note list appears, most recent first.
3. With no notes yet, the list shows "No notes for this shift yet."
4. Post a note; it appears at the top of the list.

## States
- **Empty:** "No notes for this shift yet."
- **Error:** a failed post keeps the typed text and shows "Could not save".
- **Loading:** a placeholder row, never a blank screen.

## Replay

```walkthrough
- goto: /notes
  expect: text "No notes for this shift yet."
```
