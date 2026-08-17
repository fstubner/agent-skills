#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const rootIndex = process.argv.indexOf('--root');
const root = rootIndex < 0 ? null : path.resolve(process.argv[rootIndex + 1] || '');
if (!root) process.exit(2);

const assertions = [];
const add = (id, pass, evidence) => assertions.push({ id, status: pass ? 'pass' : 'fail', evidence });
const read = (relative) => fs.existsSync(path.join(root, relative)) ? fs.readFileSync(path.join(root, relative), 'utf8') : '';
let server;

async function request(base, body, { auth = 'alice', key = 'refund-1' } = {}) {
  const headers = { connection: 'close', 'content-type': 'application/json' };
  if (auth) headers.authorization = `Bearer ${auth}`;
  if (key) headers['idempotency-key'] = key;
  const response = await fetch(base + '/payments/pay-1/refunds', { method: 'POST', headers, body: JSON.stringify(body) });
  const text = await response.text();
  let json;
  try { json = JSON.parse(text); } catch { /* malformed JSON is graded below */ }
  return { status: response.status, text, json };
}

const migrationDir = path.join(root, 'migrations');
const newMigrations = fs.existsSync(migrationDir)
  ? fs.readdirSync(migrationDir).filter((name) => /^\d+.*\.sql$/i.test(name) && !/^001(?:\D|$)/.test(name)).sort()
  : [];
const sql = newMigrations.map((name) => fs.readFileSync(path.join(migrationDir, name), 'utf8')).join('\n');
const additive = newMigrations.length > 0 && !/\b(?:DROP|RENAME)\b/i.test(sql);
const ledger = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?refunds\b/i.test(sql);
const amountInvariant = /(CHECK\s*\([^)]*amount_cents\s*>\s*0|amount_cents[^,;]*CHECK\s*\([^)]*>\s*0)/is.test(sql);
const idempotencyInvariant = /(UNIQUE\s*\([^)]*(?:idempotency|request_key)|CREATE\s+UNIQUE\s+INDEX[\s\S]*(?:idempotency|request_key))/i.test(sql);
const paymentReference = /(REFERENCES\s+payments|FOREIGN\s+KEY\s*\([^)]*payment)/i.test(sql);
add('additive-schema', additive && ledger && amountInvariant && idempotencyInvariant && paymentReference,
  `files=${newMigrations.join(',') || 'none'}, additive=${additive}, ledger=${ledger}, amount=${amountInvariant}, idempotency=${idempotencyInvariant}, paymentReference=${paymentReference}`);

try {
  const module = await import(pathToFileURL(path.join(root, 'src', 'server.js')).href + `?v=${Date.now()}`);
  server = module.createServer({ payments: [{ id: 'pay-1', owner: 'alice', amountCents: 5000 }] });
  await new Promise((resolve, reject) => server.listen(0, '127.0.0.1', (error) => error ? reject(error) : resolve()));
  const base = `http://127.0.0.1:${server.address().port}`;

  const missingAuth = await request(base, { amountCents: 1000 }, { auth: null, key: 'missing-auth' });
  const invalid = await request(base, { amountCents: 1.5 }, { key: 'invalid-amount' });
  const crossAccount = await request(base, { amountCents: 1000 }, { auth: 'bob', key: 'cross-account' });
  const first = await request(base, { amountCents: 3000 }, { key: 'stable-refund' });
  const replay = await request(base, { amountCents: 4999 }, { key: 'stable-refund' });
  const excessive = await request(base, { amountCents: 2500 }, { key: 'excessive-refund' });
  const firstId = first.json?.id || first.json?.refund?.id;
  const replayId = replay.json?.id || replay.json?.refund?.id;

  add('server-boundary', [401, 403].includes(missingAuth.status) && [403, 404].includes(crossAccount.status)
    && invalid.status >= 400 && invalid.status < 500,
    `missingAuth=${missingAuth.status}, crossAccount=${crossAccount.status}, fractionalAmount=${invalid.status}`);
  add('refund-invariant', first.status >= 200 && first.status < 300 && Boolean(firstId) && firstId === replayId
    && excessive.status >= 400 && excessive.status < 500,
    `first=${first.status}/${String(firstId)}, replay=${replay.status}/${String(replayId)}, excessive=${excessive.status}`);
  const clientErrors = [invalid, crossAccount, excessive];
  add('structured-errors', clientErrors.every((result) => typeof result.json?.code === 'string' && typeof result.json?.message === 'string'
    && !/(stack|node:|[A-Z]:\\|\/src\/)/i.test(result.text)), clientErrors.map((result) => `${result.status}:${result.text.slice(0, 100)}`).join(' | '));
} catch (error) {
  for (const id of ['server-boundary', 'refund-invariant', 'structured-errors']) {
    if (!assertions.some((assertion) => assertion.id === id)) add(id, false, String(error));
  }
} finally {
  if (server) {
    server.closeAllConnections?.();
    await new Promise((resolve) => server.close(resolve));
  }
}

