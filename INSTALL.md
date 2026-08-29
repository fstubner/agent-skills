# Install

> **EVIDENCE STATUS: UNVALIDATED.** Installation is supported and the
> deterministic checkers are fixture-tested. Behavioural efficacy is not yet
> established under the repository's v2 evaluation standard.

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
node scripts/install.mjs --harness codex        # ~/.agents/skills
node scripts/install.mjs --harness antigravity  # ~/.gemini/antigravity-cli/skills
node scripts/install.mjs --harness all
node scripts/install.mjs --dest /path/to/skills   # anywhere else
```

Codex installs to its documented shared path, `~/.agents/skills`. Older
versions also copied each skill to `~/.codex/skills`; Codex CLI 0.146.0 loads
both roots and exposes those as duplicate catalog entries. A successful Codex
install now removes only legacy copies bearing this installer's ownership
marker. Hand-managed directories are left untouched.

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

## As a marketplace plugin

The repository contains native marketplace metadata for Claude Code, Codex CLI
and ChatGPT desktop, and Cursor. All three point at the same generated,
self-contained package under `plugins/agent-skills`; it contains the 17 skills
and their checker runtime. Availability and installation differ by product, as
documented below. Telemetry and the optional concise response style are not
enabled by installing the plugin.

Claude Code (CLI and desktop app):

```bash
claude plugin marketplace add fstubner/agent-skills
claude plugin install agent-skills@fstubner-agent-skills
```

Codex CLI can add and track this repository as a marketplace source:

```bash
codex plugin marketplace add fstubner/agent-skills --ref main
```

The CLI command configures the catalog source; OpenAI documents installation
and local plugin testing in the ChatGPT desktop app. Restart the app, open the
Plugins Directory in Work mode or Codex, select **Felix Stubner Agent Skills**
as the marketplace, then install `agent-skills`. A repository marketplace is an
authoring, testing, and team-distribution source. It is separate from the
universal public Plugins Directory shared by ChatGPT and Codex; appearing there
requires OpenAI's publication process. See [OpenAI's plugin packaging and
marketplace documentation](https://developers.openai.com/plugins/build/plugins).

Cursor has three documented installation paths:

- **Public Marketplace:** after the plugin is reviewed and listed, open
  **Customize** in Cursor, find the plugin, select **Install**, and choose user
  or project scope. This repository is not public-Marketplace-listed merely
  because it contains a manifest.
- **Team marketplace:** a Teams or Enterprise administrator opens
  **Dashboard → Plugins → Add Marketplace**, chooses **Import from Repo**, and
  supplies `https://github.com/fstubner/agent-skills`. Enable **Auto Refresh**
  if the Cursor GitHub App is installed and updates should follow repository
  pushes. Team members then install it from **Customize**.
- **Local testing:** copy or link `plugins/agent-skills` to
  `~/.cursor/plugins/local/agent-skills`, then restart Cursor or run
  **Developer: Reload Window**.

