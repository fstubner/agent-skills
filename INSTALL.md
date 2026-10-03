# Install

## Requirements

Node 18 or later. There is no npm install and no network access, because the
installer only copies files.

Two skills use an external CLI for their deterministic checks.
`ai-prose-slop` uses [Vale](https://vale.sh), and `backend-engineering` and
the optional pre-commit hook use
[gitleaks](https://github.com/gitleaks/gitleaks). Without the CLI, those
checks report `not_evaluated` instead of passing.

## Per harness

```bash
node scripts/install.mjs --harness claude       # ~/.claude/skills (Claude Code and Claude Desktop share it)
node scripts/install.mjs --harness cursor       # ~/.cursor/skills
node scripts/install.mjs --harness codex        # ~/.agents/skills
node scripts/install.mjs --harness antigravity  # ~/.gemini/antigravity-cli/skills
node scripts/install.mjs --harness all
node scripts/install.mjs --dest /path/to/skills   # anywhere else
```

Run these from the root of your checkout. They work the same on Windows,
macOS and Linux, since the installer expands `~` itself.

Codex installs to its documented shared path, `~/.agents/skills`. A Codex
install also removes copies an older version of this installer left in
`~/.codex/skills`, because Codex loads both paths and lists each skill twice.
Directories the installer didn't create are left alone.

## Installing some of the skills

Each skill works on its own, so you can install only the ones you want.

```bash
node scripts/install.mjs --harness claude --skill ai-prose-slop
node scripts/install.mjs --harness claude --skill frontend,backend-engineering
```

Leaving out `--skill` installs all of them. `node scripts/install.mjs --help`
lists the skill ids.

## What the installer guarantees

- **No default target.** Run without arguments, it prints usage and writes
  nothing.
- **No overwriting.** A skill directory the installer didn't create has no
  `.agent-skills-install.json` marker, and it is skipped with a warning. Pass
  `--force` to replace it.
- **Each skill is self-contained.** Every installed skill carries its own copy
  of the shared core in `scripts/vendor/`, so a single skill works alone. The
  one exception is `product-acceptance`, which reports any sibling checker it
  can't find as `not_evaluated` and caps its verdict at CONDITIONAL.

## As a marketplace plugin

The repository has marketplace metadata for Claude Code, Codex (CLI and the
ChatGPT desktop app) and Cursor. All three point at the same generated package
in `plugins/agent-skills`, which holds the 17 skills and their checkers.
Installing the plugin doesn't turn on telemetry or the concise response
style.

### Claude Code

```bash
claude plugin marketplace add fstubner/agent-skills
claude plugin install agent-skills@fstubner-agent-skills
```

Plugin skills are namespaced, so `product-build` becomes
`agent-skills:product-build`.

To test from a local checkout, run `claude plugin marketplace add ./` from the
repository root. A directory source copies the whole working tree, including
gitignored files, so anything local such as session transcripts ends up in the
plugin cache. The GitHub source packages tracked files only, which is why it's
the default above.

### Codex

```bash
codex plugin marketplace add fstubner/agent-skills --ref main
```

This adds the catalogue source. To install, restart the ChatGPT desktop app,
open the Plugins Directory in Work mode or Codex, select **Felix Stubner Agent
Skills** as the marketplace and install `agent-skills`. A repository
marketplace is for testing and team distribution. The public Plugins Directory
is separate and needs OpenAI's publication process. See
[OpenAI's plugin documentation](https://developers.openai.com/plugins/build/plugins).

### Cursor

- **Public Marketplace.** Once the plugin is reviewed and listed, open
  **Customize**, find it, select **Install** and choose user or project scope.
  Having a manifest in this repository doesn't list it.
- **Team marketplace.** A Teams or Enterprise admin opens **Dashboard →
  Plugins → Add Marketplace**, chooses **Import from Repo** and enters
  `https://github.com/fstubner/agent-skills`. Turn on **Auto Refresh** if the
  Cursor GitHub App is installed and updates should follow pushes. Team
  members then install it from **Customize**.
- **Local testing.** Copy or link `plugins/agent-skills` to
  `~/.cursor/plugins/local/agent-skills`, then restart Cursor or run
  **Developer: Reload Window**.

See [Cursor's plugin documentation](https://cursor.com/docs/plugins).

### Antigravity

Antigravity CLI installs a native plugin package from a local checkout.

```bash
git clone https://github.com/fstubner/agent-skills.git
cd agent-skills
agy plugin install ./plugins/agent-skills
agy plugin list
```

The package has the root `plugin.json` and `skills/` directory Antigravity
requires. Its manifest has no version field, because Antigravity's schema
rejects extra properties.

Antigravity IDE finds workspace skills in `<workspace-root>/.agents/skills` and
global skills in `~/.gemini/config/skills`. Those are separate from the CLI's
global path, `~/.gemini/antigravity-cli/skills`. See Antigravity's
[CLI plugin](https://antigravity.google/docs/plugins?tab=cli) and
[IDE skills](https://antigravity.google/docs/skills) documentation.

### Gemini CLI

```bash
gemini extensions install https://github.com/fstubner/agent-skills --auto-update
gemini extensions list
gemini extensions update agent-skills
# Local development: changes show up without reinstalling.
gemini extensions link /path/to/agent-skills
```

Gemini copies an extension when it installs it. Without `--auto-update`, run
`gemini extensions update agent-skills` to get new releases. Restart Gemini
CLI after installing or updating. See the
[Gemini extension reference](https://geminicli.com/docs/extensions/reference/).

## Installing is not the same as invoking

An installed skill is offered to the model as a name and a one-line
description, and the model decides whether to use it. In two unprimed runs
with a prompt that closely matched `product-build`'s trigger, one in a Task
subagent and one in a top-level session, no skill was used.

The one thing I've seen reliably change that is a line in `CLAUDE.md`, which
goes into every session verbatim. To make a skill fire, add something like
this to your project's `CLAUDE.md`.

```markdown
For a greenfield or multi-view build request, use the product-build skill
before writing code. Before claiming work is done, use product-acceptance
in a separate turn.
```

### Measuring it yourself

Install the usage observers for the harnesses you use.

```bash
node scripts/install-telemetry.mjs --harness all
# or: claude | codex | cursor | antigravity
```

This is separate from `install.mjs` because it changes global harness
configuration, so installing a skill never opts you in. It keeps existing
hooks and is safe to re-run. Remove the hooks with
`node scripts/install-telemetry.mjs --harness all --remove`, which leaves the
log in place.

All four observers write to `~/.agent-skills-telemetry/invocations.jsonl`. The
reader also picks up the older Claude-only log at
`~/.claude/agent-skills-telemetry/invocations.jsonl`. Read the data with this.

```bash
node scripts/skill-usage.mjs
```

It counts invocations per skill, project, harness and evidence type, and lists
registered skills that have never been used.

The evidence differs by harness, and every row says which kind it is.

- **Claude Code** has a first-class `Skill` tool call.
- **Codex and Cursor** show a skill's `SKILL.md` being read.
- **Antigravity** shows a request to read `SKILL.md`, found in the transcript
  its `PostInvocation` hook exposes and deduplicated per conversation step. It
  is labelled `skill-file-read-request` because it doesn't confirm the read
  completed.

Codex asks you to review newly installed command hooks once. Run `/hooks` in
Codex and approve `agent-skills-telemetry` before expecting Codex rows.

This counts invocations only. Whether a skill made the work better needs the
controlled comparison in `eval/`.

## Portability

The skills work everywhere. Most of the delivery around them is
harness-specific.

| Component | Claude Code | Codex | Cursor | Antigravity |
|---|---|---|---|---|
| 17 skills (`SKILL.md`, `references/`, `scripts/`, `assets/`) | ✓ | ✓ | ✓ | ✓ |
| Checker scripts (plain Node) | ✓ | ✓ | ✓ | ✓ |
| Pre-commit hook (git) | ✓ | ✓ | ✓ | ✓ |
| `AGENTS.md` in your project | ✓ | ✓ | ✓ | ✓ |
| Repository plugin marketplace | ✓ | ✓ | ✓ | |
| Native plugin or extension package | ✓ | ✓ | ✓ | ✓ |
| Standard skills or extension install | ✓ | ✓ | ✓ | ✓ |
| Telemetry observer | ✓ | ✓ | ✓ | ✓ |
| Response-style injection | ✓ | | | |

`scripts/install.mjs` installs skills for every harness, and
`scripts/install-telemetry.mjs` installs the observers. Response-style
injection only exists in the Claude plugin.

Other tools can still use the response style.
`concise-style/output-style/concise.md` is plain markdown. Point your tool's
always-on context file at it, which is `AGENTS.md` for Codex and most agent
CLIs and `.cursorrules` for Cursor, so there's only one copy to maintain.

```markdown
## Response style
Follow the rules in `.agents/concise-style/output-style/concise.md`.
```

Use `AGENTS.md` where your tool supports it, and make any tool-specific file
like `CLAUDE.md` or `.cursorrules` a pointer to it, the way this repository's
`CLAUDE.md` is. Two copies of the same guidance drift apart.

## Claude Desktop (cloud)

claude.ai is separate from the Claude Code desktop app. It has no filesystem
target and no plugin system, so upload skill folders through the UI. Each
folder is self-contained thanks to `scripts/vendor/`, but skills run sandboxed
there without network access, so checkers that need `gitleaks` or `vale`
report `not_evaluated`.

## Pinning

Install from a git tag instead of `main`. Each installed skill records where
it came from in `.agent-skills-install.json`.

```json
{
  "suite": "fstubner/agent-skills",
  "version": "0.3.0",
  "gitCommitSha": "<40-character commit sha>",
  "gitDescribe": "v0.3.0-12-g<short sha>",
  "installedAt": "<ISO timestamp>"
}
```

`version` alone can't tell you whether an install is current, because
`VERSION` doesn't change with every commit. Compare `gitCommitSha` with the
commit you meant to install. `gitDescribe` gives the same answer in readable
form and ends in `-dirty` if the source tree had uncommitted changes.

The two git fields are left out when the source has no git history, such as
an extracted tarball or a copy vendored into another repository. `version`
and `suite` are always present.
