import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { expect, root, tmpBase } from './harness.mjs';

const result = spawnSync(process.execPath, [
  path.join(root, 'scripts', 'check-marketplace-standards.mjs'),
  '--offline',
], { cwd: root, encoding: 'utf8' });

expect('generated marketplace packages share the release version and canonical roots',
  result.status === 0,
  `${result.stdout}${result.stderr}`.trim());

const release = fs.readFileSync(path.join(root, '.github', 'workflows', 'release.yml'), 'utf8');
const runtime = fs.readFileSync(path.join(root, '.github', 'workflows', 'runtime-smoke.yml'), 'utf8');
const drift = fs.readFileSync(path.join(root, '.github', 'workflows', 'standards-drift.yml'), 'utf8');

expect('release: tag must match VERSION',
  release.includes('test "$GITHUB_REF_NAME" = "v${VERSION_VALUE}"'));
expect('release: full tests and runtime installs gate the one build',
  /build-once:\s+needs: \[tests, runtime-smoke\]/m.test(release));
expect('release: archive is built exactly once',
  (release.match(/git archive/g) || []).length === 1);
expect('release: publish consumes the build-once artifact',
  /publish:\s+needs: build-once/m.test(release));
expect('release: checksum is verified before publication',
  release.indexOf('sha256sum --check SHA256SUMS', release.indexOf('publish:')) <
    release.indexOf('gh release create', release.indexOf('publish:')));
expect('release: published bytes are downloaded and verified again',
  release.includes('gh release download "$GITHUB_REF_NAME"') &&
    (release.match(/sha256sum --check SHA256SUMS/g) || []).length === 2);
expect('release: third-party artifact actions are immutable-SHA pinned',
  /actions\/upload-artifact@[0-9a-f]{40}/.test(release) &&
    /actions\/download-artifact@[0-9a-f]{40}/.test(release));

for (const command of [
  'claude plugin install',
  'codex plugin add',
  'gemini extensions install',
  'agy plugin install',
  'verify-installed-package.mjs',
]) {
  expect(`runtime smoke exercises ${command}`, runtime.includes(command));
}
expect('runtime smoke labels Cursor as layout-only',
  runtime.includes('Cursor exposes no documented headless plugin loader'));
expect('canonical standard drift runs on a schedule',
  /schedule:\s+[^]*check-marketplace-standards\.mjs/m.test(drift));

const poisonedInstall = path.join(tmpBase, 'poisoned-installed-package');
fs.cpSync(path.join(root, 'plugins', 'agent-skills'), poisonedInstall, { recursive: true });
const poisonedChecker = path.join(poisonedInstall, 'skills', 'release-engineering', 'scripts', 'check-smoke.js');
fs.writeFileSync(poisonedChecker,
  'console.log(JSON.stringify({skill:"release-engineering",verdict:"BLOCK"})); process.exit(1);\n');
const poisonedResult = spawnSync(process.execPath, [
  path.join(root, 'scripts', 'verify-installed-package.mjs'),
  '--search-root', poisonedInstall,
], { cwd: root, encoding: 'utf8' });
expect('installed-package verification rejects a BLOCKing checker runtime',
  poisonedResult.status !== 0,
  `${poisonedResult.stdout}${poisonedResult.stderr}`.trim());
