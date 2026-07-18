# Status and known gaps

**Suite version:** [VERSION](./VERSION) (`v0.3.0`)  
**Maturity:** public beta — credible internals; unprimed multi-harness eval still thin

## Philosophy

| Layer | Role |
|---|---|
| Skills | Judgment |
| References | Understanding |
| Scripts | Verification (evidence for self-correction) |

Scripts do **not** decide taste, interview quality, or “best” architecture.

## Fixed in 0.3.0

| Gap | Resolution |
|---|---|
| accept-check never SHIP | Self-grade note vs `--acceptor-context` |
| Missing arch counted as pass | `not_evaluated` status |
| Narrow app detection | Shared `classify-project` + pipeline profiles first |
| No licence / CI / fixtures | MIT + Actions + fixture tests |
| Copy-list drift | `suite.manifest.json` + `install.mjs` |
| Over-strong production claim | README claim language tightened |

## Still open (toward 0.5 / 1.0)

| Gap | Plan |
|---|---|
| Unprimed multi-run eval across Cursor / Claude / Codex | [Protocol below](#unprimed-evaluation); publish results as issues |
| Richer JSON schemas for all reports | Incremental under `_suite/schemas/` |
| Backend verification scripts | When patterns stabilize |
| Signed release archives | Optional later; tags + CI sufficient for now |

## Compatibility (supported install targets)

| Harness | Skill path | Notes |
|---|---|---|
| Cursor | `~/.cursor/skills/` | Reload chat |
| Claude Code | `~/.claude/skills/` or `.claude/skills/` | `/build` |
| Claude Desktop cloud | Account Customize | Disk skills not used |
| Codex CLI / ChatGPT desktop | `~/.agents/skills/` or `.agents/skills/` | `$build` / `/skills` |

## Unprimed evaluation

1. Install from tag `v0.3.0` via `node scripts/install.mjs --harness <name>`.
2. Empty project; new session; prompt only:

   > Build a small multi-view tool for tracking three team OKRs: list, detail, and settings. Include a tiny API.

3. Score separately (do not collapse into one vague pass):
   - Product interview or PRODUCT.md before chrome
   - Architecture artifact for client+server
   - Non-monolith / justified stack
   - Design/UX interview signals
   - Acceptance not self-SHIP’d same turn
4. File `unprimed: <harness> <model> <date>` with pass/fail per bullet.

## Consumer expectations

- Pin a **tag** (`v0.3.0`), not floating `main`, for dependable installs.
- Treat script JSON as evidence; judgment stays in skills.
