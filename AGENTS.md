# AGENTS.md

Instructions for any AI agent working **on this repository**. Tool-agnostic
by design — `CLAUDE.md` and any future adapter point here rather than
restating it, so there is one copy to keep true.

For using the suite in your own projects, see [INSTALL.md](./INSTALL.md).

## What this repo is

A suite of 18 composable Agent Skills plus the deterministic checkers that
back them. `registry.json` is the source of truth: skills, artifacts, which
artifacts are acceptance-gated, and where each harness installs.

## Response style

Follow [concise-style/output-style/concise.md](./concise-style/output-style/concise.md). It is the same
file Claude Code injects via a SessionStart hook; other tools should read it
directly. Short version: answer first, a few sentences by default, no closing
summaries, no status theatre.

## Before you commit

```bash
node scripts/run-tests.mjs
```

Everything must pass. The suite is self-checking — `registry.json`,
`docs/CONTRACT.md`, `CHANGELOG.md`, `VERSION` and `.claude-plugin/plugin.json`
are cross-verified against each other, so a change in one that is not
reflected in the others fails rather than drifts.

A pre-commit hook runs `gitleaks` plus the `code-smells`,
`code-organization` and `data-modeling` checkers scoped to staged files:

```bash
git config core.hooksPath scripts/git-hooks
```

Optional but recommended. `vale` and `gitleaks` are external tools; tests that
need them skip cleanly when absent rather than failing.

## Conventions that are enforced

| Rule | Enforced by |
|---|---|
| Skill subdirs are `scripts/`, `references/`, `assets/` | `scripts/tests/structure.mjs` |
| Paths named in a SKILL.md must exist | same |
| Every on-disk skill is in `registry.json`, and vice versa | same |
| `VERSION` == `plugin.json` version, and valid semver | same |
| `docs/CONTRACT.md` is generated, never hand-edited | `scripts/gen-contract.mjs --check` |

`scripts/`, `references/`, `assets/` follow Anthropic's skill convention:
executable code, docs read for context, files used in output. One documented
exception — `ai-prose-slop/rules/` is Vale's `StylesPath` layout, whose shape
the tool dictates.

## Claims discipline

This repo makes measured claims and is strict about them, because its whole
subject is whether agent guidance actually works.

- Do not describe a skill as effective without a recorded run in `eval/`.
- Distinguish **invocation** (does a skill fire unprompted — measured at ~0%)
  from **efficacy** (does it help once followed — good on the 3 skills tested).
  Conflating them is the easiest way to be wrong here.
- When you add a check, verify it can fail. A test that cannot fail is
  decoration; mutate the thing it guards and confirm it goes red.

## Portability

Skills install to Claude Code, Codex, Cursor and Antigravity via
`scripts/install.mjs`. Hooks and the plugin manifest are Claude Code specific —
see [INSTALL.md](./INSTALL.md#portability) for what each tool gets.
