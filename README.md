# agent-skills

Cursor / Agent Skills suite for building product UI with **passive engineering defaults**, **interviewed design & UX**, and **adversarial acceptance**.

Evergreen rule: skill cores are **invariants + ask/stop + evidence**. Framework and cloud fashion belong only in dated `recipes/` files (optional).

## Skills

| Skill | Role |
|---|---|
| [`build`](./build/) | Thin router — engineering by default; interview for design/UX |
| [`systems-architecture`](./systems-architecture/) | Boundaries, trust, `ARCHITECTURE.md` |
| [`frontend-engineering`](./frontend-engineering/) | Job→stack (no React monoculture), structure gates |
| [`frontend-design`](./frontend-design/) | Tokens, visual craft, design critique / layout CI |
| [`product-acceptance`](./product-acceptance/) | Outcome SHIP/BLOCK vs product contract (builder ≠ acceptor) |

Charters and shared vocabulary: [`_suite-charters/`](./_suite-charters/).

## Pipeline

```
build
  → PRODUCT.md
  → systems-architecture   (if multi-part)
  → frontend-engineering   (if stack/structure open)
  → interview design/UX
  → frontend-design
  → implement
  → product-acceptance     (separate turn)
```

## Install

| Harness | Where skills go | Details |
|---|---|---|
| **Cursor** | `~/.cursor/skills/<name>/` | Reload Cursor |
| **Claude Code** | `~/.claude/skills/<name>/` or `.claude/skills/` | `/build`, etc. |
| **Claude Desktop / claude.ai** | Account Customize **or** local `~/.claude/skills/` for local Code sessions | Cloud/Cowork ≠ disk skills |
| **Codex CLI / ChatGPT desktop** | `~/.agents/skills/<name>/` or `.agents/skills/` | `/skills` or `$build` |

Full steps (Windows + macOS/Linux, zip upload, one-shot install): **[INSTALL.md](./INSTALL.md)**.

## Smoke-test scripts (no agent)

```bash
node frontend-engineering/scripts/profile-stack.js --root /path/to/project
node frontend-engineering/scripts/check-structure.js --root /path/to/project --strict

node systems-architecture/scripts/profile-architecture.js --root /path/to/project
node systems-architecture/scripts/check-architecture.js --root /path/to/project --strict

node frontend-design/scripts/profile-project.js --root /path/to/project

node product-acceptance/scripts/accept-check.js --root /path/to/project --strict
```

## Related

- Preview runtime product (separate): [frescowork](https://github.com/fstubner/frescowork)
- Former home of the design skill only: archived [`frontend-design`](https://github.com/fstubner/frontend-design) → use this repo

## License

See individual skill folders if present; otherwise all rights reserved unless stated.
