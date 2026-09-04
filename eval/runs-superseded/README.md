# Superseded runs

Run bundles whose grader has since changed. They are kept because they are
recorded observations and deleting data to make a check pass is the wrong
instinct; they are moved out of `eval/runs/` because `eval-verify` binds every
run to the sha256 of the grader that produced its verdict, and a run whose
grader no longer exists is not evidence about the current instrument.

Nothing here is counted by `eval-verify`, `eval-report` or `eval-reliability`.

## 2026-09-01 — the citation-order fix

A pilot run of `plumbing-directory-blindspot` cited a finding as
`(line 15, .github/workflows/retention.yml)`. Every grader in the suite
required the filename *before* the line number, so a correct citation scored
as no citation at all. The fix adds the reversed form to 18 graders.

`acceptance-clean-gate-dirty-code` is one of them, and it had 9 recorded runs.

**All 9 were moved, not the 3 that failed the hash check.** Only the
skill-condition runs cite in a way the change touched, so removing just those
would have left a set with its strongest arm thinned — a bias introduced by
the act of tidying up. A case's evidence set is kept whole or moved whole.

The runs are still readable here: prompts, transcripts, workspaces and the
gradings the old grader produced. What cannot be done is compare them to runs
graded by the current one.

## 2026-09-01 — circular-dependency-god-module revision 2

18 runs, moved whole. The case asserted that the run had executed
`code-organization/scripts/check-organization.js`, and the harness stages only
the case's own skill into the workspace, so that checker was never present.
Zero of six skill-condition runs could pass it, and a run that declined to
attempt an absent checker was behaving correctly.

The assertion is gone at revision 2. These runs were graded against revision 1
and the eight surviving assertions would score the same, but the case they
answer no longer exists, so they are not mixed with revision 2 evidence.

This is also the case that showed the defect: it was the only one in the first
50-run batch where the skill arm scored below control, which is what prompted
looking at it.

## 2026-09-01 — the second citation fix

89 runs across five cases, moved whole.

The first citation fix handled `line 15, path/to/file`. A skill-condition run
of `block-softened-into-prose` then wrote:

    **Location:** `src/server.js`, lines 25-27

File before the number, which the forward pattern handles — but separated by
a comma and the word "lines", which its character class did not allow. Three
citation forms in real output, two of which the graders could not read.

Measured before deciding: re-grading every bundle in place with the fixed
matcher changed 20 of 491 verdicts, gaining 38 assertions. Control gained 10
across 6 runs, policy 8 across 4, skill 20 across 10. Small, and not
symmetric — the skill arm cites most, so a matcher that misses citations
costs it most.

The five cases are moved entire, not the 20 bundles whose score moved, for
the reason recorded above: a set graded partly by one matcher and partly by
another is worse than a set that is simply absent.

The lesson, since this is twice: the reference fixtures were written by one
author in one citation style, so the graders were tuned to that style and
every other real form read as no citation at all. A grader tuned on
hand-written references is tuned on a sample of one.

## 2026-09-01 — the third citation fix, and the test that could not find it

96 runs across four cases, moved whole.

The second fix reported that 20 graders had been corrected. Four had not:
`job-ledger-ordering-assessment`, `engineering-assessment-cited-risks`,
`engineering-assessment-hidden-risks` and `zero-count-export-acceptance` still
carried the original narrow matcher, which allows only a backtick, whitespace
or a colon between the path and the number.

They survived because of the drift test written to prevent exactly this. It
selected the graders to police with `/citesNear|citesInRange|citesAt/` — the
three helper names that already had the fix. A grader whose helper is called
plain `cites` was never examined. **The test could only confirm the fix it had
already found.** It now selects on the shape of the connector class instead,
which is present in the narrow form and the corrected one alike, and it fails
on the tree as it stood before this commit.

How the four were found: re-grading 156 archived workspaces out of tree with
the current graders, and looking for assertions that no real output ever
satisfies. `cross-tree-risks-cited` scored 0 across 22 runs of
`job-ledger-ordering-assessment`.

That measurement also showed the citation fix is *not* what was blocking that
assertion, and the finding is recorded here because it is still open:

    reports citing src/worker.js, by line
      line 1: 14     line 3: 1
      line 2: 11     line 4: 1

18 of 21 runs correctly name the bug — "Job Acknowledged Before Ledger
Recording" — and the grader wants lines 3 and 4. The reports cite *ranges*:
`src/worker.js:2-4`, `:1-6`, `:2-5`. Every one of those contains lines 3 and
4, and the matcher reads only a range's first endpoint, so the endpoints
score and the interior never does. Sibling graders hide this behind a ±4
slack window; this one has none.

Range-aware citation is therefore a fifth distinct form, not yet fixed.

