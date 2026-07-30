import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  root, registry, read, expect, runNode, walk, pathToFileUrl,
  tmpBase, runFixture, assertFixture, ARCH, BACKEND, FRONTEND, ACCEPT,
} from './harness.mjs';

// ---------- 3. Schema validator unit tests (drift must fail loudly) ----------
{
  const { validate } = await import(pathToFileUrl(path.join(root, 'core', 'lib', 'schema.cjs')));
  const s = { type: 'object', required: ['model'], properties: { model: { type: 'string', minLength: 1 }, runIndex: { type: 'integer', minimum: 1 } } };
  expect('schema: minLength enforced', validate(s, { model: '' }).length === 1);
  expect('schema: minimum enforced', validate(s, { model: 'x', runIndex: 0 }).length === 1);
  expect('schema: valid object passes', validate(s, { model: 'x', runIndex: 1 }).length === 0);
  expect('schema: missing required caught', validate(s, {}).length === 1);
  let threw = false;
  try { validate({ type: 'string', format: 'email' }, 'x'); } catch { threw = true; }
  expect('schema: unknown keyword THROWS instead of silently passing', threw);
  const ap = { type: 'object', additionalProperties: { enum: ['pass', 'fail'] } };
  expect('schema: object-form additionalProperties validates values', validate(ap, { a: 'nope' }).length === 1);

  // Regression: the unknown-keyword guard must be STATIC (walk the whole
  // schema up front), not data-path-dependent — a keyword under a branch
  // the data never touches must still throw, or drift in an untested
  // branch ships silently.
  let threwUnreached = false;
  try {
    validate({ type: 'object', properties: { a: { type: 'string' }, b: { type: 'string', format: 'email' } }, required: ['a'] }, { a: 'hello' });
  } catch { threwUnreached = true; }
  expect('schema: unknown keyword throws even on a branch the data never reaches', threwUnreached);

  // Regression: `type` as an array of allowed types must validate correctly,
  // not be silently mishandled while still being in the implemented-keyword set.
  const typeArraySchema = { type: ['string', 'null'] };
  expect('schema: type array accepts a matching string', validate(typeArraySchema, 'hello').length === 0);
  expect('schema: type array accepts a matching null', validate(typeArraySchema, null).length === 0);
  expect('schema: type array rejects a non-matching type', validate(typeArraySchema, 42).length === 1);
}

// ---------- 10b. An empty checks array is not a ship ----------
// computeVerdict([]) returned SHIP and the report schema had no minItems, so a
// producer that emitted zero checks — because it crashed early, was gutted, or
// short-circuited — was recorded by accept-check as a passing producer.
{
  const { computeVerdict } = await import(pathToFileUrl(path.join(root, 'core', 'lib', 'report.cjs')));
  expect('computeVerdict([]) is not SHIP', computeVerdict([]) !== 'SHIP', computeVerdict([]));

  const { validate } = await import(pathToFileUrl(path.join(root, 'core', 'lib', 'schema.cjs')));
  const schema = JSON.parse(read(path.join(root, 'core', 'schemas', 'check-report.schema.json')));
  const emptyReport = {
    schemaVersion: 1, skill: 'x', generatedAt: '2026-01-01T00:00:00Z', root: '/', verdict: 'SHIP', checks: [],
  };
  expect('report schema rejects an empty checks array', validate(schema, emptyReport).length > 0);
}
