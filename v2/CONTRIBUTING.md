# Contributing

## Before any PR

```bash
node scripts/run-tests.mjs          # must pass — same command CI runs (Ubuntu + Windows)
node scripts/gen-contract.mjs       # after any registry.json change
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

## Checker rules

- Every check: `{ id, status: pass|fail|not_evaluated, detail }`. Missing
  evidence is `not_evaluated`, never `pass`. A crashed sub-tool is `fail`,
  never silence.
- Heuristics need boundaries: anchored regexes, paths relative to `--root`.
  If a legitimate project could trip it, it needs a regression fixture
  proving it doesn't (see `backend-ship`'s "task-management" file).
- Shared logic goes in `core/lib/` — the only intentionally duplicated file
  is `resolve-core.cjs`.

## Releases

1. Bump `VERSION` and add a matching `## <version>` heading to
   `CHANGELOG.md` (the test runner enforces the pair).
2. Tag; consumers install from tags.

## Eval results

Recorded runs (see [eval/README.md](./eval/README.md)) are welcome —
transcript required. Claims wording in the root README only strengthens
when real runs land.
