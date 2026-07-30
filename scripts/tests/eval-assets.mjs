import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  root, registry, read, expect, runNode, walk, pathToFileUrl,
  tmpBase, runFixture, assertFixture, ARCH, BACKEND, FRONTEND, ACCEPT,
} from './harness.mjs';

// ---------- 7. Eval assets ----------
{
  const caseFiles = fs.readdirSync(path.join(root, 'eval', 'cases')).filter((f) => f.endsWith('.json'));
  expect('eval: at least one case exists', caseFiles.length >= 1);
  for (const f of caseFiles) {
    const c = JSON.parse(read(path.join(root, 'eval', 'cases', f)));
    expect(`eval case ${f}: id matches filename`, c.id === f.replace(/\.json$/, ''));
    expect(`eval case ${f}: has prompt and scoring`, typeof c.prompt === 'string' && c.scoring && Object.keys(c.scoring).length > 0);
  }

  // eval/README.md's protocol says a saved result must match
  // eval-result.schema.json, "CI validates shape, not truth" — that claim was
  // false until this block: the schema existed but nothing ever loaded it, so
  // a malformed result would have sat undetected. Actually validating every
  // file in results/ (there are none yet, per the suite's own honest "zero
  // recorded runs" claim) makes it true, and a synthetic bad file proves the
  // check can actually fail rather than vacuously passing on an empty folder.
  const { validate } = await import(pathToFileUrl(path.join(root, 'core', 'lib', 'schema.cjs')));
  const evalResultSchema = JSON.parse(read(path.join(root, 'core', 'schemas', 'eval-result.schema.json')));
  const resultsDir = path.join(root, 'eval', 'results');
  const resultFiles = fs.readdirSync(resultsDir).filter((f) => f.endsWith('.json'));
  for (const f of resultFiles) {
    const errors = validate(evalResultSchema, JSON.parse(read(path.join(resultsDir, f))));
    expect(`eval result ${f} matches eval-result.schema.json`, errors.length === 0, errors.join('; '));
  }
  const badResult = { caseId: 'x', harness: 'not-a-real-harness', model: 'm', runIndex: 0, date: 'not-a-date', scores: { a: 'maybe' } };
  expect('eval-result.schema.json actually rejects a malformed result (not a vacuous pass)',
    validate(evalResultSchema, badResult).length > 0);
}
