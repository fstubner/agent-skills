# Status

**Suite version:** [VERSION](./VERSION) (`v0.4.0`)  
**Maturity:** public beta

## Layers

| Layer | Role |
|---|---|
| Skills | Judgment |
| References | Understanding |
| Scripts | Verification (evidence for self-correction) |

Scripts do **not** decide taste, interview quality, or “best” architecture.

## Package assets

| Asset | Path |
|---|---|
| Report schemas | `_suite/schemas/` |
| Fixture tests | `fixtures/` + `scripts/run-fixture-tests.mjs` |
| Backend verification | `backend-engineering/scripts/check-backend.js` |
| Unprimed eval cases | `eval/cases/` |
| Eval scoring | `scripts/score-eval-results.mjs` |
| Eval issue template | `.github/ISSUE_TEMPLATE/unprimed-eval.yml` |
| Install manifest | `suite.manifest.json` |

## Compatibility

| Harness | Skill path |
|---|---|
| Cursor | `~/.cursor/skills/` |
| Claude Code | `~/.claude/skills/` or `.claude/skills/` |
| Claude Desktop cloud | Account Customize |
| Codex CLI / ChatGPT desktop | `~/.agents/skills/` or `.agents/skills/` |

## Consumer expectations

- Pin a **tag**, not floating `main`.
- Treat script JSON as evidence; judgment stays in skills.
- Publish unprimed runs as `eval/results/*.json` + GitHub issues (`unprimed-eval`).
