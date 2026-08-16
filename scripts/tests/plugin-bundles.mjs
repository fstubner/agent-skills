import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { expect, root } from './harness.mjs';

const result = spawnSync(process.execPath, [path.join(root, 'scripts', 'gen-plugin-bundles.mjs'), '--check'], {
  cwd: root,
  encoding: 'utf8',
});

expect('cross-harness plugin bundles match their source skills', result.status === 0,
  `${result.stdout}${result.stderr}`.trim());

const version = fs.readFileSync(path.join(root, 'VERSION'), 'utf8').trim();
const manifests = [
  ['Claude', 'plugins/agent-skills/.claude-plugin/plugin.json'],
  ['Codex', 'plugins/agent-skills/.codex-plugin/plugin.json'],
  ['Cursor', 'plugins/agent-skills/.cursor-plugin/plugin.json'],
  ['Gemini', 'gemini-extension.json'],
];
for (const [harness, relative] of manifests) {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'));
  expect(`${harness} generated manifest version matches VERSION`, manifest.version === version,
    `${relative}: expected ${version}, got ${manifest.version}`);
}

const antigravityManifest = JSON.parse(fs.readFileSync(
  path.join(root, 'plugins', 'agent-skills', 'plugin.json'), 'utf8'));
expect('Antigravity generated manifest uses the canonical schema',
  antigravityManifest.$schema === 'https://antigravity.google/schemas/v1/plugin.json');
expect('Antigravity generated manifest contains only schema-supported fields',
  Object.keys(antigravityManifest).sort().join(',') === '$schema,description,name',
  Object.keys(antigravityManifest).join(', '));
expect('Antigravity generated manifest identifies the package',
  antigravityManifest.name === 'agent-skills');

const runtimeCases = [
  ['backend-engineering', 'check-backend.js', 'fixtures/backend-ship'],
  ['frontend', 'check-frontend.js', 'fixtures/frontend-no-ui'],
  ['systems-architecture', 'check-architecture.js', 'fixtures/arch-ship'],
  ['release-engineering', 'check-smoke.js', 'fixtures/smoke-ship'],
  ['code-smells', 'check-smells.js', 'fixtures/code-smells-clean'],
  ['product-acceptance', 'accept-check.js', 'fixtures/accept-ship'],
];

for (const skillsRoot of [path.join(root, 'plugins', 'agent-skills', 'skills'), path.join(root, 'skills')]) {
  const label = path.relative(root, skillsRoot).replaceAll('\\', '/');
  for (const [skill, script, fixture] of runtimeCases) {
    const run = spawnSync(process.execPath, [
      path.join(skillsRoot, skill, 'scripts', script),
      '--root', path.join(root, fixture),
      '--no-write',
    ], { cwd: root, encoding: 'utf8' });
    let report = null;
    try { report = JSON.parse(run.stdout); } catch {}
    expect(`${label}: packaged ${skill} checker resolves and executes`,
      report?.skill === skill,
      `${run.stdout}${run.stderr}`.trim());
  }
}
