// Did the report record having run the project's declared test command?
//
// Shared rather than copied, for the reason runs-superseded/README.md gives
// about the citation matcher: eight graders carried eight near-identical
// copies of this pattern, three of them differing only in whether they looked
// for "pass 1" or "pass 2", and a fix to one is invisible to the others.
//
// The pattern was unsatisfiable until 2026-09-05 for a reason that had nothing
// to do with phrasing: the claude-code arm ran without permission to execute
// anything, so no run could have output to record. With execution allowed, the
// first run to actually run `npm test` still failed, because it wrote
//
//     | Command  | Result                                             |
//     | `npm test` | ✓ Passed — 1 test passed (rate limit middleware) |
//
// and the pattern wanted a ``` fence, or the character ✔ (U+2714). The report
// used ✓ (U+2713). One codepoint apart, and the two are visually identical at
// normal size.
//
// So: the command, and an outcome beside it, in any of the layouts reports
// actually use — a fenced block, a table row, a bullet. A bare mention of the
// command with no outcome is not evidence it ran, and still fails.
const OUTCOME = String.raw`(?:pass(?:e[sd])?|fail(?:e[sd]|ing|ure)?|✓|✔|✗|✖|❌|ok\b|\d+\s*(?:test|assertion)s?\s*(?:pass|fail)|(?:pass|fail)\w*\s*\d+|exit code|error)`;
const COMMAND = String.raw`(?:npm (?:test|run test)|node --test|yarn test|pnpm test)`;

// Within 400 characters, in either order: reports write "npm test → passed"
// and "1 test passed, from npm test" about equally often.
const FORWARD = new RegExp(`${COMMAND}[\\s\\S]{0,400}?${OUTCOME}`, 'i');
const BACKWARD = new RegExp(`${OUTCOME}[\\s\\S]{0,200}?${COMMAND}`, 'i');

export function ranDeclaredCommand(report) {
  return FORWARD.test(report) || BACKWARD.test(report);
}