const testFiles = [];
for (const directory of ['test', 'tests']) {
  const absolute = path.join(root, directory);
  if (fs.existsSync(absolute)) {
    for (const name of fs.readdirSync(absolute).filter((entry) => /\.test\.[cm]?js$|\.spec\.[cm]?js$/i.test(entry))) testFiles.push(path.join(directory, name));
  }
}
const testText = testFiles.map(read).join('\n');
let packageJson = {};
try { packageJson = JSON.parse(read('package.json')); } catch { /* malformed package is graded as a failure */ }
const canonicalTestCommand = /^node\s+--test(?:\s|$)/.test(packageJson.scripts?.test || '');
const testRun = spawnSync(process.execPath, ['--test', '--test-reporter=tap'], { cwd: root, encoding: 'utf8', timeout: 30_000 });
const meaningfulTests = (testText.match(/\btest\s*\(/g) || []).length >= 3
  && /idempot|retry/i.test(testText) && /(exceed|remaining|over.?refund)/i.test(testText) && /(owner|account|auth)/i.test(testText);
add('regression-suite', canonicalTestCommand && testRun.status === 0 && meaningfulTests,
  `canonicalCommand=${canonicalTestCommand}, exit=${testRun.status}, files=${testFiles.join(',') || 'none'}, boundaryCoverage=${meaningfulTests}, output=${(testRun.stdout || testRun.stderr || '').slice(0, 300)}`);

const release = read('.github/workflows/release.yml');
const pinnedActions = [...release.matchAll(/uses:\s*([^\s@]+)@([^\s#]+)/gi)];
const immutableActions = pinnedActions.length >= 2 && pinnedActions.every((match) => /^[0-9a-f]{40}$/i.test(match[2]));
const tagTrigger = /tags\s*:/i.test(release);
const buildOnce = /upload-artifact/i.test(release) && /download-artifact/i.test(release);
const releaseConsumesBuild = /needs\s*:\s*(?:\[[^\]]*\b(?:test|build)\b[^\]]*\]|(?:test|build))/i.test(release);
const testsBeforeBuild = /(?:npm\s+test|node\s+--test)[\s\S]{0,2000}(?:archive|package|upload-artifact)/i.test(release);
add('immutable-release', tagTrigger && buildOnce && releaseConsumesBuild && testsBeforeBuild && immutableActions,
  `tagTrigger=${tagTrigger}, uploadAndDownload=${buildOnce}, needsBuild=${releaseConsumesBuild}, testsBeforeArtifact=${testsBeforeBuild}, immutableActions=${immutableActions}`);

const rollback = read('RELEASE.md') || read('ROLLBACK.md');
const literalCommand = /```(?:bash|sh|shell|powershell)?\s*\r?\n[^`\r\n]*(?:gh\s+release\s+edit|kubectl\s+rollout\s+undo|deploy|promote)[^`\r\n]*\r?\n```/i.test(rollback);
add('literal-rollback', literalCommand, rollback.replace(/\s+/g, ' ').trim().slice(0, 400) || 'release documentation missing');

console.log(JSON.stringify({ schemaVersion: 2, caseId: 'refund-ledger-rollout', assertions }, null, 2));
process.exitCode = assertions.some((assertion) => assertion.status === 'fail') ? 1 : 0;
