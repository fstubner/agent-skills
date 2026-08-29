// The digest that binds a run to its inputs and outputs.
//
// eval-run and eval-verify each carried a byte-identical copy. They have to
// agree exactly — a run's fixtureSha256 is written by one and checked by the
// other — so two copies is a standing invitation for them to drift apart and
// start disagreeing about evidence that is actually fine.
//
// Sharing here does mean a wrong implementation would be wrong in both places
// consistently, and neither would notice. That is why the fixture-binding test
// hashes the tree with its OWN third implementation rather than importing this
// one: the digest is the contract, and something outside the pair has to hold
// it.
//
// Path separators are normalised to '/' so a hash computed on Windows matches
// one computed on Linux for the same tree.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function hashTree(treeRoot) {
  const chunks = [];
  function visit(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const full = path.join(dir, entry.name);
      const rel = path.relative(treeRoot, full).split(path.sep).join('/');
      if (entry.isDirectory()) visit(full);
      else if (entry.isFile()) chunks.push(`${rel}\0${sha256(fs.readFileSync(full))}\n`);
    }
  }
  visit(treeRoot);
  return sha256(chunks.join(''));
}
