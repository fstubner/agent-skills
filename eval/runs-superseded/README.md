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

## 2026-09-04 — four harm guards that fired on accurate reporting

40 runs across three cases, moved whole: `circular-dependency-god-module` (14),
`declared-commands-fail` (14), `dependency-and-licence-risk` (12).
`plumbing-directory-blindspot` was already moved by the entry above and is
edited again here.

Five of engineering-assessment's nine harm guards had ever fired. All five were
false positives, and all five in the same direction — they fire on specific,
well-cited findings, which is what the skill arm produces more of:

  circular-dependency    topic pattern included `util.js`, so "retry() throws
                         undefined ... src/util.js:35-41" scored as an
                         unobserved runtime claim about an import cycle
  dependency-and-licence matched the script name beside "downloaded", which is
                         how a report states the finding the case is FOR
  declared-commands-fail matched a results verb near "lint", catching "no
                         eslintrc config file found" and a quotation of the
                         README used to contradict it
  plumbing               a validation clause that caught four true findings
                         and zero fabrications across 42 bundles; removed
  n-plus-one             the stem bug, in the entry above

Skill-arm scores after repair: 12/12, 8/8, 12/12, 19/19 — every failure ever
recorded against these four guards was the guard misreading the report.

`eval/results/harm-guard-false-positives-2026-09-04.md` has the detail and
what it does to the reported regression.

## 2026-09-04 — the verdict reader

169 runs across thirteen cases, moved whole — every product-acceptance case
with recorded evidence except two.

Eleven graders each carried their own copy of the verdict parser, and two more
carried a variant. Measured against all 246 archived reviews, it had two
independent faults. It required "verdict" to open the line with a colon
straight after, and found nothing in 131 of them — a verdict it could not find
recorded a FAIL, so a review that blocked correctly and wrote "# Release
Verdict: BLOCK" was scored as having shipped. And of the 115 it did find, 25
were classified backwards, because it tested /\bship\b/ first and "DO NOT SHIP"
contains "ship".

156 of 246 recorded verdicts were wrong, on the single assertion every
product-acceptance case turns on.

Replaced by eval/graders-v2/lib/verdict.mjs — one file rather than thirteen,
for the reason the citation entries above give — which reads all 246: 233
block, 7 ship, 5 conditional, 1 unrecognised, 0 unfound.

The skill is unmeasured until these are re-run. Its previous 11.0pp
CI [3.3, 18.8] is withdrawn rather than corrected: it was computed with a
reader that was wrong 63% of the time.

Detail in eval/results/verdict-reader-2026-09-04.md.

## 2026-09-05 — two stem-and-tense bugs found by an audit, not by a failure

24 runs across two cases, moved whole: `acceptance-clean-gate-dirty-code` (15)
and `block-softened-into-prose` (9). Both had just been re-run.

Neither bug announced itself. They were found by pointing six independent
audit passes at the repository and then verifying what they claimed.

`block-softened-into-prose` NEGATED carried `refus` and `decline` as stems
inside a right-bounded group, so `\brefus\b` matched neither "refuse" nor
"refused" nor "refusal". Latent — the assertion passes in every recorded run —
but a negation filter that cannot read "we refuse to soften the verdict" would
eventually score a refusal to soften AS softening, which is the reverse of what
the case measures.

`acceptance-clean-gate-dirty-code` wanted the present participle in
`passing .{0,30}(gate|checks?)`, so the natural past tense missed: "The
automated gate passed, but the code contains a cross-ward access vulnerability"
is precisely the sentence the assertion looks for.

Both are the same family as the 2026-09-04 stem bug. A sweep of every
alternative in every grader for one that cannot match its own inflections
returned 118 candidates, of which `refus` was the only true instance — the rest
are ordinary words that correctly do not inflect here ("critical", "docker",
"browser"). The class is now believed eradicated; the sweep is not kept as a
test because it needs a human to read its output.

Also confirmed and NOT changed: `citedSpans` is copy-pasted across 23 graders
in two variants, and the single odd one differs only in the name of the
variable holding the report text. Real duplication, no behavioural drift.

## 2026-09-06 — the entire antigravity cohort measured an untouched fixture

22 bundles moved (16 had been moved by earlier entries), leaving one: the
single run taken after the fix, kept as the proof it works.

agy ignores the spawn cwd. It edits inside its own scratch directory,
`~/.gemini/antigravity-cli/scratch`, and then reports the file it wrote as
being "in the current working directory" — which is why nobody noticed. The
transcripts read like successful runs.

Only 6 of 38 antigravity bundles ever put a file into their workspace: 5 of 22
control, 0 of 9 policy, 1 of 7 skill. For the rest the grader scored the fixture
as staged, so every run of a case scored identically in every arm —
`acceptance-clean-gate-dirty-code` read 1/8 nine times and
`all-at-once-for-a-quiet-risk` read 5/9 nine times. Zero variance looks exactly
like "the skill does nothing" and was actually "the model's work never arrived".

Reproduced outside the harness before changing anything: a bare agy run asked
to write PROOF.md in the working directory wrote it to scratch; the same run
with `--add-dir` wrote it where it was asked. Then verified through the harness
— the first run after the fix wrote RELEASE.md into the workspace and added
OPERATIONS.md.

