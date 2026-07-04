#!/usr/bin/env node
/**
 * Full A/B run: self-check + capture + compare for with-skill vs without-skill builds.
 *
 * Usage:
 *   node run-ab.mjs --with-skill /path/a --without-skill /path/b
 *
 * Starts two static servers, captures screenshots, runs self-check, writes ab-report.json.
 */
import fs from 'fs';
import path from 'path';
import { spawn, spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { ensureDir, parseArgs } from './lib.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const harnessRoot = path.resolve(__dirname, '..');
const skillRoot = path.resolve(harnessRoot, '..');

const args = parseArgs(process.argv.slice(2));
const portWith = args.portWith || 8772;
const portWithout = args.portWithout || 8773;

if (!args.withSkill || !args.withoutSkill) {
  console.error('Usage: node run-ab.mjs --with-skill <dir> --without-skill <dir>');
  process.exit(1);
}

const artifactsRoot = path.join(harnessRoot, 'artifacts', `ab-${Date.now()}`);
const withOut = path.join(artifactsRoot, 'with-skill');
const withoutOut = path.join(artifactsRoot, 'without-skill');
ensureDir(withOut);
ensureDir(withoutOut);

function startServer(cwd, port) {
  return spawn('python', ['-m', 'http.server', String(port)], {
    cwd,
    stdio: 'ignore',
    shell: false,
  });
}

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function runNode(script, scriptArgs, cwd) {
  const r = spawnSync(process.execPath, [script, ...scriptArgs], {
    cwd,
    encoding: 'utf8',
    shell: false,
  });
  return { code: r.status ?? 1, stdout: r.stdout || '', stderr: r.stderr || '' };
}

const serverWith = startServer(args.withSkill, portWith);
const serverWithout = startServer(args.withoutSkill, portWithout);
await wait(800);

try {
  console.log('\n--- Capturing with-skill ---');
  runNode(path.join(__dirname, 'capture.mjs'), [
    '--app', args.withSkill,
    '--base-url', `http://localhost:${portWith}`,
    '--out', withOut,
  ], harnessRoot);

  console.log('\n--- Capturing without-skill ---');
  runNode(path.join(__dirname, 'capture.mjs'), [
    '--app', args.withoutSkill,
    '--base-url', `http://localhost:${portWithout}`,
    '--out', withoutOut,
  ], harnessRoot);

  console.log('\n--- self-check with-skill ---');
  const checkWith = runNode(path.join(skillRoot, 'scripts', 'self-check.js'), [
    '--root', args.withSkill,
    '--skill-root', skillRoot,
    '--out', path.join(withOut, 'self-check-report.json'),
  ], args.withSkill);

  console.log('\n--- self-check without-skill ---');
  const checkWithout = runNode(path.join(skillRoot, 'scripts', 'self-check.js'), [
    '--root', args.withoutSkill,
    '--skill-root', skillRoot,
    '--out', path.join(withoutOut, 'self-check-report.json'),
  ], args.withoutSkill);

  console.log('\n--- Smoke with-skill ---');
  const smokeWith = runNode(path.join(__dirname, 'smoke.mjs'), [
    '--base-url', `http://localhost:${portWith}`,
  ], harnessRoot);

  console.log('\n--- Smoke without-skill ---');
  const smokeWithout = runNode(path.join(__dirname, 'smoke.mjs'), [
    '--base-url', `http://localhost:${portWithout}`,
  ], harnessRoot);

  const report = {
    generatedAt: new Date().toISOString(),
    withSkill: {
      path: args.withSkill,
      port: portWith,
      artifacts: withOut,
      selfCheckCode: checkWith.code,
      smokeCode: smokeWith.code,
      selfCheck: JSON.parse(fs.readFileSync(path.join(withOut, 'self-check-report.json'), 'utf8')),
    },
    withoutSkill: {
      path: args.withoutSkill,
      port: portWithout,
      artifacts: withoutOut,
      selfCheckCode: checkWithout.code,
      smokeCode: smokeWithout.code,
      selfCheck: JSON.parse(fs.readFileSync(path.join(withoutOut, 'self-check-report.json'), 'utf8')),
    },
    compareNote: 'Compare screenshots manually or run compare.mjs with with-skill as baseline',
  };

  const reportPath = path.join(artifactsRoot, 'ab-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');

  console.log(`\nA/B complete. Report: ${reportPath}`);
  console.log(`  with-skill:    ${report.withSkill.selfCheck.verdict} | smoke ${smokeWith.code === 0 ? 'PASS' : 'FAIL'}`);
  console.log(`  without-skill: ${report.withoutSkill.selfCheck.verdict} | smoke ${smokeWithout.code === 0 ? 'PASS' : 'FAIL'}`);
} finally {
  serverWith.kill();
  serverWithout.kill();
}
