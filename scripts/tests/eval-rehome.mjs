// What eval-rehome must refuse, on a synthetic corpus.
//
// Re-homing moves a bundle back into the evidence and rewrites the verdict it
// carries. Everything interesting about the tool is therefore in its refusals:
// the one case it accepts is easy, and each case it declines is a way the
// evidence could have been quietly laundered. So this builds five bundles that
// differ in exactly one respect each and asserts which of them move.
//
// The corpus is synthetic because the alternative is finding out by moving
// real evidence.
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { expect } from './harness.mjs';
import { hashTree, sha256 } from '../lib/tree-hash.mjs';

const root = path.resolve(import.meta.dirname, '..', '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rehome-'));
const rel = (p) => path.relative(root, p).split(path.sep).join('/');

// Scores one assertion from a file the run wrote. Its content does not matter
// to this test; what matters is that it is not the grader the bundles record.
const grader = path.join(tmp, 'grader.mjs');
fs.writeFileSync(grader, `
import fs from 'fs';
const root = process.argv[process.argv.indexOf('--root') + 1];
console.log(JSON.stringify({ schemaVersion: 2, caseId: 'tc', assertions: [
  { id: 'report-written', status: fs.existsSync(root + '/REPORT.md') ? 'pass' : 'fail', evidence: '' },
] }));
`);

const fixture = path.join(tmp, 'fixture');
fs.mkdirSync(fixture, { recursive: true });
fs.writeFileSync(path.join(fixture, 'src.js'), 'module.exports = 1;\n');

// A second fixture that plants a stale gate report, which is the shape the
// archive filter used to drop.
const plantingFixture = path.join(tmp, 'fixture-with-evidence');
fs.mkdirSync(path.join(plantingFixture, '.agent-evidence'), { recursive: true });
fs.writeFileSync(path.join(plantingFixture, '.agent-evidence', 'acceptance-report.json'), '{"verdict":"SHIP"}\n');
fs.writeFileSync(path.join(plantingFixture, 'src.js'), 'module.exports = 1;\n');

fs.mkdirSync(path.join(tmp, 'cases-v2'), { recursive: true });
function writeCase(id, fixtureDir) {
  const file = path.join(tmp, 'cases-v2', `${id}.json`);
  fs.writeFileSync(file, JSON.stringify({
    id, skill: 'x', grader: rel(grader), fixture: rel(fixtureDir),
    conditions: ['control', 'policy', 'skill'],
    assertions: [{ id: 'report-written' }],
  }));
  return sha256(fs.readFileSync(file));
}
const tcSha = writeCase('tc', fixture);
const plantedSha = writeCase('planted', plantingFixture);

const OLD_GRADER_SHA = 'a'.repeat(64);

function bundle(name, { caseId = 'tc', caseSha = tcSha, condition = 'control',
  fixtureSha, graderSha = OLD_GRADER_SHA, evidence = false } = {}) {
  const dir = path.join(tmp, 'runs-superseded', name);
  const outputs = path.join(dir, 'outputs');
  fs.mkdirSync(outputs, { recursive: true });
  fs.writeFileSync(path.join(outputs, 'REPORT.md'), '# review\n');
  if (evidence) {
    fs.mkdirSync(path.join(outputs, '.agent-evidence'), { recursive: true });
    fs.writeFileSync(path.join(outputs, '.agent-evidence', 'acceptance-report.json'), '{"verdict":"SHIP"}\n');
  }
  fs.writeFileSync(path.join(dir, 'transcript.jsonl'), '');
  fs.writeFileSync(path.join(dir, 'grading.json'), JSON.stringify({
    schemaVersion: 2, caseId, assertions: [{ id: 'report-written', status: 'fail', evidence: '' }],
  }));
  fs.writeFileSync(path.join(dir, 'run.json'), JSON.stringify({
    schemaVersion: 2, runId: name, caseId, caseRevision: 1, caseSha256: caseSha,
    fixtureSha256: fixtureSha, graderSha256: graderSha, checkerSha256: null, stagedInputSha256: null,
    condition, harness: 'claude-code', harnessVersion: '1.0', model: 'm',
    startedAt: '2026-09-01T00:00:00.000Z', finishedAt: '2026-09-01T00:01:00.000Z',
    durationMs: 60000, totalTokens: 100, costUsd: 0.01, costCredits: null, exitCode: 0,
    artifactSha256: hashTree(outputs),
    files: { prompt: 'prompt.txt', transcript: 'transcript.jsonl', stderr: 'stderr.txt', grading: 'grading.json', workspace: 'outputs' },
    grading: { passed: 0, failed: 1, notEvaluated: 0, total: 1 },
  }, null, 2));
  return dir;
}

