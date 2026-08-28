# UX walkthrough

## Primary job
Add an OKR and see it listed.

## Steps
1. Open / — empty state with New button.

## States
- Empty: "No OKRs yet"
- Error: inline message + retry
- Success: row visible in list

## Replay

```walkthrough
- goto: /
  expect: text "Sign in"
- fill: #staffId = nurse-a
  click: #signin
  expect: text "No notes for this shift yet"
```