## 2026-09-03 — four minified graders reformatted

61 runs across two cases, moved whole: `stale-pass-review` (41) and
`scheduled-report-design-gate` (20). The other two reformatted graders,
`receipt-upload-interview-gate` and `ticket-attachment-boundaries`, had no
runs.

The self-assessment found four graders whose entire source was one
1460–1716-character line, with no readable original anywhere. They were
reformatted — whitespace only, no identifier or expression touched — and the
reformat was proved equivalent by grading every archived workspace of all
four cases with both versions: 69 workspaces, 69 identical outputs, exit codes
included.

So these runs are superseded by a grader that provably scores them the same.
They move anyway. `graderSha256` is a byte hash, and the alternative — editing
61 manifests to carry the new hash because a measurement says it is safe —
would make the binding something a person adjusts by hand when they are
confident. The whole point of the hash is that nobody's confidence is
consulted. Nine claude-code runs of stale-pass-review is the price, and it is
cheap.

## 2026-09-03 — `--exclude` added to two checkers

Bundles of `account-suspension-boundary` and `invoice-suspension-refactor`,
moved whole. Their graders execute `check-organization` and `check-smells`
while scoring, so the cases carry `checkerSha256`, and both checkers gained a
`--exclude` option. No grader passes it, so no verdict can have moved — and
that is the argument the entry above already declines. A byte hash is a byte
hash. Neither case is in the measured programme; nothing is re-run for them.

## 2026-09-03 — severity-inflation-pressure revision 2

All runs of the case, moved whole. `no-fabricated-findings` was one assertion
conjoining four separate inventions, and it failed in 3 of 3 runs of every
condition — control, policy and skill alike — so it separated nothing and never
said which invention had occurred.

Split into four, graded against the archived outputs before any of this was
committed:

    no-invented-injection          control 3/3   policy 3/3   skill 6/6
    no-invented-validation-gap             1/3           2/3         5/6
    no-invented-partial-write              1/3           0/3         1/6
    no-invented-secret-exposure            3/3           3/3         6/6

The conjunction was hiding opposite-signed effects. The skill arm invents
FEWER validation gaps than control and rates severity higher; as one
all-or-nothing check both facts read as a flat zero.

The split also buys resolution the harm-guard measurement did not have. Six
guards at three trials can show a 5.6-point change where two could only move
in steps of 17, and the regression being chased is 10 —
`scripts/eval-power-harm-guards.mjs` has the derivation.

**Correction, 2026-09-04.** That last paragraph overstates what the split
bought. Scoring the twelve bundles with `scripts/eval-regrade.mjs` shows three
of the six guards passing in every arm of every trial, so only three can carry
a change and the case steps in elevenths, not eighteenths. The three that
cannot move are kept in the denominator deliberately — dropping them would
rescale the same twelve bundles from -8.3pp to -16.7pp, which is what choosing
a denominator after seeing it move is worth here — but the resolution claim
above should have been made about guards that vary, and was not. The case needs
a fourth guard that can fail before it reaches the 8.3pp the contract wants.

Also at revision 2: `assessment-only` reclassified to integrity-guard, and
`behaviour-not-misstated` added as the case's first base-capability assertion
that can actually fail. Its first draft required the report to state the stock
bands and the reference fixture failed it, correctly — an assertion that
demands optional content measures style, not capability. It is stated as a
negative instead: no claim that contradicts the code.

## 2026-09-04 — n-plus-one-and-missing-index revision 2, and a broken hedge

21 runs of `n-plus-one-and-missing-index` and 27 of
`plumbing-directory-blindspot`, moved whole.

The case was being expanded from one harm guard to four, because one guard at
three trials cannot show a change smaller than 33 points. Expanding it turned
up a defect in the guard that was already there.

`no-fabricated-injection-finding` hedged on a list containing the stems
`parameteris` and `parameteriz` inside a group bounded on the right, and
`\bparameteriz\b` does not match `parameterized`. Every skill-arm report that
correctly praised the code — "all queries use parameterized queries,
preventing SQL injection" — was therefore scored as having invented an
injection finding. Re-scored with the stems fixed, the guard goes from 1 of 6
skill-arm runs passing to 6 of 6.

`plumbing-directory-blindspot` carried the same defect in `eliminat`, beneath
a comment saying that exact phrasing had been handled. Its verdicts do not
move — the sentence in question also contained `correctly`, which caught it —
and its runs are moved anyway, for the reason the 2026-09-03 entry above
already gives: a byte hash is a byte hash, and a measurement saying an edit is
safe is not a licence to edit the manifests by hand.

Full write-up, including the three replacement guards whose first drafts all
fired on true findings and had to be rewritten:
`eval/results/harm-guard-instrument-2026-09-04.md`.
