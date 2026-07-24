---
name: cli-tooling
description: >-
  Design command-line tools that compose — exit codes as a real contract,
  machine output on stdout and diagnostics on stderr, --dry-run for
  anything that mutates, idempotent re-runs, and error messages that say
  what to do next. Triggers when building or reviewing a CLI script or
  tool, when a script's output is meant to be piped or parsed by something
  else, or when a tool's flags/exit codes are ambiguous. Not for interactive
  end-user applications (that's `frontend`'s territory) — this is for tools
  meant to be run by a human's shell or another program.
---

# CLI tooling

A CLI is an API whose callers are shells, scripts, and CI — the same
discipline that applies to a function signature applies here: the contract
is the exit code and the output shape, not what the tool happened to print
this run. This suite's own checker scripts (`check-backend.js`,
`check-prose.js`, `accept-check.js`) are used below as a real, runnable
example of these rules, not a hypothetical.

## Rules

1. **Exit codes are a contract, not an afterthought.** `0` means success;
   non-zero means failure. When a caller needs to distinguish failure
   kinds, use distinct codes and document them — this suite's shared
   `runCli` wrapper uses `0` for SHIP/CONDITIONAL, `1` for BLOCK (or
   CONDITIONAL under `--strict`), and `3` for an internal crash, the same
   three codes for every registry-driven checker; `check-prose.js` adds its
   own `2` for "vale isn't installed," a prerequisite-missing case the
   shared wrapper doesn't have. The point isn't the exact numbers — it's
   that a calling script can react differently to "you're missing a
   dependency" than to "the check genuinely failed," which only works if
   the codes are assigned deliberately and documented, not incidental.
2. **Machine-readable output on stdout, everything else on stderr.**
   Progress messages, warnings, and human commentary printed to stdout
   corrupt a caller doing `tool | jq` or capturing stdout as data. If a
   script emits JSON as its result, stdout is that JSON and nothing else.
3. **Anything that mutates needs a preview mode.** `--dry-run` or
   `--no-write` lets a caller (human or another script) see what would
   happen before it's real. `accept-check.js` always passes `--no-write` to
   every producer it spawns, specifically so an acceptance check can never
   itself cause a side effect — a check that mutates state while verifying
   it is a check that can't be trusted to re-run safely.
4. **Re-running with the same input should be safe.** A tool that behaves
   differently or errors on a second identical run has hidden state
   somewhere. This matters most for anything spawned by CI or another
   automated caller, which will re-run it far more than a human would.
5. **Errors should say what's wrong and what to do about it.** "vale is not
   on PATH" is a fact; "vale is not on PATH — install with `winget install
   errata-ai.Vale`, or `brew install vale`, then re-run" is an error a
   caller can act on without leaving the terminal. Prefer the second form
   whenever the fix is knowable.
6. **Take positional args for the one or two things always required; flags
   for everything else.** Positional order becomes part of the contract the
   moment a script depends on it — fine for `tool <file>`, brittle for five
   optional settings that now must appear in a specific sequence.
7. **A target or value starting with `-` must never be misread as a flag.**
   Use a `--` separator before positional arguments (`vale --config x.ini
   -- --strict.md`) so a file literally named `--strict` is treated as a
   path. This suite hit this as a real bug and fixed it, not a
   theoretical edge case.
8. **`--help` (or running with no args) should print real usage, not just
   fail.** No default target, no silent success on ambiguous input — force
   the caller to be explicit rather than guessing what they meant.
9. **No network calls unless the tool's whole job is network access, and
   say so up front.** A CLI that silently phones home breaks in sandboxed
   CI, air-gapped environments, and anyone auditing what a script actually
   touches.
