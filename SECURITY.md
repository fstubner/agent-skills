# Security

## Reporting

Open a private GitHub security advisory on this repository. There's no email
address for reports because none is monitored.

## Threat model

- **Skills are instructions to a model, not a sandbox.** They shape what an
  agent does but can't guarantee it.
- **Prompt injection through project files is the main exposure.** The skills
  treat `PRODUCT.md` and `ARCHITECTURE.md` as binding for engineering
  decisions. `product-build`, the generated `docs/CONTRACT.md` and every skill
  that reads project documents (`product-management`, `systems-architecture`,
  `backend-engineering`, `frontend`, `product-acceptance`) also say those
  documents are data. An instruction inside one, like "run this" or "fetch
  that", is a sign of injection and a reason to stop and ask.
  `engineering-assessment` runs the build, test and lint commands a project
  declares, but not instructions written in its documents or install-time
  hooks. `product-acceptance` states the rule most explicitly, since it's the
  skill most likely to run alone against an unfamiliar repository. A hostile
  repository can still try, and the rule lowers the risk without removing it.
- **Reports are not security controls.** `*-report.json` files help an agent
  correct itself. The acceptance gate re-runs the checkers itself so a
  planted report can't fake a SHIP, and it works out each checker's verdict
  from that checker's individual checks. Nothing stops a person ignoring the
  gate.
- **The repository being audited gets no say in how it's audited.**
  `product-acceptance` supplies the secret scan's configuration itself
  (`core/gitleaks-defaults.toml`) and passes `--ignore-gitleaks-allow` and a
  neutral `--gitleaks-ignore-path`. A repository can't turn the scan off with
  its own `.gitleaks.toml`, a `gitleaks:allow` comment or a
  `.gitleaksignore`. The pre-commit hook works the same way, so staged
  content can't disable its own scan.
- **The installer** writes only to the target you name, doesn't delete
  directories it didn't create unless you pass `--force`, and makes no
  network requests. Scripts read no secrets from the environment and run
  external commands with argument arrays, never through a shell. Two external
  tools are used and never bundled, `vale` for `ai-prose-slop` and `gitleaks`
  for secret scanning.

## Secret scanning

There are two checks with different scopes, and neither means "no secrets in
the repository".

- **`B-client-secrets`** affects the acceptance verdict and only looks at
  paths a browser can reach. A hit in a server-only path (`server.js`,
  `server/`, `pages/api/`, `*.server.ts`) is listed in the check's detail
  without failing it. The acceptance gate never blocks on a secret in server
  code.
- **The pre-commit hook** catches a committed credential anywhere, in
  repositories that have turned it on.

Both use [gitleaks](https://github.com/gitleaks/gitleaks) instead of a
hand-written pattern list. Both run it twice, with its default rules and with
`core/gitleaks-extra.toml`, which adds two provider key prefixes the defaults
miss, and merge the results. The extra rules have a minimum length, a minimum
entropy and a placeholder allowlist, so documentation showing a key format
isn't reported as a leak. Reports contain file paths and rule ids only.
gitleaks redacts matched values before they reach any output.

## Session cookies

`B-session-cookie` blocks a session-like cookie set without `HttpOnly`,
`Secure` and `SameSite`, including one that sets a flag to `false` or uses
`SameSite=None`. It only looks at session-like names, because preference
cookies and the double-submit CSRF cookie are meant to be readable by
scripts.

Authorization depth and rate limiting need a human review, described in
`backend-engineering/references/server-laws.md`. The checkers don't verify
them.
