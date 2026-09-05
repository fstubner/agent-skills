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
