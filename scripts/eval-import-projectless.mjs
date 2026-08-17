#!/usr/bin/env node
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const suiteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EXCLUDED = new Set(['.git', '.codex', '.claude', '.agent-input', '.fixture-ready', 'node_modules', 'outputs', 'work']);

function usage(message) {
  if (message) console.error(message);
  console.error('usage: node scripts/eval-import-projectless.mjs --case <id> --condition control|policy|skill --model <model> --thread-id <id> --source <task-root> --transcript <rollout.jsonl> [--origin projectless|harness-router]');
  process.exit(2);
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 2) {
    if (!argv[i]?.startsWith('--') || argv[i + 1] === undefined) usage(`invalid argument near ${argv[i] || '<end>'}`);
    args[argv[i].slice(2)] = argv[i + 1];
  }
  return args;
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function copyTree(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (EXCLUDED.has(entry.name)) continue;
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyTree(from, to);
    else if (entry.isFile()) fs.copyFileSync(from, to);
  }
}

function hashTree(root) {
  const chunks = [];
  function visit(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const full = path.join(dir, entry.name);
      const rel = path.relative(root, full).split(path.sep).join('/');
      if (entry.isDirectory()) visit(full);
      else if (entry.isFile()) chunks.push(`${rel}\0${sha256(fs.readFileSync(full))}\n`);
    }
  }
  visit(root);
  return sha256(chunks.join(''));
}

const args = parseArgs(process.argv.slice(2));
for (const required of ['case', 'condition', 'model', 'thread-id', 'source', 'transcript']) {
  if (!args[required]) usage(`missing --${required}`);
}
if (args.origin && !['projectless', 'harness-router'].includes(args.origin)) usage('invalid --origin');
const origin = args.origin || 'projectless';
const casePath = path.join(suiteRoot, 'eval', 'cases-v2', `${args.case}.json`);
if (!fs.existsSync(casePath)) usage(`unknown case ${args.case}`);
const caseRaw = fs.readFileSync(casePath);
const testCase = JSON.parse(caseRaw);
if (!testCase.conditions.includes(args.condition)) usage(`condition ${args.condition} is not configured for ${testCase.id}`);
const source = path.resolve(args.source);
const transcript = path.resolve(args.transcript);
if (!fs.existsSync(source) || !fs.statSync(source).isDirectory() || !fs.existsSync(transcript) || !fs.statSync(transcript).isFile()) usage('source or transcript is missing');

const transcriptRaw = fs.readFileSync(transcript, 'utf8');
const events = transcriptRaw.split(/\r?\n/).filter(Boolean).map((line, index) => {
  try { return JSON.parse(line); }
  catch { usage(`transcript line ${index + 1} is not JSON`); }
});
const meta = events.find((event) => event.type === 'session_meta')?.payload;
if (meta?.session_id !== args['thread-id']) usage('thread id does not match transcript session id');
const completed = [...events].reverse().find((event) => event.type === 'event_msg' && event.payload?.type === 'task_complete')?.payload;
if (!completed) usage('transcript has no task_complete event');
const prompt = events.find((event) => event.type === 'event_msg' && event.payload?.type === 'user_message')?.payload?.message;
if (!prompt) usage('transcript has no user_message event');
const tokenUsage = [...events].reverse().find((event) => event.type === 'event_msg' && event.payload?.type === 'token_count')?.payload?.info?.total_token_usage;
const evidence = JSON.parse(fs.readFileSync(path.join(suiteRoot, 'eval', 'evidence.json'), 'utf8'));
const rate = evidence.costRates?.[`codex:${args.model}`];
const uncachedInput = Math.max(0, (tokenUsage?.input_tokens || 0) - (tokenUsage?.cached_input_tokens || 0));
const costCredits = rate && tokenUsage
  ? (uncachedInput * rate.inputPerMillion + (tokenUsage.cached_input_tokens || 0) * rate.cachedInputPerMillion + (tokenUsage.output_tokens || 0) * rate.outputPerMillion) / 1_000_000
  : null;

const runId = `${testCase.id}-codex-${args.condition}-${new Date(completed.completed_at * 1000).toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}-${args['thread-id'].slice(-6)}`;
const runDir = path.join(suiteRoot, 'eval', 'runs', runId);
if (fs.existsSync(runDir)) usage(`run already exists: ${runId}`);
const outputsDir = path.join(runDir, 'outputs');
fs.mkdirSync(runDir, { recursive: true });
copyTree(source, outputsDir);
fs.writeFileSync(path.join(runDir, 'prompt.txt'), prompt + '\n');
fs.copyFileSync(transcript, path.join(runDir, 'transcript.jsonl'));
fs.writeFileSync(path.join(runDir, 'stderr.txt'), `Imported from a Codex ${origin} task. Harness shell failures, if any, are preserved in transcript.jsonl.\n`);

const grader = path.join(suiteRoot, ...testCase.grader.split('/'));
const gradingRun = spawnSync(process.execPath, [grader, '--root', source], { cwd: suiteRoot, encoding: 'utf8', timeout: 120_000, maxBuffer: 20 * 1024 * 1024 });
fs.writeFileSync(path.join(runDir, 'grader-raw.txt'), gradingRun.stdout || '');
fs.writeFileSync(path.join(runDir, 'grader-stderr.txt'), gradingRun.stderr || '');
let grading;
try { grading = JSON.parse(gradingRun.stdout); }
catch { grading = { schemaVersion: 2, caseId: testCase.id, assertions: testCase.assertions.map((assertion) => ({ id: assertion.id, status: 'not_evaluated', evidence: 'grader emitted invalid JSON' })) }; }
fs.writeFileSync(path.join(runDir, 'grading.json'), JSON.stringify(grading, null, 2) + '\n');
const counts = {
  passed: grading.assertions.filter((assertion) => assertion.status === 'pass').length,
  failed: grading.assertions.filter((assertion) => assertion.status === 'fail').length,
  notEvaluated: grading.assertions.filter((assertion) => assertion.status === 'not_evaluated').length,
  total: grading.assertions.length,
};
const manifest = {
  schemaVersion: 2,
  runId,
  caseId: testCase.id,
  caseRevision: testCase.revision,
  caseSha256: sha256(caseRaw),
  condition: args.condition,
  harness: 'codex',
  harnessVersion: `${origin === 'harness-router' ? 'codex-cli' : 'codex-desktop'} ${meta?.cli_version || 'unknown'}`,
  model: args.model,
  startedAt: new Date(completed.started_at * 1000).toISOString(),
  finishedAt: new Date(completed.completed_at * 1000).toISOString(),
  durationMs: completed.duration_ms,
  totalTokens: Number.isInteger(tokenUsage?.total_tokens) ? tokenUsage.total_tokens : null,
  costUsd: null,
  costCredits,
  exitCode: 0,
  artifactSha256: hashTree(outputsDir),
  files: { prompt: 'prompt.txt', transcript: 'transcript.jsonl', stderr: 'stderr.txt', grading: 'grading.json', workspace: 'outputs' },
  grading: counts,
};
fs.writeFileSync(path.join(runDir, 'run.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({ runDir, ...manifest }, null, 2));
process.exit(counts.failed === 0 && counts.notEvaluated === 0 ? 0 : 1);
