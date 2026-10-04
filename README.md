# agent-skills

[Version](./VERSION) · [Changelog](./CHANGELOG.md) · MIT licence

18 Agent Skills for product and software delivery, for Claude Code, Codex,
Cursor and Antigravity. They are built around three ideas.

- **Evidence-gated shipping.** Deterministic checkers write a standard
  report, and the acceptance gate re-runs them itself every time.
- **The builder isn't the acceptor.** The acceptance gate caps its verdict at
  CONDITIONAL unless the run declares it is independent of the build. Nothing
  in the code can verify that, so it depends on whoever runs it being honest.
- **One registry.** [`registry.json`](./registry.json) lists every skill and
  artifact, [`docs/CONTRACT.md`](./docs/CONTRACT.md) is generated from it,
  and CI fails if the two drift apart.

## Evidence

I use these skills every day and find them useful, but that's anecdotal and
they aren't formally validated yet. Turning it into a result needs a
comparison against running without them, and that work is in
[`eval/`](./eval/). It holds 808 recorded runs and 49 write-ups. Each run is
tied to the exact case, fixture, grader and skill text it used, so changing
any of those retires the runs that depended on it. Nothing there clears the
bar I set for this repository yet.

Here is what the evidence supports so far.

- **The checkers work.** Every checker has ship and block fixtures that
  assert the specific blocker, and they run in CI on Ubuntu and Windows.
- **Skills get picked up in interactive sessions.** Over two months of my own
  Claude Code work the model chose a skill itself 97 times out of 127, and 33
  of those came from a prompt that didn't mention the activity. In
  non-interactive `claude -p` runs, a probe found none were picked up
  unprompted. Codex reads them in single-prompt runs, but it lists every
  installed skill in its system prompt, so that isn't comparable. The details
  are in
  [field-outcomes-2026-10-03.md](./eval/results/field-outcomes-2026-10-03.md).
- **Whether the guidance improves the work isn't known yet.** That needs runs
  with and without each skill compared, which is what
  [`eval/`](./eval/README.md) is for. Results in `eval/results/` from before
  the current method aren't evidence either way.

## Skills

The skills are independent. Each one triggers on its own and none calls
another. Eleven of them read or write a few shared files, listed in the next
section, and that's the only link between them.

| Skill | Role |
|---|---|
| [`product-build`](./product-build/) | Works out which of the other skills a new or vague request needs |
| [`product-management`](./product-management/) | Interviews for the `PRODUCT.md` contract |
| [`systems-architecture`](./systems-architecture/) | Parts, boundaries and trust |
| [`frontend`](./frontend/) | Stack, structure, design and UX |
| [`backend-engineering`](./backend-engineering/) | Rules for the trusted side |
| [`product-acceptance`](./product-acceptance/) | Independent acceptance gate |
| [`ai-prose-slop`](./ai-prose-slop/) | Prose editor and detector, usable on any writing |
| [`repo-docs`](./repo-docs/) | Drafts and checks README, release notes, CHANGELOG entries and ADRs, with a checker for voice and structure |
| [`mental-models`](./mental-models/) | Reasoning lenses, a triage guide and four mindsets (Skeptic, Systems Thinker, Pragmatist, Explorer), usable on any hard problem |
| [`code-smells`](./code-smells/) | Fowler's code-smell catalogue and a file-size and nesting checker (size for any language, nesting for JS, TS and C-family) |
| [`code-organization`](./code-organization/) | Module boundaries, dependency direction and naming |
| [`testing-strategy`](./testing-strategy/) | What to test at which level, and testing behaviour over implementation |
| [`data-modeling`](./data-modeling/) | Schema design in any format and a raw-SQL migration-safety checker |
| [`cli-tooling`](./cli-tooling/) | CLI naming, config precedence, exit codes and dry-run |
| [`release-engineering`](./release-engineering/) | CI/CD gating, deployment strategy and rollback |
| [`learn-from-session`](./learn-from-session/) | Turns a correction or confirmation into a lasting rule, fixture or memory |
| [`engineering-assessment`](./engineering-assessment/) | Whole-codebase audit with severity-ranked findings, each citing a file, line or command output, and a list of what wasn't examined |
| [`multi-agent-design`](./multi-agent-design/) | Whether multi-agent is justified at all (the default answer is no), then topology, delegation and failure recovery |

