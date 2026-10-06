// Project documents kept under docs/ or docs/design/ instead of the root.
// Split out of fixtures-core.mjs, which the 400-line pre-commit rule leaves no
// room in.
import fs from 'fs';
import path from 'path';
import { root, expect, runNode, tmpBase, ACCEPT, FRONTEND } from './harness.mjs';

// A project may keep its documents under docs/ or docs/design/ instead of the
// root. accept-ship with its documents moved must still SHIP, and the pass
// messages must name where each was found. Before the shared lookup the gate
// reported all of them missing.
const DOC_CHECK_IDS = {
  'PRODUCT.md': 'A-product-contract', 'ARCHITECTURE.md': 'A-architecture-doc',
  'design-direction.md': 'A-design-direction', 'ux-walkthrough.md': 'A-ux-walkthrough',
};
for (const [label, moves] of [
  ['docs/', { 'PRODUCT.md': 'docs', 'ARCHITECTURE.md': 'docs' }],
  ['docs/design/', {
    'PRODUCT.md': 'docs/design', 'ARCHITECTURE.md': 'docs/design', 'design-direction.md': 'docs/design',
    'ux-walkthrough.md': 'docs/design', 'design-tokens.json': 'docs/design',
  }],
]) {
  const dest = path.join(tmpBase, 'accept-docs-' + Math.random().toString(36).slice(2, 8));
  fs.cpSync(path.join(root, 'fixtures', 'accept-ship'), dest, { recursive: true });
  for (const [file, dir] of Object.entries(moves)) {
    fs.mkdirSync(path.join(dest, dir), { recursive: true });
    fs.renameSync(path.join(dest, file), path.join(dest, dir, file));
  }
  const r = runNode(path.join(root, ...ACCEPT.split('/')),
    ['--root', dest, '--no-write', '--acceptor-context', 'separate', '--runtime-verified']);
  let report = null;
  try { report = JSON.parse(r.stdout); } catch { /* asserted below */ }
  expect(`documents under ${label}: emits parseable report`, report !== null, (r.stderr || '').slice(0, 200));
  if (report) {
    expect(`documents under ${label}: verdict SHIP`, report.verdict === 'SHIP', JSON.stringify(report.checks));
    for (const [file, dir] of Object.entries(moves)) {
      const id = DOC_CHECK_IDS[file];
      if (!id) continue;
      const c = report.checks.find((x) => x.id === id);
      expect(`documents under ${label}: ${id} passes and names ${dir}/${file}`,
        Boolean(c) && c.status === 'pass' && c.detail.startsWith(`${dir}/${file}`), c ? `${c.status} (${c.detail})` : 'check missing');
    }
    const intent = report.checks.find((x) => x.id === 'A-intent-anchored');
    expect(`documents under ${label}: A-intent-anchored reads the moved PRODUCT.md`,
      Boolean(intent) && intent.status === 'pass', intent ? `${intent.status} (${intent.detail})` : 'check missing');
  }
  if (moves['ux-walkthrough.md']) {
    // Exit 2 means "no ux-walkthrough.md"; 0 or 3 (no replay block) both mean it was found.
    const gen = runNode(path.join(root, 'product-acceptance', 'scripts', 'gen-walkthrough-spec.mjs'), ['--root', dest, '--print-hash']);
    expect(`documents under ${label}: gen-walkthrough-spec finds ux-walkthrough.md`, gen.status !== 2, (gen.stderr || '').slice(0, 200));
  }
}
// The frontend checker reads design-tokens.json and ux-walkthrough.md itself.
{
  const dest = path.join(tmpBase, 'frontend-docs-' + Math.random().toString(36).slice(2, 8));
  fs.cpSync(path.join(root, 'fixtures', 'accept-ship'), dest, { recursive: true });
  fs.mkdirSync(path.join(dest, 'docs', 'design'), { recursive: true });
  for (const f of ['design-tokens.json', 'ux-walkthrough.md']) {
    fs.renameSync(path.join(dest, f), path.join(dest, 'docs', 'design', f));
  }
  const r = runNode(path.join(root, ...FRONTEND.split('/')), ['--root', dest, '--no-write']);
  let report = null;
  try { report = JSON.parse(r.stdout); } catch { /* asserted below */ }
  expect('frontend docs under docs/design/: emits parseable report', report !== null, (r.stderr || '').slice(0, 200));
  if (report) {
    for (const id of ['F-tokens-contrast', 'F-walkthrough-observable']) {
      const c = report.checks.find((x) => x.id === id);
      expect(`frontend docs under docs/design/: ${id} is pass`, Boolean(c) && c.status === 'pass', c ? `${c.status} (${c.detail})` : 'check missing');
    }
    const tokens = report.checks.find((x) => x.id === 'F-tokens-contrast');
    expect('frontend docs under docs/design/: tokens contrast was evaluated, not skipped',
      Boolean(tokens) && !/no design-tokens/.test(tokens.detail || ''), tokens && tokens.detail);
  }
}
