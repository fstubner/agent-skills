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

## Install (Cursor)

Copy or symlink each skill folder into your Cursor skills directory:

```text
~/.cursor/skills/build/
~/.cursor/skills/systems-architecture/
~/.cursor/skills/frontend-engineering/
~/.cursor/skills/frontend-design/
~/.cursor/skills/product-acceptance/
```

Optional: also copy `_suite-charters/` next to them for human/agent reference.

On Windows (PowerShell), from this repo:

```powershell
$dst = "$env:USERPROFILE\.cursor\skills"
foreach ($s in 'build','systems-architecture','frontend-engineering','frontend-design','product-acceptance','_suite-charters') {
  Copy-Item -Recurse -Force ".\$s" "$dst\$s"
}
```

Reload Cursor after install.

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
