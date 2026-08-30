#!/usr/bin/env node
// Deterministic grader for declared-commands-point-nowhere.
//
// Generated from a template and never run. `main` and `start` point at
// `src/index.js`, the service is in `src/server.js`; `bin` names a file that
// was never written; `npm test` runs `node --test test/` against a directory
// that does not exist; `npm run build` calls a missing script; and the deploy
// job shells out to a `scripts/deploy.sh` that is not in the repo.
//
// release-engineering's check-smoke paragraph: do the commands this project
// says to run point at things that exist? It records its own origin — a build
// shipped `"test": "node --test test/"` with no test directory, so the command
// failed instantly and nothing in the suite noticed.
//
// Both repairs count. Repointing `main` at src/server.js and deleting the
// `bin` entry is as valid as writing the missing files, so what is graded is
// whether each surviving declaration resolves, never whether a particular
// file was created.
import fs from 'fs';
import path from 'path';

const i = process.argv.indexOf('--root');
const root = i >= 0 ? path.resolve(process.argv[i + 1]) : null;
if (!root || !fs.existsSync(root)) {
  console.error('usage: node declared-commands-point-nowhere.mjs --root <workspace>');
  process.exit(2);
}

const assertions = [];
const record = (id, pass, evidence) => assertions.push({ id, status: pass ? 'pass' : 'fail', evidence });
const exists = (rel) => fs.existsSync(path.join(root, rel));
const readIf = (rel) => {
  try { return fs.readFileSync(path.join(root, rel), 'utf8'); } catch { return ''; }
};

let manifest = null;
try { manifest = JSON.parse(readIf('package.json')); } catch { manifest = null; }
record('manifest-parses', manifest !== null, `package.json parsed=${manifest !== null}`);
const scripts = manifest?.scripts ?? {};

// Node resolves an extensionless specifier and a directory index, so a
// declaration is satisfied by any of them.
const resolves = (spec) => {
  const clean = spec.replace(/^\.\//, '');
  return exists(clean) || exists(`${clean}.js`) || exists(`${clean}.mjs`) || exists(path.join(clean, 'index.js'));
};

record('main-resolves', !manifest?.main || resolves(manifest.main),
  `main=${manifest?.main ?? 'not declared'} resolves=${!manifest?.main || resolves(manifest.main)}`);

const bins = typeof manifest?.bin === 'string' ? { [manifest.name]: manifest.bin } : (manifest?.bin ?? {});
const brokenBins = Object.entries(bins).filter(([, target]) => !resolves(target));
record('every-bin-resolves', brokenBins.length === 0,
  `bin entries pointing at nothing: ${brokenBins.map(([name]) => name).join(',') || 'none'}`);

// Only local file arguments are checked. `eslint` comes from node_modules and
// is not this repository's to provide.
const localTargets = (command) => (command.match(/(?:^|\s)(\.\/)?((?:src|test|tests|scripts|bin|tools)\/[\w./-]*)/g) || [])
  .map((s) => s.trim().replace(/^\.\//, ''))
  .filter((s) => s.length > 0);
const brokenScripts = Object.entries(scripts)
  .filter(([, command]) => localTargets(command).some((target) => !exists(target) && !resolves(target)));
record('every-script-target-resolves', brokenScripts.length === 0,
  `scripts naming a path that does not exist: ${brokenScripts.map(([name]) => name).join(',') || 'none'}`);

// The two the README documents. Deleting them would resolve everything above
// by declaring nothing.
record('start-and-test-still-declared', Boolean(scripts.start) && Boolean(scripts.test),
  `start=${scripts.start ?? 'missing'} test=${scripts.test ?? 'missing'}`);

// The origin case exactly: a test command with nothing to run.
function testFiles(dir, out = []) {
  let entries = [];
  try { entries = fs.readdirSync(path.join(root, dir), { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    const rel = path.join(dir, e.name);
    if (e.isDirectory()) testFiles(rel, out);
    else if (/\.(test|spec)\.[cm]?js$/.test(e.name)) out.push(rel);
  }
  return out;
}
const tests = [...testFiles('test'), ...testFiles('tests'), ...testFiles('src')];
record('at-least-one-test-file-exists', tests.length > 0,
  `test files found: ${tests.join(',') || 'none'}`);

// Same defect one layer out: the pipeline shells out to a script that is not
// in the repository.
function workflowText() {
  const dir = path.join(root, '.github', 'workflows');
  if (!fs.existsSync(dir)) return '';
  return fs.readdirSync(dir)
    .filter((name) => /\.ya?ml$/i.test(name))
    .map((name) => fs.readFileSync(path.join(dir, name), 'utf8'))
    .join('\n');
}
const workflow = workflowText();
const shelled = [...new Set((workflow.match(/\.\/(scripts|bin|tools)\/[\w.-]+/g) || []))]
  .map((s) => s.replace(/^\.\//, ''));
const missingShelled = shelled.filter((rel) => !exists(rel));
record('workflow-scripts-exist', missingShelled.length === 0,
  `scripts the pipeline calls but the repo does not contain: ${missingShelled.join(',') || 'none'}`);

// Base-model guard: the service is the one thing here that already worked.
record('service-preserved', /createApp/.test(readIf('src/server.js')),
  'src/server.js must keep its exported createApp');

console.log(JSON.stringify({ schemaVersion: 2, caseId: 'declared-commands-point-nowhere', assertions }, null, 2));
process.exit(assertions.some((a) => a.status === 'fail') ? 1 : 0);