const fixtureSha = hashTree(fixture);
const plantedFixtureSha = hashTree(plantingFixture);

bundle('movable-control', { fixtureSha });
bundle('skill-arm', { condition: 'skill', fixtureSha });
bundle('fixture-moved', { fixtureSha: 'b'.repeat(64) });
bundle('evidence-stripped', { caseId: 'planted', caseSha: plantedSha, fixtureSha: plantedFixtureSha });
bundle('evidence-kept', { caseId: 'planted', caseSha: plantedSha, fixtureSha: plantedFixtureSha, evidence: true });
bundle('already-current', { fixtureSha, graderSha: sha256(fs.readFileSync(grader)) });

fs.mkdirSync(path.join(tmp, 'runs'), { recursive: true });
const run = spawnSync(process.execPath,
  [path.join(root, 'scripts', 'eval-rehome.mjs'), '--all', '--eval-root', tmp],
  { cwd: root, encoding: 'utf8' });
expect('eval-rehome runs against a synthetic corpus', run.status === 0, `${run.stdout}${run.stderr}`);

const rehomed = fs.readdirSync(path.join(tmp, 'runs')).sort();
const left = fs.readdirSync(path.join(tmp, 'runs-superseded')).sort();

expect('a control bundle whose only change is the grader is re-homed',
  rehomed.includes('movable-control'), rehomed.join(', '));
expect('a bundle keeping the evidence its fixture plants is re-homed',
  rehomed.includes('evidence-kept'), rehomed.join(', '));
expect('a skill arm is refused: its staging changed too, not only its grader',
  left.includes('skill-arm') && !rehomed.includes('skill-arm'));
expect('a bundle whose fixture has moved since the run is refused',
  left.includes('fixture-moved') && !rehomed.includes('fixture-moved'));
expect('a bundle archived without the .agent-evidence its fixture plants is refused',
  left.includes('evidence-stripped') && !rehomed.includes('evidence-stripped'));
expect('a bundle already bound to the current grader is left where it is',
  left.includes('already-current') && !rehomed.includes('already-current'));

const moved = JSON.parse(fs.readFileSync(path.join(tmp, 'runs', 'movable-control', 'run.json'), 'utf8'));
expect('the re-homed bundle records that its verdict came from a regrade',
  moved.regrade?.tool === 'scripts/eval-rehome.mjs' && moved.regrade?.fromGraderSha256 === OLD_GRADER_SHA,
  JSON.stringify(moved.regrade));
expect('and is rebound to the grader that actually scored it',
  moved.graderSha256 === sha256(fs.readFileSync(grader)));
const gradingFile = JSON.parse(fs.readFileSync(path.join(tmp, 'runs', 'movable-control', 'grading.json'), 'utf8'));
expect('the recorded counts match the new grading.json, which eval-verify checks',
  moved.grading.passed === gradingFile.assertions.filter((a) => a.status === 'pass').length
  && moved.grading.total === gradingFile.assertions.length,
  `${JSON.stringify(moved.grading)} vs ${JSON.stringify(gradingFile.assertions)}`);
expect('the stored verdict was actually recomputed, not carried over',
  moved.grading.passed === 1, JSON.stringify(moved.grading));

// A dry run must not touch anything. Checked after the real run so the
// assertion is about the flag, not about an empty corpus.
const before = fs.readdirSync(path.join(tmp, 'runs-superseded')).sort().join(',');
spawnSync(process.execPath,
  [path.join(root, 'scripts', 'eval-rehome.mjs'), '--all', '--eval-root', tmp, '--dry-run'],
  { cwd: root, encoding: 'utf8' });
expect('--dry-run moves nothing',
  fs.readdirSync(path.join(tmp, 'runs-superseded')).sort().join(',') === before);

fs.rmSync(tmp, { recursive: true, force: true });