See [Cursor's official Plugins documentation](https://cursor.com/docs/plugins)
for Marketplace review, team import, update, and local-development behavior.

Antigravity CLI uses a native plugin package rather than a repository
marketplace. Clone the repository, install its generated package, and verify
that the CLI loaded it:

```bash
git clone https://github.com/fstubner/agent-skills.git
cd agent-skills
agy plugin install ./plugins/agent-skills
agy plugin list
```

The package has Antigravity's required root `plugin.json` and a `skills/`
directory. The manifest deliberately has no version field because the current
Antigravity schema rejects additional properties. The generated-package check
still prevents it from drifting from the repository source.

Antigravity IDE discovers workspace skills from
`<workspace-root>/.agents/skills` and global skills from
`~/.gemini/config/skills`. These IDE paths are distinct from Antigravity CLI's
standalone global-skills path, `~/.gemini/antigravity-cli/skills`.
See Antigravity's official [CLI plugin](https://antigravity.google/docs/cli/plugins)
and [IDE Agent Skills](https://antigravity.google/docs/skills) references.

Gemini CLI can install this repository directly as an extension. Use
`--auto-update` if you want Gemini to fetch future releases automatically:

```bash
gemini extensions install https://github.com/fstubner/agent-skills --auto-update
gemini extensions list
gemini extensions update agent-skills
# Local development: changes are visible without reinstalling.
gemini extensions link /path/to/agent-skills
```

Gemini copies an extension on installation; without `--auto-update`, run
`gemini extensions update agent-skills` explicitly. Restart Gemini CLI after
installing or updating so the new extension contents are loaded.
See the official [Gemini extension reference](https://geminicli.com/docs/extensions/reference/)
for lifecycle and source-selection options.

For local development, point the marketplace at a checkout instead:
`claude plugin marketplace add ./` from the repository root. Know the
tradeoff: a directory source copies the **working tree**, gitignored files
included — this repo once shipped 645KB of session transcripts into the
local plugin cache that way. The GitHub source packages only tracked files,
which is why it is the default instruction above. Plugin skills are
namespaced — `product-build` becomes `agent-skills:product-build`.

## Installing is not the same as invoking

**Read this before concluding the suite doesn't work.** Installed skills
are offered to the model as a name and a one-line description; whether it
reaches for one is its own decision. Measured here, that decision came out
badly: across two unprimed runs on a prompt matching `product-build`'s own
stated trigger almost verbatim — one in a Task subagent, one in a genuine
top-level session, every skill in that release installed — **not a single skill fired**
(`eval/results/`). A competing plugin's much more aggressive mechanism
(injecting a whole skill's text into every session via a `SessionStart`
hook) didn't reliably fire either.

The historical forced runs are not credible efficacy evidence: they lack
complete raw traces and output bundles, mostly use one trial, and do not
separate a concise-policy baseline from the full skill. They remain available
for audit, but the current answer to whether skills improve outcomes is
**unknown**.

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

Don't take the numbers above on trust. Install user-level observers for the
harnesses you use:

```bash
node scripts/install-telemetry.mjs --harness all
# or: claude | codex | cursor | antigravity
```

This is deliberately separate from `install.mjs`: it merges global harness
configuration and records local metadata, so installing a skill must not opt
you in silently. Existing hooks are preserved and rerunning the command is
idempotent. Remove the hook entries with
`node scripts/install-telemetry.mjs --harness all --remove`; the local log is
left in place.

All four adapters write to
`~/.agent-skills-telemetry/invocations.jsonl`. The reader also includes the
old Claude-only log at
`~/.claude/agent-skills-telemetry/invocations.jsonl`, so upgrading does not
erase history. Read the combined data with:

```bash
node scripts/skill-usage.mjs
```

It reports per-skill, per-project, per-harness, and per-evidence counts and,
most usefully, cross-checks `registry.json` to list skills that have **never**
fired. An empty report is not an error — it is the finding.

The evidence is not identical across harnesses. Claude exposes a first-class
`Skill` tool call. Codex and Cursor expose successful tool/file reads, so the
adapter records a registered skill's `SKILL.md` being read. Antigravity's
documented `PostInvocation` hook exposes its transcript path; the adapter
records registered `SKILL.md` read requests found there and deduplicates them
by conversation step. Its evidence label is `skill-file-read-request`, not a
claim that the requested tool completed. Every row labels these distinctions;
do not collapse a file read into a stronger first-class invocation claim.

Codex requires a one-time trust review for newly installed command hooks. Run
`/hooks` in Codex and review the `agent-skills-telemetry` command before
expecting Codex rows. The other harnesses load their user hook files directly.

The hook is deliberate rather than a skill: a telemetry *skill* would only
record the sessions where the model remembered to record, which is the same
selection bias that makes the invocation question unanswerable in the first
place.

This measures invocation only. Whether a skill improved the work is a
separate question needing the forced-exposure A/B protocol in `eval/` — a
usage count that gets read as an efficacy signal is worse than no number.

## Portability

The skills are portable. The delivery mechanisms around them mostly are not,
and it is worth knowing which is which before assuming a feature reached you.

| Component | Claude Code | Codex | Cursor | Antigravity |
|---|---|---|---|---|
| 17 skills (`SKILL.md` + `references/`, `scripts/`, `assets/`) | ✓ | ✓ | ✓ | ✓ |
| Checker scripts (plain Node, no harness API) | ✓ | ✓ | ✓ | ✓ |
| Pre-commit hook (`git`, not a harness feature) | ✓ | ✓ | ✓ | ✓ |
| `AGENTS.md` in your project | ✓ | ✓ | ✓ | ✓ |
| Repository plugin marketplace | ✓ | ✓ | ✓ | — |
| Native plugin / extension package | ✓ | ✓ | ✓ | ✓ |
| Standard skills / extension install | ✓ | ✓ | ✓ | ✓ |
| Telemetry observer | ✓ | ✓ | ✓ | ✓ |
| Response-style injection | ✓ | — | — | — |

`scripts/install.mjs` handles skill installation for every harness.
`scripts/install-telemetry.mjs` installs the harness-native observers above.
Response-style injection remains Claude-plugin-specific.

**Non-Claude tools: the response style still works, manually.**
`concise-style/output-style/concise.md` is plain markdown with no Claude-specific syntax.
Point your tool's own always-on context file at it — `AGENTS.md` for Codex and
most agent CLIs, `.cursorrules` for Cursor — rather than copying the text, so
there is one copy to keep true:

```markdown
## Response style
Follow the rules in `.agents/concise-style/output-style/concise.md`.
```

**Prefer `AGENTS.md` over a per-tool file** where your tool supports it. A
tool-specific file (`CLAUDE.md`, `.cursorrules`) is best written as a pointer
to it, as this repo's own `CLAUDE.md` does — two copies of the same guidance
drift, and then which tool you happened to open decides which version is true.

## Claude Desktop (cloud)

Distinct from the Claude Code desktop app above: claude.ai has no
filesystem target and no plugin system. Upload skill folders through the
UI. The vendored `scripts/vendor/` directory makes each folder
self-contained, but skills run sandboxed there with no network access, so
the checkers that shell out to `gitleaks` or `vale` report
`not_evaluated` rather than running.

## Pinning

Install from a git tag, not `main`. Each skill's `.agent-skills-install.json`
records what it came from:

```json
{
  "suite": "fstubner/agent-skills",
  "version": "1.0.0-alpha.22",
  "gitCommitSha": "412da6bc5cc921c9aa6a0220cfbdca3299026270",
  "gitDescribe": "v1.0.0-alpha.13-50-g412da6b",
  "installedAt": "2026-08-29T02:08:29.284Z"
}
```

**`version` alone cannot tell you whether an install is current**, which is why
the commit is there too. `VERSION` does not move with every commit — 29 commits
on `main` stamp `1.0.0-alpha.22`, and an install from any of them reports the
same version as an install from the newest. That is not hypothetical: a stale
install here reported `1.0.0-alpha.22` while missing content from a commit made
that same day, and nothing in the marker could say so.
Compare `gitCommitSha` against the tree you meant to install; `gitDescribe`
answers the same question in a form you can read, and ends in `-dirty` if the
source tree had uncommitted changes.

The two git fields are **absent** rather than guessed when the source has no
history — an extracted tarball, or a copy vendored inside another repository.
`version` and `suite` are always present.
