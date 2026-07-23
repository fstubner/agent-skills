#!/usr/bin/env node
'use strict';
// Architecture gate. Verifies the measurable half of systems-architecture:
// a multi-part project documents its parts, boundaries, and trust model.
// Judgment (whether the architecture is any good) stays in the skill.
//
// Usage: node check-architecture.js --root <dir> [--strict] [--out <file>] [--no-write]

const path = require('path');
const { corePaths } = require('./resolve-core.cjs');
const core = corePaths();
const { parseArgs } = require(path.join(core.lib, 'args.cjs'));
const { classify, ARCH_DOC_CANDIDATES } = require(path.join(core.lib, 'classify.cjs'));
const { readText, hasHeading, check, runCli } = require(path.join(core.lib, 'report.cjs'));
const registry = require(core.registry);

const HEADINGS = ['Parts', 'Boundaries', 'Trust'];

function run(root) {
  const cls = classify(root);
  const checks = [];

  if (!cls.multiPart) {
    checks.push(check('P-scope', 'pass', 'single-part project; architecture doc not required'));
    return checks;
  }

  if (!cls.archDocPath) {
    checks.push(check('P-arch-doc', 'fail',
      `multi-part project has no architecture doc (looked for: ${ARCH_DOC_CANDIDATES.join(', ')})`));
    // Section checks are NOT passes when the doc is missing — missing
    // evidence is not_evaluated, never success.
    for (const h of HEADINGS) {
      checks.push(check(`P-section-${h.toLowerCase()}`, 'not_evaluated', 'no architecture doc to inspect'));
    }
    return checks;
  }

  checks.push(check('P-arch-doc', 'pass', cls.archDocPath));
  const text = readText(path.join(root, cls.archDocPath));
  for (const h of HEADINGS) {
    checks.push(hasHeading(text, h)
      ? check(`P-section-${h.toLowerCase()}`, 'pass')
      : check(`P-section-${h.toLowerCase()}`, 'fail', `${cls.archDocPath} has no "## ${h}" heading`));
  }
  return checks;
}

module.exports = { run };

if (require.main === module) {
  runCli({
    skill: 'systems-architecture',
    reportFile: 'architecture-report.json',
    evidenceDir: registry.evidenceDir,
    runFn: run,
    argv: process.argv.slice(2),
    parseArgs,
  });
}
