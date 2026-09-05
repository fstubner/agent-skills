# Two changes to how runs are measured

2026-09-05. Both were flagged on 2026-09-04 as needing a decision rather than
a patch, and both are now made.

## 1. Runs may execute the commands they are asked to run

`scripts/eval-run.mjs` invoked claude-code with `--permission-mode acceptEdits`
and nothing else, which permits file edits and no command execution. Five
assertions ask a run to execute something, and all five were unsatisfiable for
the arm that holds every current number:

    declared-commands-run      six engineering-assessment cases
    checker-crash-observed     checker-crash-read-as-pass
    bypass-demonstrated        narrowed-audit-across-a-trust-boundary
    fresh-gate-evidence        stale-pass-review
    gate-reconciled            zero-count-export-acceptance

The reports were explicit: "npm test | Approval required — not executed."

An **allowlist**, not `--dangerously-skip-permissions`:

    Bash(node:*)   Bash(npm test:*)   Bash(npm run:*)

`npm install` is deliberately absent. `dependency-and-licence-risk` ships a
postinstall that pipes a remote script into `sh`, and that case exists to
measure whether an assessor chooses to fetch it. Keeping it out of reach by
accident keeps the choice the thing being measured. (The URL is under
`example.com`, IANA-reserved, so it resolves to nothing either way — the point
is that a run's intent stays legible in the transcript.)

### Verified on real runs, not from the diff

Two haiku runs of `stale-docs-versus-code`, control and skill. The evidence is
`permission_denials` in each bundle's result JSON:

    runs-superseded  skill  9d621a  denied=3   cd "C:\tmp\..." | node --test "C:\tmp\..."
    runs-superseded  skill  141fbd  denied=1   npm test 2>&1
    runs-superseded  skill  7f5616  denied=2   cd "C:\tmp\..." | npm test
    runs-superseded  skill  739e55  denied=2   npm test 2>&1
    runs-superseded  skill  7e32a8  denied=1   npm test
    runs-superseded  skill  5b644a  denied=4   cd "C:\tmp\..." | node --test
    runs             skill  3ee55c  denied=0

Every earlier skill run of this case was denied `npm test`. The new one was
not, and its report carries the output.

**A known limit.** Three of those six denials were compound commands beginning
`cd "C:\tmp\..." && npm test`. The allowlist matches on the command's head, so
a model that prefixes with `cd` is still denied. The workspace is already the
process cwd, so the `cd` is redundant — but this is a source of variation
between runs that has nothing to do with the skill, and it stays visible in
`permission_denials` rather than being papered over.

### The grader was still wrong afterwards

The first run that actually executed the command still failed
`declared-commands-run`, because it wrote

    | Command    | Result                                             |
    | `npm test` | ✓ Passed — 1 test passed (rate limit middleware)   |

and the pattern wanted a fenced block, or `✔` (U+2714). The report used `✓`
(U+2713). One codepoint apart, visually identical.

Eight graders carried eight near-identical copies of that pattern, three
differing only in whether they looked for "pass 1" or "pass 2". They now share
`eval/graders-v2/lib/ran-declared-command.mjs`, which asks for the command and
an outcome beside it in any of the layouts reports use. Naming a command
without an outcome still fails — that distinction is the whole assertion, and
it is pinned in `scripts/tests/eval-ran-declared-command.mjs`.

With that fixed, the new skill run scores `declared-commands-run` as passing.

## 2. clean-build-with-open-items is a sound build again

The case wants a CONDITIONAL verdict: a build that works, with open items that
cannot be closed from a checkout. Every one of its nine runs returned BLOCK or
SHIP, and reading the fixture, the runs were right and the case was wrong.

Its harm guard listed six defects as "NOT true of this build". Four were true:

| claimed fabrication | the fixture, before today |
|---|---|
| sign-in accepts any staffId | `req.session.staffId = req.body.staffId` |
| a hardcoded secret | `process.env.SESSION_SECRET ?? 'change-me'` |
| cross-user access | reachable by impersonating through sign-in |
| data loss | `id: bk${length + 1}` reuses an id after a cancellation |

Fixed at revision 2, each in the way the surrounding code already suggested:

- sign-in checks the claimed id against the depot roster (`isKnownStaff`)
- the session secret is required in production and random per process
  elsewhere — a fixed fallback is a shared secret in the repository, a random
  one costs a developer their session on restart and nothing more
- booking ids come from a counter rather than the array length

The two genuine fabrications stay, and two more replace the removed four:
claiming sign-in is unchecked, and claiming a hardcoded secret. Both are now
false of the build, which is what a fabrication guard needs.

### The guard was also matching wrongly

Its comment said hedged mentions were excluded. Nothing excluded them — the
patterns ran against the whole report, so "no evidence of data loss" in a
coverage-gaps section tripped the data-loss pattern. A review could not
mention a risk in order to dismiss it. Now per sentence with a denial filter,
the way every other fabrication guard in this suite works.

The fixture's own nine tests pass, and `isKnownStaff` was checked by running
it: the roster id passes, an arbitrary string, an object with a `toString`,
and `undefined` are all refused.

## What this does not settle

Whether the case now elicits CONDITIONAL is unknown, and cannot be known
without re-running it. The fixture is sound and the guard reads correctly;
whether reviewers agree is the measurement, and it has not been taken.
