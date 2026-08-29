// Extracted from structure.mjs, which had grown past this suite's own
// 400-line limit and carried a depth-8 nest here. Both were pre-existing and
// only surfaced when the file was next staged.
import fs from 'fs';
import path from 'path';
import { root, read, expect, walk } from './harness.mjs';

// ---------- Documentation points at files that exist ----------
// A generated file carried `](../registry.json)` into a directory one level
// deeper than the one it was written for. Nobody edits generated files, so
// nobody sees the dead link in them.
{
  const mdFiles = walk(root)
    .filter((f) => f.endsWith('.md'))
    // Generated bundles are excluded: they are copies placed at a different
    // depth, so a link correct at the source is expected to break there. The
    // source tree is what a reader browses.
    .filter((f) => !/(^|[\\/])(node_modules|eval|fixtures|plugins|skills)[\\/]/.test(path.relative(root, f)));
  const dead = [];
  for (const abs of mdFiles) {
    const text = read(abs);
    for (const m of text.matchAll(/\]\((\.[^)#\s]+)/g)) {
      if (!fs.existsSync(path.resolve(path.dirname(abs), m[1]))) {
        dead.push(`${path.relative(root, abs)} -> ${m[1]}`);
      }
    }
    for (const m of text.matchAll(/node\s+([\w./-]+\.(?:mjs|cjs|js))/g)) {
      const candidates = [path.join(root, m[1]), path.resolve(path.dirname(abs), m[1])];
      if (!candidates.some((c) => fs.existsSync(c))) dead.push(`${path.relative(root, abs)} -> node ${m[1]}`);
    }
  }
  expect('no dead relative links or missing scripts in documentation', dead.length === 0, dead.join('; '));
}
