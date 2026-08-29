#!/usr/bin/env node
// Suite test runner — an orchestrator only. Every assertion lives in a module
// under scripts/tests/, and the shared harness (expect, fixture helpers, temp
// dir) lives in scripts/tests/harness.mjs.
//
// Modules are imported SEQUENTIALLY with await, not with static imports:
// static imports are hoisted and evaluated in specification order regardless
// of where they appear, which is fine today but silently couples output order
// to declaration order. An explicit awaited loop keeps the run order visible
// and editable in one list.
//
// Each module asserts at import time rather than exporting a run() function.
// That keeps the modules byte-identical to the blocks they were extracted
// from, so the split could be verified as behaviour-preserving by diffing the
// test output rather than by re-reading 1300 lines.

import { failureCount, cleanup } from './tests/harness.mjs';

const MODULES = [
  'structure.mjs',        // syntax, registry <-> filesystem, contract drift, CI location
  'readme-coverage.mjs',  // the README lists the skills that actually ship
  'agent-tool-dirs.mjs',  // every checker's tree walk skips .claude/.cursor/... worktrees
  'doc-links.mjs',        // markdown links and `node <script>` references resolve
  'plugin-bundles.mjs',   // generated Claude/Codex/Cursor/Antigravity packages do not drift
  'marketplace-standards.mjs', // cross-marketplace names, roots, and release versions agree
  'schema.mjs',           // schema validator units, empty-checks fail-closed
  'fixtures-core.mjs',    // architecture / backend / frontend / acceptance fixtures
  'fixtures-quality.mjs', // code-organization, code-smells, data-modeling fixtures
  'prose.mjs',            // ai-prose-slop (skips only when vale is absent)
  'eval-assets.mjs',      // eval case + result shape validation
  'eval-v2.mjs',          // reproducible cases, graders, evidence bundles, claim quarantine
  'eval-fixture-binding.mjs', // a run is bound to the fixture it ran against
  'eval-skill-currency.mjs',  // evidence must describe the skill text as it stands
  'eval-harness-failure.mjs', // a run that never reached a model is not a failing run
  'hooks.mjs',            // pre-commit secret scanning (skips only when gitleaks is absent)
  'hooks-scan-set.mjs',   // the pre-commit scan set travels in a file, not argv
  'installer.mjs',        // harnessPaths, installed-skill smoke test, clobber refusal
  'fail-closed.mjs',      // unreadable root, gitleaks precision, self-declared verdicts
  'classify.mjs',         // manifest parsers against real-world manifest shapes
  'mutation.mjs',         // threshold/branch mutants that fixtures alone don't kill
  'imports.mjs',          // import-edge extraction, --files scoping
];

for (const m of MODULES) {
  await import(`./tests/${m}`);
}

cleanup();
const failures = failureCount();
console.log(failures === 0 ? '\nAll tests passed.' : `\n${failures} failure(s)`);
process.exit(failures === 0 ? 0 : 1);
