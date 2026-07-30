import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  root, registry, read, expect, runNode, walk, pathToFileUrl,
  tmpBase, runFixture, assertFixture, ARCH, BACKEND, FRONTEND, ACCEPT,
} from './harness.mjs';

// ---------- 14. Import-edge extraction must cover real-world import shapes ----------
// Every cycle fixture used CommonJS `require()` on a single line, so the ESM
// path — the majority case in any modern codebase — contributed zero coverage
// and could be deleted entirely with the suite still green. Worse, the clause
// matcher was `[^\n]*?`, which cannot cross a newline: Prettier splits any
// import list past ~80 chars, so in a normally-formatted TS project MOST import
// edges were invisible and cycles through them reported "no circular imports".
{
  const { localImportsOf } = await import(pathToFileUrl(path.join(root, 'code-organization', 'scripts', 'check-organization.js')));
  const CASES = [
    ['single-line ESM', "import a from './a';", ['./a']],
    ['multi-line ESM (Prettier default output)', "import {\n  alpha,\n  beta,\n} from './a';", ['./a']],
    ['side-effect import', "import './a';", ['./a']],
    ['named re-export (barrel file)', "export { x } from './a';", ['./a']],
    ['star re-export (barrel file)', "export * from './a';", ['./a']],
    ['two imports on one line', "import a from './a'; import b from './b';", ['./a', './b']],
    ['dynamic import', "const m = await import('./a');", ['./a']],
    ['commonjs require', "const a = require('./a');", ['./a']],
    ['package imports are ignored', "import React from 'react';", []],
    ['type-only import creates no runtime edge', "import type { X } from './a';", []],
    ['type-only re-export creates no runtime edge', "export type { X } from './a';", []],
  ];
  for (const [label, src, want] of CASES) {
    const got = localImportsOf(src);
    expect(`imports — ${label}`, JSON.stringify(got) === JSON.stringify(want), `got ${JSON.stringify(got)}`);
  }

  // End-to-end: a genuine cycle expressed in ESM across multi-line imports and
  // a barrel re-export must BLOCK, not report "no circular imports".
  const ORG = path.join(root, 'code-organization', 'scripts', 'check-organization.js');
  const esmCycle = fs.mkdtempSync(path.join(tmpBase, 'esm-cycle-'));
  fs.mkdirSync(path.join(esmCycle, 'src'), { recursive: true });
  fs.writeFileSync(path.join(esmCycle, 'src', 'a.ts'),
    "import {\n  bThing,\n  bOther,\n} from './b';\n\nexport const aThing = () => bThing() + bOther();\n");
  fs.writeFileSync(path.join(esmCycle, 'src', 'b.ts'),
    "export { aThing } from './a';\n\nexport const bThing = () => 1;\nexport const bOther = () => 2;\n");
  const r = runNode(ORG, ['--root', esmCycle]);
  let rep = null;
  try { rep = JSON.parse(r.stdout); } catch { /* asserted below */ }
  expect('imports — a multi-line ESM + barrel-re-export cycle is detected',
    rep && rep.verdict === 'BLOCK', JSON.stringify(rep && rep.checks));
}

// ---------- 15. --files scoping (pre-commit hook viability) ----------
// A whole-repository checker cannot be a pre-commit hook on any codebase that
// isn't already green: the first commit after install is blocked by unrelated
// pre-existing violations, so the hook gets bypassed or uninstalled. gitleaks
// solves this with `protect --staged`; these two checkers had no equivalent,
// which is what made them unusable in scripts/git-hooks/pre-commit.
//
// --files restricts what may FAIL to the named files. For code-smells both
// checks are per-file, so this is a straight scan-set restriction. For
// code-organization a cycle is inherently graph-wide (a -> b -> c -> a needs
// all three files), so the whole graph is still built and only the REPORTING
// is scoped: a cycle blocks when a named file participates in it, and a
// pre-existing cycle your commit doesn't touch is grandfathered.
{
  const SMELLS = path.join(root, 'code-smells', 'scripts', 'check-smells.js');
  const ORG2 = path.join(root, 'code-organization', 'scripts', 'check-organization.js');

  const scoped = fs.mkdtempSync(path.join(tmpBase, 'scoped-'));
  fs.mkdirSync(path.join(scoped, 'src'), { recursive: true });
  // One oversized file (450 lines, over the 400 limit) and one clean one.
  fs.writeFileSync(path.join(scoped, 'src', 'big.js'), 'const x = 1;\n'.repeat(450));
  fs.writeFileSync(path.join(scoped, 'src', 'small.js'), 'export const ok = 1;\n');

  const smellsAll = JSON.parse(runNode(SMELLS, ['--root', scoped]).stdout);
  expect('--files: unscoped run still BLOCKs on the oversized file (baseline)',
    smellsAll.verdict === 'BLOCK', JSON.stringify(smellsAll.checks));

  const smellsClean = JSON.parse(runNode(SMELLS, ['--root', scoped, '--files', 'src/small.js']).stdout);
  expect('--files: scoping to a clean file does NOT report the unrelated big file',
    smellsClean.verdict === 'SHIP', JSON.stringify(smellsClean.checks));

  const smellsDirty = JSON.parse(runNode(SMELLS, ['--root', scoped, '--files', 'src/big.js']).stdout);
  expect('--files: scoping to the oversized file still fails it',
    smellsDirty.verdict === 'BLOCK', JSON.stringify(smellsDirty.checks));

  // A pre-existing cycle (a <-> b) plus an unrelated clean file.
  const scopedOrg = fs.mkdtempSync(path.join(tmpBase, 'scoped-org-'));
  fs.mkdirSync(path.join(scopedOrg, 'src'), { recursive: true });
  fs.writeFileSync(path.join(scopedOrg, 'src', 'a.js'), "import './b.js';\nexport const a = 1;\n");
  fs.writeFileSync(path.join(scopedOrg, 'src', 'b.js'), "import './a.js';\nexport const b = 1;\n");
  fs.writeFileSync(path.join(scopedOrg, 'src', 'clean.js'), 'export const c = 1;\n');

  const orgAll = JSON.parse(runNode(ORG2, ['--root', scopedOrg]).stdout);
  expect('--files: unscoped run still BLOCKs on the pre-existing cycle (baseline)',
    orgAll.verdict === 'BLOCK', JSON.stringify(orgAll.checks));

  const orgClean = JSON.parse(runNode(ORG2, ['--root', scopedOrg, '--files', 'src/clean.js']).stdout);
  expect('--files: a pre-existing cycle the commit does not touch is grandfathered',
    orgClean.verdict === 'SHIP', JSON.stringify(orgClean.checks));

  const orgDirty = JSON.parse(runNode(ORG2, ['--root', scopedOrg, '--files', 'src/a.js']).stdout);
  expect('--files: a cycle the named file participates in still blocks',
    orgDirty.verdict === 'BLOCK', JSON.stringify(orgDirty.checks));

  // A named file that does not exist (e.g. a staged deletion that slipped
  // through the hook's diff-filter) must not crash or vacuously pass.
  const orgGone = JSON.parse(runNode(ORG2, ['--root', scopedOrg, '--files', 'src/deleted.js']).stdout);
  expect('--files: a nonexistent named file yields no false failure',
    orgGone.verdict !== 'BLOCK', JSON.stringify(orgGone.checks));
}
