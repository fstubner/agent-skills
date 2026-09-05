// How a run is allowed to execute, and what its bundle keeps a copy of.
//
// ============================================================================
// EXECUTION
// ============================================================================
//
// Until 2026-09-05 the claude-code arm ran under `--permission-mode acceptEdits`
// and nothing else, which permits file edits and no command execution at all.
// Five assertions across the programme ask a run to execute something, and all
// five were unsatisfiable for the arm that holds every current number:
//
//   declared-commands-run      six engineering-assessment cases
//   checker-crash-observed     checker-crash-read-as-pass
//   bypass-demonstrated        narrowed-audit-across-a-trust-boundary
//   fresh-gate-evidence        stale-pass-review
//   gate-reconciled            zero-count-export-acceptance
//
// The reports were explicit about it — "npm test | Approval required — not
// executed" — so a model behaving correctly under a constraint was scored as
// having failed. That is the error the project already has a rule against, one
// level down: a run that never reached a model is not a failing run, and an
// assertion the harness forbids is not a failed assertion.
//
// An ALLOWLIST rather than --dangerously-skip-permissions, which is what the
// codex arm uses. Two reasons, and the first is not caution for its own sake:
//
//   - `npm install` is deliberately absent. dependency-and-licence-risk ships
//     a postinstall that pipes a remote script into sh, and that case exists to
//     measure whether an assessor chooses to fetch it. Making it impossible to
//     reach by accident keeps the choice the thing being measured. (The URL is
//     under example.com, IANA-reserved, so it resolves to nothing either way —
//     the point is that the run's intent stays legible.)
//   - Every fixture declares its test command as `node --test <file>`, so
//     `node` and `npm test`/`npm run` is the whole surface these assertions
//     need. A wider grant would buy nothing and blur what a run did.
//
// This applies identically to control, policy and skill arms, so it cannot
// bias a comparison between them. It does make runs recorded before this date
// incomparable with runs after it, which is why it lands while the programme
// is already suspended for re-measurement rather than partway through one.
export const CLAUDE_ALLOWED_TOOLS = ['Bash(node:*)', 'Bash(npm test:*)', 'Bash(npm run:*)'];

// ============================================================================
// ARCHIVING
// ============================================================================
//
// What a run bundle keeps a copy of, and why it matters that it is faithful.
//
// eval-run.mjs copies the finished workspace into the bundle's `outputs/`.
// That copy is not a convenience: eval-regrade.mjs scores archived bundles
// with current graders, and every instrument repair since 2026-09-03 has been
// verified against it rather than by spending runs. A grader that reads a file
// the copy does not carry will score the archive differently from the live
// workspace, silently.
//
// `.agent-evidence` was on this list until 2026-09-05 and should never have
// been. It holds the reports a run's own checkers write, and four graders read
// it — stale-pass-review and zero-count-export-acceptance each decide an
// assertion entirely on whether an acceptance report exists and what verdict
// it carries. Excluding it meant those bundles could not be re-scored: the
// grader read an absent file and recorded a failure the live run never saw.
//
// It cost nothing only by accident. Producing that file means running the
// acceptance gate, and the claude-code arm runs under `--permission-mode
// acceptEdits` and cannot execute anything, so live and archive agreed on
// zero. The moment that permission changes, the archive would start lying.
//
// What stays excluded, and why each is safe to drop:
//   .git          history, not workspace state; enormous
//   node_modules  installed dependencies; enormous, and reproducible
//   .agent-input  the staged skill, already bound by stagedInputSha256
//   .codex        harness scratch, not the model's work product
//   .claude       harness scratch, and it holds a full worktree copy that
//                 once turned a single-part app into a false multi-part BLOCK
export const EXCLUDED_OUTPUTS = new Set(['.git', 'node_modules', '.agent-input', '.codex', '.claude']);
