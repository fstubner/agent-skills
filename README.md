# agent-skills

**Version:** see [VERSION](./VERSION) · **Changelog:** [CHANGELOG.md](./CHANGELOG.md) · **Maturity / gaps:** [STATUS.md](./STATUS.md)

Cursor / Claude / Codex skills for product UI with:

- **Passive great engineering** (architecture, stack, structure, backend laws)
- **Interviewed design & UX** (do not invent aesthetics or primary flows)
- **Adversarial acceptance** (builder ≠ acceptor)

## Philosophy

Skills encode **laws, principles, and decision procedures** — not scaffold cookbooks or “run every script” theater.

| Do | Don’t |
|---|---|
| Decision procedures and property gates | Default to React / a cloud vendor |
| Interview when forks are open | Invent PRODUCT.md or visual direction silently |
| Scripts as **evidence** | Treat scripts as the design process |
| Dated `recipes/` that may rot | Put fashion in the skill identity |

## Skills

| Skill | Role |
|---|---|
| [`build`](./build/) | **Entry router** — eng by default; interview design/UX |
| [`product-management`](./product-management/) | PRODUCT.md contract interview |
| [`systems-architecture`](./systems-architecture/) | Boundaries, trust, `ARCHITECTURE.md` |
| [`frontend-engineering`](./frontend-engineering/) | Job→stack, structure gates |
| [`frontend-design`](./frontend-design/) | Visual laws, tokens, craft |
| [`frontend-ux`](./frontend-ux/) | Primary job, states, interaction a11y |
| [`backend-engineering`](./backend-engineering/) | Trusted-side implementation laws |
| [`product-acceptance`](./product-acceptance/) | Outcome SHIP/BLOCK |

Shared vocabulary: [`_suite-charters/`](./_suite-charters/).

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
  → product-acceptance       (separate turn)
```

## Install

Install **all skills**, especially **`build`** (entry trigger).

| Harness | Path |
|---|---|
| Cursor | `~/.cursor/skills/<name>/` |
| Claude Code | `~/.claude/skills/<name>/` or `.claude/skills/` |
| Claude Desktop / claude.ai | Customize (cloud) **or** `~/.claude/skills/` (local Code) |
| Codex CLI / ChatGPT desktop | `~/.agents/skills/<name>/` or `.agents/skills/` |

Full instructions (Windows/macOS, zip upload, one-shot): **[INSTALL.md](./INSTALL.md)**.

```powershell
# Windows → Cursor + Claude + Codex user dirs
git clone https://github.com/fstubner/agent-skills.git
cd agent-skills
$skills = 'build','product-management','systems-architecture','frontend-engineering','frontend-design','frontend-ux','backend-engineering','product-acceptance'
foreach ($dst in @("$env:USERPROFILE\.cursor\skills","$env:USERPROFILE\.claude\skills","$env:USERPROFILE\.agents\skills")) {
  New-Item -ItemType Directory -Force -Path $dst | Out-Null
  foreach ($s in $skills) { Copy-Item -Recurse -Force ".\$s" "$dst\$s" }
}
```

Reload / restart the harness. For Claude cloud/Cowork, also enable skills in **Customize**.

## How to use

1. Enable or mention **`build`** for app/feature work (or rely on its description triggers).
2. Answer product / design / UX questions; do not skip to chrome.
3. Implement inside locked architecture + stack.
4. **New turn:** **`product-acceptance`** — do not self-SHIP in the build turn.

## Smoke-test scripts (evidence only)

```bash
node frontend-engineering/scripts/check-structure.js --root . --strict
node systems-architecture/scripts/check-architecture.js --root . --strict
node product-acceptance/scripts/accept-check.js --root . --strict
```

Visual gate details: `frontend-design/references/verification.md`.

## Maturity

**Beta.** Usable in production by teams that understand the suite; not yet proven across many unprimed agents/models.

Addressed in 0.2.0: charter promotions, principles-first design skill, versioning/changelog/status, stronger `build` entry.

Still open: field evidence from [unprimed evaluation](./STATUS.md#unprimed-evaluation) — please run it and file issues.

## Related

- Preview runtime (separate product): [frescowork](https://github.com/fstubner/frescowork)
- Archived design-only repo: [frontend-design](https://github.com/fstubner/frontend-design) → use this monorepo
