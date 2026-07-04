## Visual / UI engineering (frontend-design skill)

Do not fix UI by stacking broad global overrides. Identify the owning surface/file before editing CSS.

Before claiming a UI fix complete:
- Run `node scripts/ui-check.js --base-url http://localhost:PORT` (add `--strict` in CI).
- Verify desktop, tablet, and mobile for touched surfaces.
- Edit `ui-guardrails/fragile-surfaces.json` when adding fragile routes.

Stop condition: if more than two fixes in the same area need global overrides, refactor layout ownership first.
See skill reference: regression-guardrails.md.
