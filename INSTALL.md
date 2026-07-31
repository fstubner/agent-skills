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

## As a Claude Code plugin

Claude Code (CLI and desktop app) can install the whole suite as a plugin,
which also enables the skill-invocation telemetry hook:

```bash
claude plugin marketplace add fstubner/agent-skills
claude plugin install agent-skills@fstubner-agent-skills
```

For local development, point the marketplace at a checkout instead:
`claude plugin marketplace add ./` from the repository root. Plugin skills
are namespaced — `product-build` becomes `agent-skills:product-build`.

## Installing is not the same as invoking

**Read this before concluding the suite doesn't work.** Installed skills
are offered to the model as a name and a one-line description; whether it
reaches for one is its own decision. Measured here, that decision came out
badly: across two unprimed runs on a prompt matching `product-build`'s own
stated trigger almost verbatim — one in a Task subagent, one in a genuine
top-level session, all 15 skills installed — **not a single skill fired**
(`eval/results/`). A competing plugin's much more aggressive mechanism
(injecting a whole skill's text into every session via a `SessionStart`
hook) didn't reliably fire either.

Efficacy, once a skill is actually followed, measured well on the three
skills tested that way — 0/3 vs 3/3 for `systems-architecture`, and
similar gaps for `cli-tooling` and `product-build`'s prompt-injection
stance. So the content earns its place; getting it reached for is the
unsolved half.

The one mechanism observed to reliably change behaviour in this
environment is a directive in `CLAUDE.md`, which is injected verbatim into
every session rather than offered as an option. If you want a skill to
actually fire, add a line to your project's `CLAUDE.md`:

```markdown
For a greenfield or multi-view build request, use the product-build skill
before writing code. Before claiming work is done, use product-acceptance
in a separate turn.
```

That is a workaround for a real limitation, not a feature of this suite —
stated plainly because the alternative is you installing it, seeing no
change, and reasonably concluding it does nothing.

### Measuring it yourself

Don't take the numbers above on trust — the plugin ships a `PostToolUse`
hook that records every skill invocation to
`<project>/.agent-skills-telemetry/invocations.jsonl` (gitignored). Read it
back with:

```bash
node scripts/skill-usage.mjs
```

It reports per-skill and per-project counts and, most usefully, cross-checks
`registry.json` to list the skills that have **never** fired. An empty
report is not an error — it is the finding.

The hook is deliberate rather than a skill: a telemetry *skill* would only
record the sessions where the model remembered to record, which is the same
selection bias that makes the invocation question unanswerable in the first
place.

This measures invocation only. Whether a skill improved the work is a
separate question needing the forced-exposure A/B protocol in `eval/` — a
usage count that gets read as an efficacy signal is worse than no number.

## Claude Desktop (cloud)

Distinct from the Claude Code desktop app above: claude.ai has no
filesystem target and no plugin system. Upload skill folders through the
UI. The vendored `scripts/vendor/` directory makes each folder
self-contained, but skills run sandboxed there with no network access, so
the checkers that shell out to `gitleaks` or `vale` report
`not_evaluated` rather than running.

## Pinning

Install from a git tag, not `main`. The version you installed is recorded in
each skill's `.agent-skills-install.json`.
