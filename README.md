# agent-skills

**Version:** [VERSION](./VERSION) · **Tag installs:** `v0.3.0` · **Changelog:** [CHANGELOG.md](./CHANGELOG.md) · **Status:** [STATUS.md](./STATUS.md) · **License:** [MIT](./LICENSE)

Agent Skills suite (Cursor / Claude Code / Claude Desktop / Codex) for product UI work:

- **Passive engineering defaults** (architecture, stack, structure, backend laws)
- **Interviewed design & UX** (do not invent aesthetics or primary flows)
- **Adversarial acceptance** (builder ≠ acceptor)

## What we claim

> This suite provides **tested decision procedures and verification tools** that materially improve agent behavior across supported harnesses, with **documented limitations**.

We do **not** claim agents always auto-follow the full pipeline on every model.

## Three layers

```
Skills (judgment)  →  References (understanding)  →  Scripts (verification)  →  Self-correction
```

| Layer | Answers | Contains |
|---|---|---|
| **Skills** | What / when / why | Principles, routing, interviews, stop rules |
| **References** | What good looks like | Rationale, patterns, anti-patterns |
| **Scripts** | Did measurable properties hold? | Reports for agent self-correction |

Details: [`_suite-charters/LAYERS.md`](./_suite-charters/LAYERS.md).

## Skills

| Skill | Role |
|---|---|
| [`build`](./build/) | **Entry router** |
| [`product-management`](./product-management/) | PRODUCT.md interview |
| [`systems-architecture`](./systems-architecture/) | Boundaries, trust |
| [`frontend-engineering`](./frontend-engineering/) | Stack + structure verification |
| [`frontend-design`](./frontend-design/) | Visual laws |
| [`frontend-ux`](./frontend-ux/) | Primary job + states |
| [`backend-engineering`](./backend-engineering/) | Trusted-side laws |
| [`product-acceptance`](./product-acceptance/) | Outcome verification + adversarial review |

Canonical list: [`suite.manifest.json`](./suite.manifest.json).

## Pipeline

```
build
  → product-management
  → systems-architecture     (if multi-part)
  → frontend-engineering     (if stack/structure open)
  → interview design + UX
  → frontend-design + frontend-ux
  → backend-engineering      (if server)
  → implement
  → product-acceptance       (separate turn; --acceptor-context separate)
```

Optional: [frescowork](https://github.com/fstubner/frescowork) for live human preview feedback.

## Install (prefer a tag)

```bash
git clone --branch v0.3.0 https://github.com/fstubner/agent-skills.git
cd agent-skills
node scripts/install.mjs --harness all   # cursor + claude + codex user dirs
```

Harness-specific paths and Claude Desktop / cloud notes: **[INSTALL.md](./INSTALL.md)**.

## Verification loop (scripts)

```bash
node _suite/scripts/classify-project.js --root .
node systems-architecture/scripts/check-architecture.js --root . --strict
node frontend-engineering/scripts/check-structure.js --root . --strict
node product-acceptance/scripts/accept-check.js --root . --strict --acceptor-context separate
# read *-report.json → repair → re-run
```

`accept-check` check statuses: `pass` | `fail` | `not_evaluated`.  
Notes (e.g. unknown acceptor context) do **not** force CONDITIONAL. SHIP is reachable.

## CI / tests

```bash
node scripts/run-fixture-tests.mjs
```

GitHub Actions runs this on every push/PR (`.github/workflows/ci.yml`).

## Maturity

**Public beta (0.3.x).** Credible for informed teams. See [STATUS.md](./STATUS.md) for remaining eval work toward 0.5 / 1.0.

## Related

- Archived design-only repo: [frontend-design](https://github.com/fstubner/frontend-design)
- Contributing: [CONTRIBUTING.md](./CONTRIBUTING.md) · Security: [SECURITY.md](./SECURITY.md)
