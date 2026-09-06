// Did the review actually run something, and record what came back?
//
// Eleven graders asked this with eleven copies of one regex, in four drifted
// variants — a 400-character fence window in six, 500 in four, `DELETE` in
// one, and one that alone accepted "npm test … pass" without a fence. Every
// variant credited two things: a fenced block near a command, or `npm test`
// followed by a pass. None credited the thing product-acceptance actually
// tells the reviewer to run, which is the suite's own acceptance gate.
//
// So on antigravity, where the gate ran and the review wrote "Running
// `accept-check.js` returned a **BLOCK** verdict", 21 of 48 runs with a
// genuine acceptance-report.json sitting in their workspace were scored as
// having run nothing. Now that eval-run archives `.agent-evidence`, the
// report on disk is the honest test: only the suite's scripts write one, and
// a review cannot narrate it into existence.
//
// The prose clauses are kept, as the union of every variant, so nothing a
// grader used to credit is lost.
import fs from 'node:fs';
import path from 'node:path';

const FENCED_COMMAND = /```[\s\S]{0,500}(npm|node|curl|GET |POST |DELETE )/i;
const TEST_WITH_RESULT = /(npm test|node --test)[\s\S]{0,200}(pass|✔)/i;

export function suiteReportsIn(root) {
  const evidence = path.join(root, '.agent-evidence');
  if (!fs.existsSync(evidence)) return [];
  return fs.readdirSync(evidence).filter((name) => name.endsWith('-report.json')).sort();
}

export function ranSomething(report, root) {
  return FENCED_COMMAND.test(report) || TEST_WITH_RESULT.test(report) || suiteReportsIn(root).length > 0;
}

export function runtimeEvidence(report, root) {
  const reports = suiteReportsIn(root);
  const fenced = FENCED_COMMAND.test(report);
  const tested = TEST_WITH_RESULT.test(report);
  return {
    pass: fenced || tested || reports.length > 0,
    evidence: `fenced command=${fenced}; test with result=${tested}; suite reports on disk=${reports.join(', ') || 'none'}`,
  };
}
