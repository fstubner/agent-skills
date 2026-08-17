#!/usr/bin/env node
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const i = process.argv.indexOf('--root');
const root = i >= 0 ? path.resolve(process.argv[i + 1]) : null;
if (!root || !fs.existsSync(root)) { console.error('usage: node learn-session-indented-comment.mjs --root <workspace>'); process.exit(2); }
const fixture = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'fixtures-v2', 'learn-session-indented-comment');
const assertions = [];
const record = (id, pass, evidence) => assertions.push({ id, status: pass ? 'pass' : 'fail', evidence });
const source = fs.readFileSync(path.join(root, 'src', 'parser.js'), 'utf8');
const original = fs.readFileSync(path.join(fixture, 'src', 'parser.js'), 'utf8');
record('runtime-unchanged', source === original, `byteIdentical=${source === original}`);
const runTests = (cwd) => process.platform === 'win32'
  ? spawnSync(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', 'npm test'], { cwd, encoding: 'utf8', timeout: 20_000 })
  : spawnSync('npm', ['test'], { cwd, encoding: 'utf8', timeout: 20_000 });
const current = runTests(root);
record('tests-pass', current.status === 0, `exit=${current.status}; output=${JSON.stringify(((current.stdout || '') + (current.stderr || '')).slice(0, 300))}`);
const testFiles = [];
for (const dir of ['test', 'tests']) {
  const full = path.join(root, dir);
  if (fs.existsSync(full)) for (const entry of fs.readdirSync(full, { recursive: true })) {
    const file = path.join(full, String(entry));
    if (fs.existsSync(file) && fs.statSync(file).isFile()) testFiles.push(file);
  }
}
const tests = testFiles.map((f) => fs.readFileSync(f, 'utf8')).join('\n');
const whitespaceCase = /isComment\(\s*(['"`])(?: {2,}|\\t)#/i.test(tests) || /(?:leading|optional|indent).{0,40}(?:space|whitespace|comment)/i.test(tests);
record('specific-regression', whitespaceCase, `testFiles=${testFiles.length}; whitespaceCase=${whitespaceCase}`);
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'learn-eval-'));
let mutant;
try {
  fs.cpSync(root, temp, { recursive: true });
  const mutantPath = path.join(temp, 'src', 'parser.js');
  fs.writeFileSync(mutantPath, fs.readFileSync(mutantPath, 'utf8').replace('.trimStart()', ''));
  mutant = runTests(temp);
} finally { fs.rmSync(temp, { recursive: true, force: true }); }
record('mutation-killed', current.status === 0 && mutant?.status !== 0, `currentExit=${current.status}; mutantExit=${mutant?.status}`);
const fixtureFiles = new Set(['package.json', 'src/parser.js', 'test/parser.test.js', 'SESSION.md'].map((p) => p.toLowerCase()));
const added = [];
const walk = (dir) => { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, e.name); if (e.isDirectory()) walk(p); else { const rel = path.relative(root, p).replaceAll('\\', '/').toLowerCase(); if (!fixtureFiles.has(rel)) added.push(rel); } } };
walk(root);
const addedOutsideTests = added.filter((p) => !p.startsWith('test/') && !p.startsWith('tests/'));
record('durable-destination', whitespaceCase && addedOutsideTests.length === 0, `added=${added.join(',') || 'none'}; outsideTests=${addedOutsideTests.join(',') || 'none'}`);
console.log(JSON.stringify({ schemaVersion: 2, caseId: 'learn-session-indented-comment', assertions }, null, 2));
process.exit(assertions.some((a) => a.status === 'fail') ? 1 : 0);
