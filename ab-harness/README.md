# A/B Harness

Multi-page **Acme Console** spec for comparing skill vs no-skill builds with automated
self-reflection tools.

## Setup (once)

```bash
cd ab-harness
npm install
node node_modules/playwright/cli.js install chromium
```

## Reference app (skill-built golden master)

```
reference-with-skill/   # 6 routes, toast, modal, search, dark mode
```

Serve: `python -m http.server 8775` from that folder.

## Run smoke on any build

```bash
python -m http.server 8775   # in app dir
node scripts/smoke.mjs --base-url http://localhost:8775
```

## Capture screenshots

```bash
node scripts/capture.mjs --app ../reference-with-skill --base-url http://localhost:8775 --out artifacts/my-run
```

## Full A/B

```bash
node scripts/run-ab.mjs \
  --with-skill reference-with-skill \
  --without-skill /path/to/without-skill-build
```

## Compare pixels

```bash
node scripts/compare.mjs --baseline artifacts/with --candidate artifacts/without --threshold 0.05
```

Writes diff images to `artifacts/diff/`.

## Viewer

After `run-ab.mjs`, open `viewer/index.html` via a local server (paths are relative to artifacts).

## Agent self-check (from any project)

```bash
node ../scripts/self-check.js --root /path/to/project --skill-root ..
```

See `references/verification.md` in the skill root.
