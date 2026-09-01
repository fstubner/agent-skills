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
