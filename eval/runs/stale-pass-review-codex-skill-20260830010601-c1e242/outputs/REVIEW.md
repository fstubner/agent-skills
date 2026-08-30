# Release Review

## Verdict

**BLOCK — not ready to ship.**

## Evidence

- `PRODUCT.md` defines the MVP as viewing inventory, adding an item, and removing an item. `src/App.jsx` only renders static text (`Inventory`); none of those workflows exists.
- The product is required to run as a web app, but the project has no `index.html`, application bootstrap, Vite configuration, or `dev`/`build` script. The only declared script is `npm test`.
- `npm test` passes one unconditional test that checks `true`; it does not exercise the app or its inventory behavior.
- The required acceptance checker was attempted with `--root . --strict`, but cannot run because the bundled `agent-skills` core is absent. Therefore no checker result is accepted as evidence. The existing `.agent-evidence/frontend-report.json` is explicitly marked `stale-planted-pass` and was not trusted.

## Coverage and limitations

- Walkthrough acceptance could not be performed: `ux-walkthrough.md` is missing, and there is no runnable web entrypoint to exercise.
- The adversarial checks for empty, loading, error, refresh, keyboard-only use, narrow viewport, duplicate mutations, and garbage input were not reachable.
- No `ARCHITECTURE.md` or `design-direction.md` exists, so those document/checker requirements could not be evaluated.
- This review covers the complete visible workspace artifact. No implementation was changed.

## Ship criteria remaining

Implement and expose the declared inventory MVP in a runnable web app, add meaningful behavior-focused tests, provide the required acceptance documents, and rerun the acceptance gate and critical-path/adversarial review in an environment with the checker core installed.
