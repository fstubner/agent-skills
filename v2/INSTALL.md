# Install

## Requirements

Node 18+. No npm install, no network — the installer only copies files.
Two skills want an external CLI on PATH for their deterministic layer, and
both degrade honestly (report `not_evaluated`, never a silent pass) when
it's absent: `ai-prose-slop` wants [Vale](https://vale.sh);
`backend-engineering` and the opt-in pre-commit hook want
[gitleaks](https://github.com/gitleaks/gitleaks).

## Per-harness

```bash
node scripts/install.mjs --harness claude       # ~/.claude/skills (Claude Code + Claude Desktop, same path)
node scripts/install.mjs --harness cursor       # ~/.cursor/skills
node scripts/install.mjs --harness codex        # ~/.codex/skills AND ~/.agents/skills (see note below)
node scripts/install.mjs --harness antigravity  # ~/.gemini/antigravity-cli/skills
node scripts/install.mjs --harness all
node scripts/install.mjs --dest /path/to/skills   # anywhere else
```

Codex installs to **two** paths deliberately: its own skill directory
convention is unsettled upstream as of mid-2026 (OpenAI's skill-installer
tooling still defaults to `~/.codex/skills`; current docs point to
`~/.agents/skills`; the Codex Desktop app has open bugs failing to discover
skills in the latter). Installing to both is a hedge against that
instability, not a claim that either one is settled — see
`registry.json`'s `_harnessPathsNote`.

Windows, macOS, and Linux: identical commands (`~` is expanded by the
installer, not the shell). Run them from the suite checkout root.

## Installing a subset

This is a composable set of skills, not an all-or-nothing suite — grab only
what you want:

```bash
node scripts/install.mjs --harness claude --skill ai-prose-slop
node scripts/install.mjs --harness claude --skill frontend,backend-engineering
```

Omitting `--skill` installs all of them. `node scripts/install.mjs --help`
lists the current skill ids.

## Behavior you can rely on

- **No default target.** No args → usage text, nothing written.
- **No clobbering.** An existing skill directory the installer didn't create
  (marker: `.agent-skills-install.json`) is skipped with a warning; replace
  it explicitly with `--force`.
- **Standalone skills.** Each installed skill carries a vendored copy of the
  suite core (`scripts/vendor/`), so single-skill installs work — with one
  documented seam: `product-acceptance` reports sibling checkers it can't
  find as `not_evaluated`, capping its verdict at CONDITIONAL rather than
  guessing.

## Claude Desktop (cloud)

No filesystem target exists; upload skill folders through the UI. The
vendored `scripts/vendor/` directory makes each folder self-contained.

## Pinning

Install from a git tag, not `main`. The version you installed is recorded in
each skill's `.agent-skills-install.json`.
