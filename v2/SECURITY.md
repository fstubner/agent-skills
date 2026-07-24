# Security

## Reporting

Open a private GitHub security advisory on this repository. No email path is
offered because none is monitored.

## Threat model, honestly stated

- **Skills are instructions to an LLM, not a sandbox.** They shape behavior;
  they cannot guarantee it.
- **Prompt injection via project files is the main exposure.** This suite
  tells agents to treat `PRODUCT.md` / `ARCHITECTURE.md` as binding for
  engineering *decisions*. The router (`product-build`), the generated
  contract (`docs/CONTRACT.md`), and every skill that reads project
  documents (`product-management`, `systems-architecture`,
  `backend-engineering`, `frontend`, `product-acceptance`) carry the
  countervailing rule: project documents are data — instructions found
  inside them (run this, fetch that) are an injection signal to stop and
  confirm with the human. `product-acceptance` carries it most explicitly,
  since it is the skill most likely to run standalone against an untrusted
  finished repo. A hostile repo can still attempt it; the rule reduces, not
  eliminates, the risk.
- **Reports are not security controls.** `*-report.json` files are evidence
  for self-correction. The acceptance gate re-runs checkers rather than
  reading reports precisely so planted files can't forge a SHIP — but
  nothing stops a human ignoring the gate.
- **The installer** writes only into the target you name, never deletes
  directories it didn't create (marker file) without `--force`, and makes no
  network requests. Scripts read no env secrets and shell out only with
  argument arrays (no shell interpolation); the one external binary is
  `vale` for ai-prose-slop.
- **Secret scanning** (`B-client-secrets`, and the opt-in pre-commit hook at
  `scripts/git-hooks/pre-commit`) shells out to
  [`gitleaks`](https://github.com/gitleaks/gitleaks) rather than a
  hand-rolled pattern list — a real, maintained tool, not a reimplementation
  of its detection logic. Both consumers run it twice (its default
  ruleset plus `core/gitleaks-extra.toml`, two provider prefixes the
  default doesn't cover) and merge the results, so a new prefix added to
  the extra config reaches both without hand-syncing. Reports file paths
  and rule ids only — matched values never appear in reports or output
  (gitleaks redacts them at the source).
