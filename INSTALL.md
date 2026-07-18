# Install

Prefer a **tagged release** (not floating `main`):

```bash
git clone --branch v0.3.0 https://github.com/fstubner/agent-skills.git
cd agent-skills
```

Canonical skill list: [`suite.manifest.json`](./suite.manifest.json).

## Manifest installer (recommended)

```bash
node scripts/install.mjs --harness all      # ~/.cursor, ~/.claude, ~/.agents
node scripts/install.mjs --harness cursor
node scripts/install.mjs --harness claude
node scripts/install.mjs --harness codex
node scripts/install.mjs --dest /path/to/.cursor/skills
```

## Harness notes

| Harness | Path | Invoke |
|---|---|---|
| **Cursor** | `~/.cursor/skills/<name>/` | Reload; start with `build` |
| **Claude Code** | `~/.claude/skills/` or repo `.claude/skills/` | `/build` |
| **Claude Desktop / claude.ai** | **Customize** for cloud/Cowork; disk only for local Code | Enable suite skills in UI |
| **Codex CLI / ChatGPT desktop** | `~/.agents/skills/` or repo `.agents/skills/` | `/skills` or `$build` |

### Claude cloud caveat

Cowork/cloud sessions do **not** read `~/.claude/skills/` on disk. Upload/enable via Customize, or commit `.claude/skills/` for cloud clones.

### Repo-scoped Codex example

```bash
mkdir -p .agents/skills
node scripts/install.mjs --dest .agents/skills
```

## After install

1. Use **`build`** for app/feature work.  
2. Answer product / design / UX interviews.  
3. New turn: **`product-acceptance`** with `--acceptor-context separate`.  

Layers: [`_suite-charters/LAYERS.md`](./_suite-charters/LAYERS.md) · Status: [STATUS.md](./STATUS.md)
