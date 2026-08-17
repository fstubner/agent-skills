#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { pathToFileURL, fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const rootAt = process.argv.indexOf('--root');
const root = rootAt >= 0 ? path.resolve(process.argv[rootAt + 1]) : null;
if (!root || !fs.existsSync(root)) {
  console.error('usage: node invoice-suspension-refactor.mjs --root <workspace>');
  process.exit(2);
}
const suiteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const assertions = [];
const record = (id, pass, evidence) => assertions.push({ id, status: pass ? 'pass' : 'fail', evidence });
const modulePath = path.join(root, 'src', 'calculate-invoice.js');
let calculateInvoice = null;
try {
  ({ calculateInvoice } = await import(`${pathToFileURL(modulePath).href}?eval=${Date.now()}`));
} catch (error) {
  record('suspended-zero', false, `module could not be imported: ${error.message}`);
  record('active-regression', false, `module could not be imported: ${error.message}`);
}

if (calculateInvoice) {
  const suspended = [
    { status: 'suspended', plan: 'basic', usage: 0, currency: 'USD' },
    { status: 'suspended', plan: 'pro', usage: 900, currency: 'EUR', coupon: 'SAVE10' },
    { status: 'suspended', plan: 'basic', usage: 150, currency: 'EUR' }
  ];
  const suspendedResults = suspended.map((input) => calculateInvoice(input));
  record('suspended-zero', suspendedResults.every((value) => value === 0), `results=${JSON.stringify(suspendedResults)}; expected all zero`);

  const active = [
    [{ status: 'active', plan: 'basic', usage: 50, currency: 'USD' }, 20],
    [{ status: 'active', plan: 'basic', usage: 150, currency: 'USD' }, 25],
    [{ status: 'active', plan: 'pro', usage: 150, currency: 'USD', coupon: 'SAVE10' }, 50],
    [{ status: 'active', plan: 'pro', usage: 150, currency: 'EUR', coupon: 'SAVE10' }, 44],
    [{ status: 'active', plan: 'basic', usage: 25, currency: 'EUR', coupon: 'SAVE10' }, 8]
  ];
  const activeResults = active.map(([input, expected]) => ({ expected, actual: calculateInvoice(input) }));
  record('active-regression', activeResults.every((item) => item.actual === item.expected), JSON.stringify(activeResults));
}

const checker = spawnSync(process.execPath, [path.join(suiteRoot, 'code-smells', 'scripts', 'check-smells.js'), '--root', root, '--no-write'], { encoding: 'utf8', timeout: 30_000 });
let report = null;
try { report = JSON.parse(checker.stdout); } catch { /* recorded below */ }
const nesting = report?.checks?.find((check) => check.id === 'S-deep-nesting');
record('nesting-resolved', nesting?.status === 'pass', nesting ? nesting.detail : `checker output was not usable: ${checker.stdout.slice(0, 200)}`);

const pkg = path.join(root, 'package.json');
let command = null;
try { command = JSON.parse(fs.readFileSync(pkg, 'utf8')).scripts?.test; } catch { /* recorded below */ }
const tests = !command ? null : process.platform === 'win32'
  ? spawnSync(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', 'npm test'], { cwd: root, encoding: 'utf8', timeout: 30_000 })
  : spawnSync('npm', ['test'], { cwd: root, encoding: 'utf8', timeout: 30_000 });
record('tests-run', Boolean(tests) && tests.status === 0, tests ? `command=${command}; exit=${tests.status}; output=${JSON.stringify(((tests.stdout || '') + (tests.stderr || '')).slice(0, 300))}` : 'package.json scripts.test is missing or unreadable');

console.log(JSON.stringify({ schemaVersion: 2, caseId: 'invoice-suspension-refactor', assertions }, null, 2));
process.exit(assertions.some((item) => item.status === 'fail') ? 1 : 0);
