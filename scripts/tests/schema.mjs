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

// ---------- Human-readable verdicts, without breaking the machine one ----------
// Every verdict a person read was a 40-line JSON dump. The risk in fixing
// that is the acceptance gate: it spawns these checkers and parses stdout,
// so a changed default would break the gate silently. Hence: pipes get
// JSON, terminals get prose, --format overrides both.
{
  const { formatText, chooseFormat } = await import(
    pathToFileUrl(path.join(root, 'core', 'lib', 'report.cjs')));

  const blockReport = {
    schemaVersion: 1, skill: 'systems-architecture', root: '/p', verdict: 'BLOCK',
    checks: [
      { id: 'P-arch-doc', status: 'fail', detail: 'no architecture doc' },
      { id: 'P-section-parts', status: 'not_evaluated', detail: 'no doc to inspect' },
      { id: 'P-scope', status: 'pass', detail: 'multi-part' },
    ],
  };
  const text = formatText(blockReport);
  expect('text format leads with the verdict', text.split('\n')[0].startsWith('BLOCK'), text.split('\n')[0]);
  expect('text format states the failing check and its detail',
    text.includes('P-arch-doc') && text.includes('no architecture doc'), text);
  expect('text format distinguishes not_evaluated from pass',
    text.includes('P-section-parts') && !text.includes('P-scope'), text);
  expect('text format says what to do about a BLOCK', /Nothing ships on a BLOCK/.test(text), text);

  const conditional = formatText({ ...blockReport, verdict: 'CONDITIONAL',
    checks: [{ id: 'A-runtime', status: 'not_evaluated', detail: 'not verified' }] });
  expect('CONDITIONAL is explained as missing evidence, not a pass',
    /missing evidence, not a pass/.test(conditional), conditional);

  // The format decision itself.
  expect('--format text is honoured', chooseFormat({ format: 'text' }) === 'text');
  expect('--format json is honoured', chooseFormat({ format: 'json' }) === 'json');
  let threw = false;
  try { chooseFormat({ format: 'yaml' }); } catch { threw = true; }
  expect('an unknown --format is rejected rather than guessed', threw);

  // The regression that would matter: a spawned checker must emit JSON, and
  // every consumer in this suite spawns. runNode pipes stdout, so this is
  // the real path the acceptance gate takes.
  const spawned = runNode(path.join(root, ...ARCH.split('/')),
    ['--root', path.join(root, 'fixtures', 'arch-block-nodoc'), '--no-write']);
  let parsed = null;
  try { parsed = JSON.parse(spawned.stdout); } catch { /* asserted next */ }
  expect('a spawned checker still emits JSON (the gate parses this)',
    parsed !== null && parsed.verdict === 'BLOCK', spawned.stdout.slice(0, 120));

  const forcedText = runNode(path.join(root, ...ARCH.split('/')),
    ['--root', path.join(root, 'fixtures', 'arch-block-nodoc'), '--no-write', '--format', 'text']);
  expect('--format text works when piped too', forcedText.stdout.startsWith('BLOCK  systems-architecture'),
    forcedText.stdout.slice(0, 120));
  expect('text output keeps the BLOCK exit code', forcedText.status === 1, `exit ${forcedText.status}`);

  const badFormat = runNode(path.join(root, ...ARCH.split('/')),
    ['--root', path.join(root, 'fixtures', 'arch-ship'), '--no-write', '--format', 'yaml']);
  expect('a bad --format is a usage error, not a crash report',
    badFormat.status === 2 && !/crashed/.test(badFormat.stderr), `exit ${badFormat.status}: ${badFormat.stderr.slice(0, 100)}`);
}

{
// uniqueItems, added when evidence.json gained measuredSkills. The validator
// refuses unimplemented keywords rather than skipping them, so adding the
// keyword to a schema without implementing it fails loudly -- which is how
// this arrived.
const { validate } = await import(pathToFileUrl(path.join(root, 'core', 'lib', 'schema.cjs')));
expect('schema: uniqueItems accepts a distinct array',
  validate({ type: 'array', items: { type: 'string' }, uniqueItems: true }, ['a', 'b']).length === 0);
expect('schema: uniqueItems rejects a duplicate (mutation)',
  validate({ type: 'array', items: { type: 'string' }, uniqueItems: true }, ['a', 'a']).length === 1);
expect('schema: uniqueItems compares objects by value, not identity',
  validate({ type: 'array', items: { type: 'object' }, uniqueItems: true }, [{ a: 1 }, { a: 1 }]).length === 1);
}
