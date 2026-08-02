---
name: cli-tooling
description: >-
  Design command-line tools end to end — the user-facing surface (command
  and flag naming, config precedence, discoverable help, a non-interactive
  escape hatch) and the machine-facing contract (exit codes, stdout/stderr
  separation, --dry-run, idempotent re-runs, actionable errors). Triggers
  when building or reviewing a CLI tool or script, when a tool's flags or
  exit codes are ambiguous, or when a script meant to run under CI blocks
  on an interactive prompt. Not for interactive end-user applications
  (that's `frontend`'s territory) — this is for tools run by a human's
  shell or another program.
---

# CLI tooling

A CLI has two audiences at once: a human typing it interactively, and a
shell, script, or CI pipeline invoking it programmatically. Most CLI design
mistakes come from serving only one — a beautifully discoverable tool that
hangs forever waiting for a prompt in CI, or a scriptable tool with flags
no human could guess without reading the source. This suite's own checker
scripts (`check-backend.js`, `check-prose.js`, `accept-check.js`) are used
below as a real, runnable example of the contract half, not a hypothetical.

## Designing the surface (for the human)

1. **Verb-noun consistency across subcommands.** `tool add <x>` / `tool
   remove <x>` / `tool list` reads as one design; `tool add-x` / `tool
   rmX` / `tool showAll` reads as three people who never talked. Pick one
   pattern and hold every subcommand to it.
2. **The common case needs no flags.** The first example in `--help` runs
   with none — that is the test, and it also forces you to decide what the
   common case actually is. A tool whose typical invocation needs five
   flags asks every user to rediscover the same "just do the normal thing"
   incantation, and asks you to guess whether "sensible" was met. Flags are
   for deviating from the default, not for reaching it.
3. **State config precedence explicitly, and keep it consistent.** When a
   value can come from a flag, an environment variable, a config file, and
   a built-in default, document (and keep constant) which wins — typically
   flag > env var > config file > default, most-specific-intent-wins. A
   tool where precedence varies by which flag it is erodes trust fast.
4. **`--help` and `--version` always exist and are always accurate.**
   Running with no args should print usage, not fail silently or do
   something destructive by default (see the contract's "no default
   target" rule below — this is the same principle from the UX side).
5. **Every interactive prompt needs a non-interactive escape hatch.** A
   confirmation prompt is fine for a human at a terminal; the same prompt
   in a CI job blocks forever with no human to answer it. Provide `--yes`
   / `--no-input` (or detect the absence of a TTY / a `CI` env var) so the
   same tool works in both contexts without a special "CI mode" fork.

## The contract (for the caller)

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
6. **Positional args for the one or two things always required; flags for
   everything else.** Positional order becomes part of the contract the
   moment a script depends on it — fine for `tool <file>`, brittle for five
   optional settings that now must appear in a specific sequence.
7. **A target or value starting with `-` must never be misread as a flag.**
   Use a `--` separator before positional arguments (`vale --config x.ini
   -- --strict.md`) so a file literally named `--strict` is treated as a
   path. This suite hit this as a real bug and fixed it, not a
   theoretical edge case.
8. **No default target, no silent success on ambiguous input.** Force the
   caller to be explicit rather than guessing what they meant — the same
   discipline this suite's own installer applies (no args → usage text,
   nothing written).
9. **No network calls unless the tool's whole job is network access, and
   say so up front.** A CLI that silently phones home breaks in sandboxed
   CI, air-gapped environments, and anyone auditing what a script actually
   touches.
