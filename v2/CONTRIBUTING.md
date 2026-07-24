# Contributing

## Before any PR

```bash
node scripts/run-tests.mjs                        # must pass — same command CI runs (Ubuntu + Windows)
node scripts/gen-contract.mjs                      # after any registry.json change
node ai-prose-slop/scripts/gen-patterns.mjs        # after any rules/AIProseTells/*.yml change
```

The repo ships `.gitattributes` (LF-normalized), and the test runner
normalizes CRLF — a fresh Windows clone passes out of the box. If it
doesn't, that's a bug; file it.

## Adding or changing a skill

Follow the generated checklist in [docs/CONTRACT.md](./docs/CONTRACT.md#adding-a-skill).
The short version: directory + SKILL.md, `registry.json` entry, regenerate
the contract, ship + block fixtures pinning the specific blocker id. The
test runner cross-checks the registry against the filesystem, so a skipped
step fails loudly.

## Editing ai-prose-slop's Vale rules

`rules/AIProseTells/*.yml` is the single source of truth for every checkable
word/phrase/threshold. Never hand-edit the word lists inside
`ai-prose-slop/references/patterns.md` — the spans between
`<!-- gen-patterns:... -->` markers are generated from the `.yml` files and
overwritten on every run. After adding, removing, or changing a token in a
rule file (or adding a new rule file), run:

```bash
node ai-prose-slop/scripts/gen-patterns.mjs
```

`run-tests.mjs` runs this in `--check` mode and fails if `patterns.md` is
stale, or if a rule `.yml` has no `<!-- gen-patterns -->` marker pointing to
it — a new or edited rule can't silently go undocumented, and patterns.md
can't silently claim a word is checkable when it isn't (or vice versa).

## Checker rules

- Every check: `{ id, status: pass|fail|not_evaluated, detail }`. Missing
  evidence is `not_evaluated`, never `pass`. A crashed sub-tool is `fail`,
  never silence.
- Heuristics need boundaries: anchored regexes, paths relative to `--root`.
  If a legitimate project could trip it, it needs a regression fixture
  proving it doesn't (see `backend-ship`'s "task-management" file).
- Shared logic goes in `core/lib/` — the only intentionally duplicated file
  is `resolve-core.cjs`.

## Pre-commit secret scanning (opt-in)

```bash
git config core.hooksPath scripts/git-hooks
```

Blocks a commit whose staged content matches
`core/lib/secret-patterns.txt` (the same anchored, prefix-based patterns
`backend-engineering`'s `B-client-secrets` check uses — that check, this
hook, and the hook's PowerShell counterpart all read the one `.txt` file,
so a new prefix reaches all three without hand-syncing). The hook itself
(`scripts/git-hooks/pre-commit`) is native POSIX `sh`, no Node required —
git resolves it by shebang and runs it through its own bundled `sh.exe` on
Windows too (Git for Windows), so it works the same on every platform
without an interpreter to install. `pre-commit.ps1` is a PowerShell
equivalent for direct/manual invocation. Per-clone opt-in — `git config`
isn't committed, so this never activates for a contributor who hasn't run
it. Reports file paths only, never the matched value. A genuine false
positive: commit with `--no-verify` and open an issue.

## Releases

1. Bump `VERSION` and add a matching `## <version>` heading to
   `CHANGELOG.md` (the test runner enforces the pair).
2. Tag; consumers install from tags.

## Eval results

Recorded runs (see [eval/README.md](./eval/README.md)) are welcome —
transcript required. Claims wording in the root README only strengthens
when real runs land.
