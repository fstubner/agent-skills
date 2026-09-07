import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { expect, root, tmpBase } from './harness.mjs';
import { documentText } from '../lib/doc-text.mjs';

// A real code block from https://antigravity.google/docs/cli/plugins, copied
// on 2026-09-07. Shiki highlights per token, so the documented command is
// split across three elements and occurs nowhere in the bytes. The drift job
// substring-matched those bytes and reported for two weeks that Antigravity
// had dropped a command it still documents.
const SHIKI_CODE_BLOCK = '<code><span class="line">'
  + '<span style="color:#6F42C1;--shiki-dark:#B392F0">agy</span>'
  + '<span style="color:#032F62;--shiki-dark:#9ECBFF"> plugin</span>'
  + '<span style="color:#032F62;--shiki-dark:#9ECBFF"> install</span>'
  + '<span style="color:#032F62;--shiki-dark:#9ECBFF"> /path/to/local/plugin</span>'
  + '</span></code>';

expect('the specimen is why the raw-bytes check failed: the command is not in the markup',
  !SHIKI_CODE_BLOCK.includes('agy plugin install'));
expect('documentText reads a command split across highlight spans',
  documentText(SHIKI_CODE_BLOCK).includes('agy plugin install'),
  documentText(SHIKI_CODE_BLOCK));
// Tags become a space, never nothing: two words either side of markup must
// not be joined into a third word that appears on no page.
expect('documentText does not invent words by deleting the markup between them',
  !documentText('<td>agy</td><td>plugin</td>').includes('agyplugin'));
expect('documentText still reports text that is genuinely absent',
  !documentText(SHIKI_CODE_BLOCK).includes('agy plugin publish'));

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