**Nothing in the hash-binding scheme could have caught this.** caseSha256,
fixtureSha256, graderSha256 and stagedInputSha256 all bind INPUTS. The harness
invocation is not an input to any of them, so an adapter can stop delivering
the treatment entirely and every existing check stays green.
`scripts/tests/eval-harness-workspace.mjs` pins the flag; it fails when
`--add-dir` is removed.

This was caught two cases into a planned 410-run batch, by asking why every
score was identical.

## 2026-09-06 — 38 antigravity control and policy runs that had the skill

Not superseded by a grader change. Quarantined, because they were never
control runs.

The antigravity control arm produced an `acceptance-report.json` in 18 of 18
product-acceptance runs, and the policy arm in 17 of 18. Its workspace held
no copy of the script that writes one. The report carries the thirteen check
ids only `accept-check.js` emits, rooted at the run's own workspace and
generated inside its window; one transcript names the copy it ran, under
`~/.gemini/config/plugins/`. So those arms had the gate the skill exists to
deliver, and skill-minus-control measured only what the prose adds on top —
which read as "the skill does not transfer".

The ambient-skill guard could not see it. It reads tool calls out of the
transcript, and agy's print-mode transcript is one JSON turn with no tool log.
`runEligibility` now refuses any control or policy run whose workspace holds
a suite checker report, which needs no transcript at all; the batch runner
mirrors it so it cannot count a cell the report will discard. Pinned in
`scripts/tests/eval-contamination.mjs`.

35 product-acceptance, 3 release-engineering. The engineering-assessment arm
was clean (0 of 36), and it is the one that transferred.

## 2026-09-06 — stale-pass-review: the plant was never committed

12 runs, all from 2026-09-03, moved whole.

Seven cases plant a stale report in their fixture's `.agent-evidence/` — a
passing gate left on disk, a checker report from last month, an acceptance
note from 4 August. That path is gitignored, and under `fixtures-v2` nobody
had un-ignored it the way `grader-fixtures-v2` is. The plants lived only on
one machine. A fresh clone has never had these seven fixtures intact.

Found by breaking it: while proving the contamination above I ran a checker
directly against a fixture, then "cleaned up" every untracked `.agent-evidence`
under `fixtures-v2` — and eval-verify went from 13 failures to 68, because
those directories had been present when the runs were recorded and were in
their fixture hashes. Five of the seven were recovered byte-for-byte from the
earliest claude-code control bundle of each case, which archives the
workspace as staged and whose harness could not have written a report.
`stale-pass-review` had no such bundle — its runs predate evidence archiving —
so its plant is reconstructed from what the grader demands and is not the
original bytes. These 12 runs could no longer bind to it, and they were about
to be superseded by the grader work below in any case.

All seven plants are tracked now.

## 2026-09-06 — one citation matcher, one runtime-evidence clause, a reader that keeps backticks

342 runs across 25 cases, moved whole: 279 claude-code, 35 codex, 28
antigravity.

Three instrument repairs, each of which had to touch many graders because
the logic it corrected was copy-pasted:

- The citation matcher lived in 23 graders. Antigravity writes citations as
  markdown links with the line number in the URL fragment —
  `[server.js:L25-L28](file:///…/src/server.js#L25-L28)` — and none of the
  23 read a fragment. 0 of 336 claude-code reports use the form; 33 of 99
  antigravity reports do, 258 citations, and the skill arm, being the arm
  that cites the graded lines, lost every one. The matcher is now
  `eval/graders-v2/lib/citations.mjs`, with the fragment as its sixth form.
  Each grader keeps its own one-line wrapper (its slack, its range test) and
  nothing else. `scripts/tests/eval-citation-forms.mjs` tests the shared
  module and fails if any grader grows a private copy back.

- The runtime-evidence clause lived in 11 graders, in four drifted variants.
  None credited the suite's own acceptance gate — the thing product-
  acceptance tells the reviewer to run — so 21 of 48 antigravity runs with a
  genuine `acceptance-report.json` on disk were scored as having run nothing.
  `eval/graders-v2/lib/runtime-evidence.mjs` is the union of every variant
  plus the report on disk, which only the suite's scripts write.

- The verdict reader deleted inline code spans before reading, so a verdict
  written as backticked BLOCK reached the classifier as a blank label and the
  reader fell back to the heading above it. It unwraps the span now. One run.

Proved rather than asserted. Every archived bundle of every touched case was
scored by the old graders before the rewrite and by the new ones after — 25
cases:

    decreases                       0
    changes outside the three repairs  0
    intended gains                  23   (citations 8, runtime-evidence 14, verdict 1)

The one verdict gain is the backticked run, checked by hand. The largest
single gain is `block-softened-into-prose :: runtime-evidence` in the skill
arm, 0 of 5 to 5 of 5: the arm had run the gate every time, and the clause
could not see the report it left.

The first comparison also flagged fifteen movements on
checker-crash-read-as-pass that were not repairs at all. Its baseline had
been captured while its planted report was missing (see the entry above),
so the contamination rule was excluding its control and policy arms; once
the plant was back, more bundles were counted. Re-scored old-grader against
new-grader on the same bundle set, those fifteen vanish. Recorded because a
proof that needed a second look is worth more than one that did not.
