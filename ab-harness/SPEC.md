# A/B Harness — Small Functioning App Spec

Use this spec for **fair skill vs no-skill comparisons**. Both builds must implement the same
behavior; only the design workflow differs.

**For skill-guided builds:** this spec is the **minimum** route/behavior contract. Apply
`sane-defaults.md` for UX the spec does not spell out (page CTAs, dual theme, empty-state actions).

## Product

**Acme Console** — B2B admin for managing API projects and team access.

## Required routes (client-side router OK)

| Route | Purpose |
|-------|---------|
| `#/dashboard` | Overview: 3 stat cards, recent activity feed, quick-action button |
| `#/projects` | Searchable project list; **primary CTA** to create a project; **empty state** when filter matches nothing |
| `#/projects/:slug` | Project detail with tabs: Overview, Members, Settings |
| `#/settings/profile` | Profile form with save → success feedback |
| `#/settings/sessions` | Scrollable sessions list (≥8 rows), revoke + confirm modal |
| `#/settings/connections` | Connected accounts empty state + CTA |

## Required interactions (must work, not static)

1. **Router** — nav highlights active route; back/forward works with hash history
2. **Dark mode** — toggle persists to `localStorage`
3. **Project search** — filters list client-side; empty state when no matches
4. **Profile save** — loading state → success banner (not alert)
5. **Session revoke** — opens confirm modal → removes row on confirm
6. **Toast** — show toast on at least one action (e.g. project created from dashboard)
7. **Scroll overflow** — sessions use `scroll-region-host` + dynamic `data-overflow`

## Skill build requirements (with skill only)

- Phase 2.5 `design-direction.md` before CSS
- `init-design-tokens.js` enterprise archetype
- `meta.fontsUrl` loaded in HTML
- `chrome-bg` / `content-well` split
- `self-check.js` PASS or PASS_WITH_WARNINGS
- `ci-check.js --strict` PASS (with `ui-guardrails/` from `init-ui-guardrails.js`)
- `design-critique.js` not BLOCK
- `axe-check.mjs` PASS on fragile routes
- `ab-harness/scripts/smoke.mjs` PASS
- `audit-generic.js` score ≤2

## No-skill build

Same routes and interactions. No token pipeline required. Typical agent CSS is fine.

## Verification

```bash
cd <SKILL_ROOT>/ab-harness
npm install
node scripts/run-ab.mjs \
  --with-skill /path/to/with-skill-build \
  --without-skill /path/to/without-skill-build
```

Outputs `artifacts/ab-report.json` and screenshot diffs per scenario.
