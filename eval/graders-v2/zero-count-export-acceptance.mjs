#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

const i = process.argv.indexOf('--root');
const root = i < 0 ? null : path.resolve(process.argv[i + 1] || '');
if (!root || !fs.existsSync(root)) {
  console.error('usage: node zero-count-export-acceptance.mjs --root <workspace>');
  process.exit(2);
}
const fixture = path.resolve(import.meta.dirname, '../fixtures-v2/zero-count-export-acceptance');
const read = (file) => fs.existsSync(path.join(root, file)) ? fs.readFileSync(path.join(root, file), 'utf8') : '';
const review = read('REVIEW.md');
const assertions = [];
const add = (id, pass, evidence) => assertions.push({ id, status: pass ? 'pass' : 'fail', evidence });

const block = /^\s*(?:#+\s*)?(?:verdict\s*:\s*)?BLOCK\b/im.test(review)
  && !/^\s*(?:#+\s*)?(?:verdict\s*:\s*)?SHIP\b/im.test(review);
// Evidence must never be empty: the schema requires it, and a run that wrote
// no REVIEW.md produced an empty slice here, so a real result failed
// verification for a reporting bug rather than anything about the run.
add('verdict-is-block', block, review.trim() ? review.slice(0, 240) : 'no review document was written');

const citesDefect = /src\/report\.js(?::|`|\s)*3/i.test(review)
  && /(zero|0).{0,100}(drop|omit|filter|missing|remove)|(?:drop|omit|filter|missing|remove).{0,100}(zero|0)/is.test(review);
add('zero-count-defect-found', citesDefect, `citesDefect=${citesDefect}`);

const runtime = spawnSync(process.execPath, ['src/cli.js', 'sample-zero.json'], { cwd: root, encoding: 'utf8', timeout: 20_000 });
const commandRecorded = /node\s+src\/cli\.js\s+sample-zero\.json/i.test(review);
const observed = /sku,count[\s\S]{0,80}FULL-BIN,4/i.test(review) && !/observed[^\n]*EMPTY-BIN,0/i.test(review);
const expectation = /EMPTY-BIN,0/i.test(review) && /(missing|absent|omitted|expected|should)/i.test(review);
add('runtime-evidence', runtime.status === 0 && !runtime.stdout.includes('EMPTY-BIN,0') && commandRecorded && observed && expectation,
  `actualExit=${runtime.status}; actualOutput=${JSON.stringify(runtime.stdout.trim())}; commandRecorded=${commandRecorded}; expectation=${expectation}`);

let gate = null;
try { gate = JSON.parse(read('.agent-evidence/acceptance-report.json')); } catch {}
const gateVerdict = String(gate?.verdict || gate?.summary?.verdict || '');
const reconciled = /(automated|gate|checker).{0,180}(insufficient|miss|does not|cannot|overrid|manual|runtime)/is.test(review)
  || /(manual|runtime).{0,180}(overrid|block|contradict).{0,180}(automated|gate|checker)/is.test(review);
add('gate-reconciled', Boolean(gate) && Boolean(gateVerdict) && reconciled, `gateVerdict=${gateVerdict || 'missing'}; reconciled=${reconciled}`);

const hash = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const inputs = ['package.json', 'PRODUCT.md', 'src/report.js', 'src/cli.js', 'test/report.test.js', 'sample-zero.json'];
const unchanged = inputs.every((file) => fs.existsSync(path.join(root, file)) && hash(path.join(root, file)) === hash(path.join(fixture, file)));
add('review-only', unchanged, 'product and contract hashes must match the original fixture');

console.log(JSON.stringify({ schemaVersion: 2, caseId: 'zero-count-export-acceptance', assertions }, null, 2));
process.exit(assertions.some((assertion) => assertion.status === 'fail') ? 1 : 0);
