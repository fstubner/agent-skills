// Extracted from structure.mjs to keep it under this suite's own 400-line
// limit; the nest below also tripped the depth check. Both were pre-existing
// and surfaced when the file was next staged.
import fs from 'fs';
import path from 'path';
import { root, read, expect, pathToFileUrl, tmpBase, runNode, ARCH } from './harness.mjs';

// ---------- Agent-tool directories are excluded by EVERY tree walk ----------
// `.claude/worktrees/<branch>/` holds a full copy of the project. Found on a
// real project: one worktree turned a single-part Express app into
// multiPart, and check-architecture BLOCKed demanding an ARCHITECTURE.md.
// Five checkers keep their own SKIP_DIRS, so the failure recurs the moment
// one of them drifts — this pins all of them to classify's exported list.
{
  const { AGENT_TOOL_DIRS } = await import(pathToFileUrl(path.join(root, 'core', 'lib', 'classify.cjs')));
  expect('classify exports AGENT_TOOL_DIRS', Array.isArray(AGENT_TOOL_DIRS) && AGENT_TOOL_DIRS.includes('.claude'));
  const walkers = [
    'code-smells/scripts/check-smells.js',
    'code-organization/scripts/check-organization.js',
    'data-modeling/scripts/check-migrations.js',
    'release-engineering/scripts/check-smoke.js',
  ];
  for (const rel of walkers) {
    const text = read(path.join(root, ...rel.split('/')));
    const missing = AGENT_TOOL_DIRS.filter((d) => !text.includes(`'${d}'`));
    expect(`${rel} skips every agent-tool directory`, missing.length === 0, `missing: ${missing.join(', ')}`);
  }

  // Behavioural regression, not just a text match: the exact shape that broke.
  const proj = fs.mkdtempSync(path.join(tmpBase, 'worktree-'));
  fs.mkdirSync(path.join(proj, 'src'), { recursive: true });
  fs.writeFileSync(path.join(proj, 'package.json'), '{"name":"solo","dependencies":{"express":"^4.19.0"}}');
  fs.writeFileSync(path.join(proj, 'src', 'server.js'), 'require("express")();\n');
  const { classify } = await import(pathToFileUrl(path.join(root, 'core', 'lib', 'classify.cjs')));
  const before = classify(proj, { evidenceDir: '.agent-evidence' });
  expect('control: a single-part server project is not multi-part', before.multiPart === false);
  const wt = path.join(proj, '.claude', 'worktrees', 'feature-x');
  fs.mkdirSync(wt, { recursive: true });
  fs.writeFileSync(path.join(wt, 'package.json'), '{"name":"solo-ui","dependencies":{"react":"^18.0.0"}}');
  const after = classify(proj, { evidenceDir: '.agent-evidence' });
  expect('a .claude/worktrees copy does NOT make a project multi-part',
    after.multiPart === false && after.frontendPresent === false,
    `multiPart=${after.multiPart} frontendPresent=${after.frontendPresent}`);
  const archRun = runNode(path.join(root, ...ARCH.split('/')), ['--root', proj, '--no-write']);
  expect('check-architecture does not BLOCK on a worktree-only second manifest',
    JSON.parse(archRun.stdout).verdict === 'SHIP', archRun.stdout.slice(0, 200));
}
