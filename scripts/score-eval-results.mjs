#!/usr/bin/env node
/**
 * Score machine-readable eval results under eval/results/.
 * Validates each result against eval-result.schema.json and applies suite thresholds.
 *
 * Usage:
 *   node scripts/score-eval-results.mjs [--dir eval/results] [--strict]
 *   node scripts/score-eval-results.mjs --file eval/results/foo.json
 */
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const { validateJson } = require('../_suite/lib/validate-json-schema.js');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

function parseArgs(argv) {
  const out = { strict: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--strict') out.strict = true;
    else if (argv[i] === '--dir') out.dir = argv[++i];
    else if (argv[i] === '--file') out.file = argv[++i];
  }
  return out;
}

function loadJSON(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

const args = parseArgs(process.argv.slice(2));
const suite = loadJSON(path.join(root, 'eval/suite.json'));
const schema = loadJSON(path.join(root, '_suite/schemas/eval-result.schema.json'));
const cases = new Set(suite.cases);

let files = [];
if (args.file) {
  files = [path.resolve(root, args.file)];
} else {
  const dir = path.resolve(root, args.dir || 'eval/results');
  files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json') && !f.startsWith('.'))
    .map((f) => path.join(dir, f));
}

const criteria = suite.criteria.map((c) => c.id);
const tallies = Object.fromEntries(criteria.map((id) => [id, { pass: 0, fail: 0 }]));
const failures = [];
let counted = 0;

for (const file of files) {
  const base = path.basename(file);
  if (base === 'example.valid.json') continue; // fixture for schema only
  const result = loadJSON(file);
  const errs = validateJson(result, schema);
  if (errs.length) {
    failures.push(`${base}: schema invalid`);
    errs.forEach((e) => console.error(`  ${e}`));
    continue;
  }
  if (!cases.has(result.caseId)) {
    failures.push(`${base}: unknown caseId ${result.caseId}`);
    continue;
  }
  counted += 1;
  for (const id of criteria) {
    const v = result.scores[id];
    if (v === 'pass') tallies[id].pass += 1;
    else tallies[id].fail += 1;
  }
  console.log(`ok   ${base}`);
}

// Always validate the example against schema
{
  const example = path.join(root, 'eval/results/example.valid.json');
  const errs = validateJson(loadJSON(example), schema);
  if (errs.length) {
    failures.push('example.valid.json schema invalid');
    errs.forEach((e) => console.error(`  ${e}`));
  } else {
    console.log('ok   example.valid.json (schema)');
  }
}

console.log('\nCriterion pass rates:');
let overallPass = 0;
let overallTotal = 0;
const rateFails = [];
for (const id of criteria) {
  const { pass, fail } = tallies[id];
  const total = pass + fail;
  const rate = total ? pass / total : null;
  const label = rate === null ? 'n/a (no runs)' : `${(rate * 100).toFixed(0)}% (${pass}/${total})`;
  console.log(`  ${id}: ${label}`);
  if (rate !== null) {
    overallPass += pass;
    overallTotal += total;
    if (rate < suite.thresholds.minPassRatePerCriterion) {
      rateFails.push(`${id} ${(rate * 100).toFixed(0)}% < ${(suite.thresholds.minPassRatePerCriterion * 100).toFixed(0)}%`);
    }
  }
}
const overall = overallTotal ? overallPass / overallTotal : null;
console.log(
  `overall: ${overall === null ? 'n/a' : `${(overall * 100).toFixed(0)}% (${overallPass}/${overallTotal})`}  runs_counted: ${counted}`,
);

if (failures.length) {
  console.error(`\n${failures.length} validation failure(s)`);
  process.exit(1);
}

if (args.strict && counted > 0) {
  if (overall !== null && overall < suite.thresholds.minOverallPassRate) {
    console.error(`\nOverall pass rate below threshold`);
    process.exit(1);
  }
  if (rateFails.length) {
    console.error(`\nPer-criterion thresholds failed:\n  ${rateFails.join('\n  ')}`);
    process.exit(1);
  }
}

if (counted === 0) {
  console.log('\nNo published runs yet (example excluded). Schema path is ready.');
}
