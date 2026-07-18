# Contributing

## Three layers (keep them distinct)

| Layer | Responsibility | Lives in |
|---|---|---|
| **Skills** | Judgment: principles, routing, stop conditions, interviews | `*/SKILL.md` |
| **References** | Understanding: rationale, patterns, anti-patterns | `*/references/` |
| **Scripts** | Verification: objective evidence + self-correction loops | `*/scripts/`, `_suite/` |

Do not turn SKILL.md into a tutorial. Do not make scripts invent design taste.

## Local checks (required before PR)

```bash
node scripts/run-fixture-tests.mjs
```

CI runs the same command.

## Adding a skill

1. Add folder with `SKILL.md` (`name` + `description` frontmatter).
2. Register it in `suite.manifest.json`.
3. Update `_suite-charters/` if needed.
4. Bump `VERSION` + `CHANGELOG.md`.
5. Prefer fixtures for any new verification script.

## Compatibility claim

We claim: *tested decision procedures and verification tools that materially improve agent behavior across supported harnesses, with documented limitations.*

We do **not** claim agents always auto-follow the full pipeline.
