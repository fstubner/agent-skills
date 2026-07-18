#!/usr/bin/env node
/**
 * Scaffold an eval result JSON for a completed unprimed run.
 *
 * Usage:
 *   node scripts/new-eval-result.mjs --harness cursor --model "gpt-x" --case okr-tool --run 1
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const key = argv[i].slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) out[key] = true;
      else {
        out[key] = next;
        i++;
      }
    }
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const harness = args.harness;
const model = args.model;
const caseId = args.case || 'okr-tool';
const runIndex = Number(args.run || 1);
if (!harness || !model) {
  console.error('Required: --harness cursor|claude|codex --model <name>');
  process.exit(2);
}

const version = fs.readFileSync(path.join(root, 'VERSION'), 'utf8').trim();
const date = new Date().toISOString().slice(0, 10);
const slug = `${date}-${harness}-${caseId}-r${runIndex}`.replace(/[^a-zA-Z0-9._-]+/g, '-');
const outPath = path.join(root, 'eval/results', `${slug}.json`);

const doc = {
  schemaVersion: 1,
  caseId,
  harness,
  model: String(model),
  suiteVersion: version,
  runIndex,
  date,
  scores: {
    product: 'fail',
    architecture: 'fail',
    stack: 'fail',
    designUxInterview: 'fail',
    acceptanceSeparation: 'fail',
  },
  artifactsObserved: [],
  notes: 'Fill scores after the run. Open a GitHub issue with label unprimed-eval and set issueUrl.',
  issueUrl: null,
};

fs.writeFileSync(outPath, JSON.stringify(doc, null, 2) + '\n');
console.log(`Wrote ${outPath}`);
console.log('Edit scores, then: node scripts/score-eval-results.mjs');
