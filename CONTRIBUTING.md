# Contributing

## Before any PR

```bash
node scripts/run-tests.mjs                        # must pass, same command CI runs (Ubuntu and Windows)
node scripts/gen-contract.mjs                      # after any registry.json change
node ai-prose-slop/scripts/gen-patterns.mjs        # after any rules/AIProseTells/*.yml change
```

The repository normalises line endings to LF and the test runner handles
CRLF, so a fresh Windows clone should pass. If it doesn't, please open an
issue.

## Adding or changing a skill

Follow the checklist in [docs/CONTRACT.md](./docs/CONTRACT.md#adding-a-skill).
In short, add the directory and `SKILL.md`, add the `registry.json` entry and
regenerate the contract. Then add ship and block fixtures that pin the
specific blocker id. The test runner checks the registry against the
filesystem, so a missed step fails.

## Editing ai-prose-slop's Vale rules

`rules/AIProseTells/*.yml` is the source for every word, phrase and threshold
the checker uses. Don't edit the word lists in
`ai-prose-slop/references/patterns.md` by hand. The parts between
`<!-- gen-patterns:... -->` markers are generated from the `.yml` files and
overwritten each run. After changing a rule file or adding one, run this.

```bash
node ai-prose-slop/scripts/gen-patterns.mjs
```

The test runner runs it in `--check` mode. It fails if `patterns.md` is out
of date or a rule file has no marker pointing at it.

## Checker rules

- Every check returns `{ id, status: pass|fail|not_evaluated, detail }`.
  Missing evidence is `not_evaluated`, never `pass`. A sub-tool that crashes
  is `fail`, never silence.
- Heuristics need boundaries, meaning anchored regexes and paths relative to
  `--root`. If a legitimate project could trip one, add a regression fixture
  that proves it doesn't (see the "task-management" file in `backend-ship`).
- Shared logic goes in `core/lib/`. The only file duplicated on purpose is
  `resolve-core.cjs`.

## Pre-commit secret scanning (opt-in)

```bash
git config core.hooksPath scripts/git-hooks
```

This blocks a commit whose staged content contains a secret, using
[gitleaks](https://github.com/gitleaks/gitleaks). Install gitleaks with
`winget install Gitleaks.Gitleaks`, `brew install gitleaks` or the release
tarball. If it's missing, the hook warns and lets the commit through.
`backend-engineering`'s `B-client-secrets` check behaves differently and
reports `not_evaluated`, because it feeds a ship verdict.

Both run gitleaks twice, once with its default rules and once with
`core/gitleaks-extra.toml`. That file adds the Anthropic and OpenAI project
key prefixes the defaults miss as of gitleaks 8.30.1. They report file paths and
rule ids only, never the matched value.

The hook only runs in clones where you've set `core.hooksPath`, since git
config isn't committed. For a genuine false positive, commit with
`--no-verify` and open an issue.

## Releases

See [RELEASE.md](./RELEASE.md).

## Eval results

Recorded runs are welcome, with transcripts (see
[eval/README.md](./eval/README.md)). The README's claims only get stronger
when real runs support them.
