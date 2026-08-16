#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const rootAt = process.argv.indexOf('--root');
const root = rootAt >= 0 ? path.resolve(process.argv[rootAt + 1]) : null;
if (!root || !fs.existsSync(root)) {
  console.error('usage: node project-label-library.mjs --root <workspace>');
  process.exit(2);
}
const assertions = [];
const add = (id, pass, evidence) => assertions.push({ id, status: pass ? 'pass' : 'fail', evidence });
try {
  const labelsPath = path.join(root, 'src', 'labels.js');
  const mod = await import(pathToFileURL(labelsPath).href + `?v=${Date.now()}`);
  const statuses = ['active', 'paused', 'archived'];
  const results = statuses.map((status) => mod.formatProjectLabel?.('  Atlas   App ', status));
  add('formats-statuses', results.every((value, index) => value === `Atlas App [${statuses[index]}]`), JSON.stringify(results));
  let blank = false;
  let unknown = false;
  try { mod.formatProjectLabel?.('   ', 'active'); } catch (error) { blank = error instanceof TypeError; }
  try { mod.formatProjectLabel?.('Atlas', 'deleted'); } catch (error) { unknown = error instanceof TypeError; }
  add('validates-boundary', blank && unknown, `blank=${blank}; unknown=${unknown}`);
  add('preserves-api', mod.normalizeName?.('  Atlas   App ') === 'Atlas App', `value=${JSON.stringify(mod.normalizeName?.('  Atlas   App '))}`);
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const tests = process.platform === 'win32'
    ? spawnSync(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', 'npm test'], { cwd: root, encoding: 'utf8', timeout: 30_000 })
    : spawnSync('npm', ['test'], { cwd: root, encoding: 'utf8', timeout: 30_000 });
  add('scope-discipline', pkg.type === 'module' && Object.keys(pkg.dependencies || {}).length === 0 && tests.status === 0,
    `type=${pkg.type}; dependencies=${Object.keys(pkg.dependencies || {}).length}; tests=${tests.status}`);
} catch (error) {
  for (const id of ['formats-statuses', 'validates-boundary', 'preserves-api', 'scope-discipline']) {
    if (!assertions.some((item) => item.id === id)) add(id, false, String(error));
  }
}
console.log(JSON.stringify({ schemaVersion: 2, caseId: 'project-label-library', assertions }, null, 2));
process.exit(assertions.some((item) => item.status === 'fail') ? 1 : 0);
