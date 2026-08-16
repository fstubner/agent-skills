#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { pathToFileURL, fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const rootAt = process.argv.indexOf('--root');
const root = rootAt >= 0 ? path.resolve(process.argv[rootAt + 1]) : null;
if (!root || !fs.existsSync(root)) {
  console.error('usage: node account-suspension-boundary.mjs --root <workspace>');
  process.exit(2);
}
const suiteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const assertions = [];
const record = (id, pass, evidence) => assertions.push({ id, status: pass ? 'pass' : 'fail', evidence });
let createApp = null;
try {
  ({ createApp } = await import(`${pathToFileURL(path.join(root, 'src', 'app.js')).href}?eval=${Date.now()}`));
} catch (error) {
  record('suspension-behavior', false, `app could not be imported: ${error.message}`);
  record('audit-once', false, `app could not be imported: ${error.message}`);
  record('read-regression', false, `app could not be imported: ${error.message}`);
}
if (createApp) {
  const accounts = [{ id: 'a1', name: 'Ada', state: 'active' }, { id: 'a2', name: 'Lin', state: 'active' }];
  const auditEvents = [];
  let suspendResponse;
  let changedRead;
  let untouchedRead;
  try {
    const app = createApp({ accounts, auditEvents });
    suspendResponse = await app.request('POST', '/accounts/a1/suspend');
    changedRead = await app.request('GET', '/accounts/a1');
    untouchedRead = await app.request('GET', '/accounts/a2');
  } catch (error) {
    suspendResponse = { error: error.message };
  }
  const persisted = accounts.find((item) => item.id === 'a1');
  record('suspension-behavior', suspendResponse?.status >= 200 && suspendResponse?.status < 300 && suspendResponse?.body?.state === 'suspended' && persisted?.state === 'suspended', `response=${JSON.stringify(suspendResponse)}; persisted=${JSON.stringify(persisted)}`);
  const matchingEvents = auditEvents.filter((event) => event.accountId === 'a1' && /suspend/i.test(String(event.action || event.type || event.event)));
  record('audit-once', auditEvents.length === 1 && matchingEvents.length === 1, `events=${JSON.stringify(auditEvents)}`);
  record('read-regression', changedRead?.status === 200 && changedRead?.body?.state === 'suspended' && untouchedRead?.status === 200 && untouchedRead?.body?.state === 'active', `changed=${JSON.stringify(changedRead)}; untouched=${JSON.stringify(untouchedRead)}`);
}

const checker = spawnSync(process.execPath, [path.join(suiteRoot, 'code-organization', 'scripts', 'check-organization.js'), '--root', root, '--no-write'], { encoding: 'utf8', timeout: 30_000 });
let report = null;
try { report = JSON.parse(checker.stdout); } catch { /* recorded below */ }
const cycle = report?.checks?.find((check) => /(?:cycle|circular)/i.test(check.id));
record('no-import-cycle', cycle?.status === 'pass', cycle ? cycle.detail : `checker output was not usable: ${checker.stdout.slice(0, 200)}`);

const domainDir = ['accounts', 'account'].map((name) => path.join(root, 'src', name)).find((candidate) => fs.existsSync(path.join(candidate, 'index.js')));
const appSource = fs.existsSync(path.join(root, 'src', 'app.js')) ? fs.readFileSync(path.join(root, 'src', 'app.js'), 'utf8') : '';
let boundaryPass = false;
let boundaryEvidence = 'src/accounts/index.js or src/account/index.js is missing';
if (domainDir) {
  const relativeName = path.basename(domainDir);
  const indexSource = fs.readFileSync(path.join(domainDir, 'index.js'), 'utf8');
  const legacyFiles = ['controllers/accounts.js', 'services/account-service.js', 'models/account.js']
    .map((name) => path.join(root, 'src', name))
    .filter(fs.existsSync)
    .map((file) => fs.readFileSync(file, 'utf8'))
    .join('\n');
  boundaryPass = new RegExp(`['\"]\\./${relativeName}(?:/index\\.js)?['\"]`).test(appSource)
    && /suspend/i.test(indexSource)
    && !/suspend/i.test(legacyFiles);
  boundaryEvidence = `domain=${relativeName}; appImportsBoundary=${new RegExp(`['\"]\\./${relativeName}(?:/index\\.js)?['\"]`).test(appSource)}; legacyContainsSuspend=${/suspend/i.test(legacyFiles)}`;
}
record('capability-boundary', boundaryPass, boundaryEvidence);

console.log(JSON.stringify({ schemaVersion: 2, caseId: 'account-suspension-boundary', assertions }, null, 2));
process.exit(assertions.some((item) => item.status === 'fail') ? 1 : 0);