## How they compose

Each skill applies when its signal is present.

| Signal | Skill | Reads / writes |
|---|---|---|
| No or thin `PRODUCT.md` | `product-management` | writes `PRODUCT.md` |
| Multi-part system (client and server, workspaces, trust boundaries) | `systems-architecture` | writes `ARCHITECTURE.md` |
| Stack or structure unknown, or design and UX direction unset | `frontend` | writes `design-direction.md`, `ux-walkthrough.md` and tokens |
| Server or API in scope | `backend-engineering` | reads `ARCHITECTURE.md` |
| A readiness claim ("ship it", "is this done") | `product-acceptance` | reads whatever artifacts exist and re-runs every applicable checker |
| Any prose | `ai-prose-slop` | nothing |

A new build usually touches most rows in about this order, and
`product-build` suggests it, but nothing enforces it. A request that matches
one row, like "make this accessible", uses only that skill. The full artifact
contract, with exact files, required headings and gating rules, is generated
into [`docs/CONTRACT.md`](./docs/CONTRACT.md) from
[`registry.json`](./registry.json).

## Install

```bash
node scripts/install.mjs --harness claude     # or cursor | codex | all
```

The installer never overwrites a directory it didn't create unless you pass
`--force`. It needs an explicit target and makes no network calls.

The repository also has marketplace metadata for Claude Code, Codex and
Cursor, and native packages for the Gemini and Antigravity CLIs. Listing in a
public directory is a separate step. [INSTALL.md](./INSTALL.md) covers every
install path and what each harness can and can't do. It also explains
[why an installed skill doesn't always get invoked](./INSTALL.md#installing-is-not-the-same-as-invoking),
and the `CLAUDE.md` line that reliably fixed that.

## Verify a project

```bash
node systems-architecture/scripts/check-architecture.js --root . --strict
node frontend/scripts/check-frontend.js --root . --strict
node backend-engineering/scripts/check-backend.js --root . --strict
node release-engineering/scripts/check-smoke.js --root . --strict
node product-acceptance/scripts/accept-check.js --root . --strict
```

The acceptance command caps its verdict at CONDITIONAL. Add
`--acceptor-context separate` only when the three conditions in
[`product-acceptance/SKILL.md`](./product-acceptance/SKILL.md) hold, the first
being that this conversation didn't write or edit the code. If you're unsure,
leave the cap on.

In a terminal the checkers print a readable verdict with the failing checks
first. Piped or spawned, they print JSON for the acceptance gate and the
pre-commit hook. `--format text|json` overrides either way.

```
BLOCK  systems-architecture  (/path/to/project)
  FAIL  P-arch-doc: multi-part project has no architecture doc (looked for: ARCHITECTURE.md, ...)
  --    P-section-parts: no architecture doc to inspect

Fix the FAIL line(s) above and re-run. Nothing ships on a BLOCK.
```

Reports are written to `.agent-evidence/`, which you should gitignore. Any
failed check means BLOCK, and any check that couldn't be evaluated caps the
verdict at CONDITIONAL. The full contract is in
[docs/CONTRACT.md](./docs/CONTRACT.md).

## Tests

```bash
node scripts/run-tests.mjs
```

CI runs this on Ubuntu and Windows
([.github/workflows/ci.yml](./.github/workflows/ci.yml)).

## Security

Skills treat project documents like `PRODUCT.md` and `ARCHITECTURE.md` as
data and never run commands found in them. Secret scans report file paths,
never values. See [SECURITY.md](./SECURITY.md).
