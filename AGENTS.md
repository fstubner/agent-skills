# AGENTS.md

Instructions for any AI agent working on this repository. `CLAUDE.md` and any
other tool-specific file point here instead of repeating it.

To use the skills in your own projects, see [INSTALL.md](./INSTALL.md).

## What this repository is

19 Agent Skills and the deterministic checkers behind them. `registry.json` is
the source of truth for the skills, their artifacts, which artifacts the
acceptance gate checks, and where each harness installs.

## Response style

Follow [concise-style/output-style/concise.md](./concise-style/output-style/concise.md).
Claude Code injects the same file through a SessionStart hook, and other tools
should read it directly. In short, answer first, keep it to a few sentences
by default, and skip closing summaries and status updates nobody asked for.

## Before you commit

```bash
node scripts/run-tests.mjs
```

Everything must pass. The suite checks `registry.json`, `docs/CONTRACT.md`,
`CHANGELOG.md`, `VERSION` and `.claude-plugin/plugin.json` against each other,
so a change to one that isn't reflected in the others fails.

The pre-commit hook runs gitleaks and the `code-smells`, `code-organization`
and `data-modeling` checkers on staged files. Turn it on with this.

```bash
git config core.hooksPath scripts/git-hooks
```

It's optional but recommended. `vale` and `gitleaks` are external tools, and
tests that need them are skipped when they aren't installed.

## Enforced conventions

| Rule | Enforced by |
|---|---|
| Skill subdirectories are `scripts/`, `references/` and `assets/` | `scripts/tests/structure.mjs` |
| Paths named in a `SKILL.md` must exist | same |
| Every skill on disk is in `registry.json`, and the reverse | same |
| `VERSION` matches the `plugin.json` version and is valid semver | same |
| `docs/CONTRACT.md` is generated, never edited by hand | `scripts/gen-contract.mjs --check` |
| `skills/`, `plugins/`, `.agents/plugins/`, `.cursor-plugin/` and `gemini-extension.json` are generated from the top-level skill directories, `core/`, `registry.json` and `VERSION` | `scripts/gen-plugin-bundles.mjs --check`, the pre-commit hook, `scripts/tests/plugin-bundles.mjs` |

Edit the source and run `node scripts/gen-plugin-bundles.mjs`, never the
generated trees. They're marked only by a `.generated-by-agent-skills` file,
and an edit under `skills/<id>/` is overwritten by the next regeneration.

`scripts/`, `references/` and `assets/` follow Anthropic's skill convention
for executable code, reference docs and files used in output. The one
exception is `rules/` in `ai-prose-slop` and `repo-docs`, which uses the layout
Vale requires.

## Claims

This repository is about whether agent guidance works, so its claims have to
be measured.

- Don't describe a skill as effective without a recorded run in `eval/`. No
  skill currently meets that bar.
- Keep invocation and efficacy apart. Invocation is whether a skill gets used
  without being asked for, which the field data in `eval/results/` measures.
  Efficacy is whether it improves the work once used, which is not yet
  established.
- When you add a check, make sure it can fail. Break the thing it guards and
  confirm it goes red.

## Portability

`scripts/install.mjs` installs skills for Claude Code, Codex, Cursor and
Antigravity. Hooks and the plugin manifest are Claude Code specific. See
[INSTALL.md](./INSTALL.md#portability) for what each tool gets.
