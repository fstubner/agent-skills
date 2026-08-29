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

// Shared walk. `prefix` is the path each entry is recorded under, which is
// what lets a tree be hashed as though it sat somewhere else.
function collect(dir, prefix, chunks) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const full = path.join(dir, entry.name);
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) collect(full, rel, chunks);
    else if (entry.isFile()) chunks.push(`${rel}\0${sha256(fs.readFileSync(full))}\n`);
  }
}

export function hashTree(treeRoot) {
  const chunks = [];
  collect(treeRoot, '', chunks);
  return sha256(chunks.join(''));
}

// The digest eval-run would record as stagedInputSha256 for a skill arm of
// this case, computed WITHOUT staging anything.
//
// eval-run copies each skill directory into <workspace>/.agent-input/<id> and
// hashes that tree, so the recorded digest is over paths like
// `release-engineering/SKILL.md`. Reproducing it here is what lets the report
// ask a question the run-time hashes cannot: not "did an input move since the
// run" — eval-verify covers that — but "has the skill moved with no run since
// at all", where there is no newer bundle to compare against because nobody
// made one.
//
// Skill ids are sorted because hashTree visits a directory's entries in name
// order, so a multi-skill case must contribute its trees in that same order.
export function hashStagedSkills(suiteRoot, skillIds) {
  const chunks = [];
  for (const id of [...skillIds].sort((a, b) => a.localeCompare(b))) {
    collect(path.join(suiteRoot, id), id, chunks);
  }
  return sha256(chunks.join(''));
}
