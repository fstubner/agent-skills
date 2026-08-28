# UX walkthrough

## Primary job

<!-- One sentence: who does what, and what counts as done. -->

## Steps

<!-- Every step names something you could observe, because a step with no
     observable outcome cannot be checked by a person or turned into a script.
     "User clicks Post" is an action; "the note appears at the top of the
     list" is a step. check-frontend's F-walkthrough-observable enforces this.

     1. Click New -> the form opens with focus in the title field.
     2. Submit empty -> the title field shows "Title is required".
     3. Reload -> the list is preserved and refetched from the server. -->

1.

## States

- **Loading:**
- **Empty:**
- **Error:**
- **Success:**

## Replay

<!-- Optional, and an opt-in: the subset of the steps above that a machine can
     repeat. product-acceptance generates a Playwright spec from this block,
     and once it exists the gate asks for the run log — so declare only steps
     you mean to keep passing. Judgment steps stay prose above; they are the
     acceptor's, not a script's.

     Generate:  node <product-acceptance>/scripts/gen-walkthrough-spec.mjs --root .
     Run:       npx playwright test walkthrough.spec.js --reporter=json > .agent-evidence/walkthrough-run.json

```walkthrough
- goto: /
  expect: text "Sign in"
- fill: #email = a@example.com
  click: #submit
  expect: text "Check your inbox"
```
-->

