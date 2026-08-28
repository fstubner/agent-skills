#!/usr/bin/env node
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { harnessDiagnostics } from './lib/harness-diagnostics.mjs';

const suiteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EXCLUDED_OUTPUTS = new Set(['.git', 'node_modules', '.agent-evidence', '.agent-input', '.codex', '.claude']);

function usage(message) {
  if (message) console.error(message);
  console.error('usage: node scripts/eval-run.mjs --case <id> --condition control|policy|checker|skill --harness claude-code|codex|antigravity --model <model> [--max-budget-usd <n>] [--timeout-ms <n>] [--prepare-only] [--codex-external-sandbox|--codex-container]');
  process.exit(2);
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    if (!key.startsWith('--')) usage(`unexpected argument: ${key}`);
    if (key === '--prepare-only' || key === '--codex-external-sandbox' || key === '--codex-container') { args[key.slice(2)] = true; continue; }
    if (i + 1 >= argv.length || argv[i + 1].startsWith('--')) usage(`missing value for ${key}`);
    args[key.slice(2)] = argv[++i];
  }
  return args;
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function resolveInvocation(name, args) {
  if (process.platform !== 'win32') return { command: name, args };
  const found = spawnSync('where.exe', [name], { encoding: 'utf8', timeout: 10_000 });
  const candidates = (found.stdout || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (name === 'codex') {
    const shim = candidates.find((candidate) => candidate.toLowerCase().endsWith('.cmd'));
    if (shim) {
      const script = path.join(path.dirname(shim), 'node_modules', '@openai', 'codex', 'bin', 'codex.js');
      if (fs.existsSync(script)) return { command: process.execPath, args: [script, ...args] };
    }
  }
  return { command: candidates.find((candidate) => candidate.toLowerCase().endsWith('.exe')) || name, args };
}

function copyTree(src, dest, exclude = new Set()) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (exclude.has(entry.name)) continue;
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyTree(from, to, exclude);
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

function cleanupTemp(tempRoot) {
  try {
    fs.rmSync(tempRoot, { recursive: true, force: true, maxRetries: 8, retryDelay: 250 });
  } catch (error) {
    console.error(`warning: temporary workspace cleanup failed: ${error.message}`);
  }
}

function commandVersion(command, args) {
  const invocation = resolveInvocation(command, args);
  const result = spawnSync(invocation.command, invocation.args, { encoding: 'utf8', timeout: 10_000 });
  return (result.stdout || result.stderr || result.error?.message || `exit-${result.status}`).trim().split('\n')[0];
}

function stageConditionInputs(testCase, condition, workspace) {
  const inputRoot = path.join(workspace, '.agent-input');
  if (condition === 'skill') {
    const skillIds = testCase.skills || [testCase.skill];
    for (const skillId of skillIds) {
      copyTree(path.join(suiteRoot, skillId), path.join(inputRoot, skillId));
    }
    return skillIds.map((skillId) => `.agent-input/${skillId}/SKILL.md`);
  }
  if (condition === 'checker') {
    copyTree(path.join(suiteRoot, testCase.skill), path.join(inputRoot, testCase.skill));
    copyTree(path.join(suiteRoot, 'core'), path.join(inputRoot, 'core'));
    return `.agent-input/${testCase.checker}`;
  }
  return null;
}

function buildPrompt(testCase, condition, stagedInput) {
  const sections = [testCase.prompt.trim()];
  sections.push('Work only inside the current workspace. Do not search for or inspect evaluation cases, graders, expected answers, or sibling run outputs. Finish by briefly stating what you verified.');
  if (condition === 'policy') {
    sections.push('Apply this concise engineering policy:\n\n' + fs.readFileSync(path.join(suiteRoot, 'eval', 'baselines', 'concise-policy.md'), 'utf8').trim());
  } else if (condition === 'checker') {
    if (!testCase.checker) usage(`case ${testCase.id} has no checker condition configured`);
    sections.push(`Use the deterministic checker at ${stagedInput} while implementing. The checker is advisory; the task outcome remains authoritative.`);
  } else if (condition === 'skill') {
    const skillPaths = Array.isArray(stagedInput) ? stagedInput : [stagedInput];
    sections.push(`Before implementing, read and follow every skill in this predeclared workflow bundle:\n${skillPaths.map((skillPath) => `- ${skillPath}`).join('\n')}\nLoad only references relevant to this task.`);
  }
  return sections.join('\n\n');
}

function numericValues(value, names, found = []) {
  if (!value || typeof value !== 'object') return found;
  for (const [key, child] of Object.entries(value)) {
    if (names.has(key) && typeof child === 'number') found.push(child);
    else numericValues(child, names, found);
  }
  return found;
}

function runHarness(harness, model, prompt, workspace, maxBudgetUsd, timeoutMs, codexExternalSandbox, codexContainer) {
  if (harness === 'claude-code') {
    const args = ['-p', '--safe-mode', '--disable-slash-commands', '--setting-sources', 'project', '--no-session-persistence', '--output-format', 'json', '--permission-mode', 'acceptEdits', '--model', model, '--max-budget-usd', String(maxBudgetUsd)];
    args.push(prompt);
    const invocation = resolveInvocation('claude', args);
    const result = spawnSync(invocation.command, invocation.args, { cwd: workspace, encoding: 'utf8', timeout: timeoutMs, maxBuffer: 50 * 1024 * 1024 });
    let parsed = null;
    try { parsed = JSON.parse(result.stdout); } catch { /* raw output remains evidence */ }
    const tokenValues = numericValues(parsed, new Set(['input_tokens', 'output_tokens', 'cache_creation_input_tokens', 'cache_read_input_tokens']));
    const costValues = numericValues(parsed, new Set(['total_cost_usd', 'cost_usd']));
    return {
      result,
      harnessVersion: commandVersion('claude', ['--version']),
      totalTokens: tokenValues.length ? tokenValues.reduce((a, b) => a + b, 0) : null,
      costUsd: costValues.length ? Math.max(...costValues) : null,
      costCredits: null,
    };
  }
  // Antigravity CLI. Added as the second cohort because codex has been over
  // its account usage limit for ten days and a contract that cannot be
  // satisfied measures nothing. Gemini CLI is deprecated and is not an
  // option; agy replaced it.
  //
  // Notes on the invocation, learned the hard way: `-p` takes its prompt
  // attached (`-p='...'`) or it swallows the next flag as the prompt, and
  // there is no --cd, so the workspace is the spawn cwd.
  // --disable-slash-commands turns off skill expansion in print mode, which
  // is what keeps a control arm from reaching an ambient installed skill.
  if (harness === 'antigravity') {
    const args = [
      '--output-format', 'json',
      '--disable-slash-commands',
      '--dangerously-skip-permissions',
      '--mode', 'accept-edits',
      '--model', model,
      `-p=${prompt}`,
    ];
    const invocation = resolveInvocation('agy', args);
    const result = spawnSync(invocation.command, invocation.args, {
      cwd: workspace, encoding: 'utf8', timeout: timeoutMs, maxBuffer: 50 * 1024 * 1024,
    });
    let parsed = null;
    try { parsed = JSON.parse(result.stdout); } catch { /* raw output remains evidence */ }
    // agy reports a failed turn as status ERROR with exit 0. Left as-is, a
    // quota or model error would be graded as model failures — the exact
    // shape that produced fabricated zeros on codex, so it is surfaced as a
    // non-zero exit for the environment-failure path to catch.
    if (parsed && parsed.status && parsed.status !== 'SUCCESS') {
      result.status = result.status || 1;
      result.stderr = `${result.stderr || ''}\nagy status ${parsed.status}: ${parsed.error || ''}`;
    }
    return {
      result,
      harnessVersion: `agy ${commandVersion('agy', ['--version'])}`,
      totalTokens: typeof parsed?.usage?.total_tokens === 'number' ? parsed.usage.total_tokens : null,
      costUsd: null,
      costCredits: null,
    };
  }
  if (harness === 'codex') {
    const args = ['exec', '--ephemeral', '--ignore-rules', '--disable', 'plugins', '--disable', 'remote_plugin', '--disable', 'skill_search', '--skip-git-repo-check'];
    if (codexExternalSandbox) args.push('--dangerously-bypass-approvals-and-sandbox');
    else args.push('--sandbox', 'workspace-write');
    args.push('--cd', workspace, '--model', model, '-c', 'model_reasoning_effort="low"', '--json');
    args.push(prompt);
    const isolatedProfile = path.join(path.dirname(workspace), 'isolated-user-profile');
    const isolatedCodexHome = path.join(isolatedProfile, '.codex');
    fs.mkdirSync(isolatedProfile, { recursive: true });
    fs.mkdirSync(isolatedCodexHome, { recursive: true });
    const sourceCodexHome = process.env.CODEX_HOME || path.join(os.homedir(), '.codex');
    const sourceAuth = path.join(sourceCodexHome, 'auth.json');
    if (fs.existsSync(sourceAuth)) fs.copyFileSync(sourceAuth, path.join(isolatedCodexHome, 'auth.json'));
    const registry = JSON.parse(fs.readFileSync(path.join(suiteRoot, 'registry.json'), 'utf8'));
    const skillRoots = [path.join(os.homedir(), '.agents', 'skills'), path.join(os.homedir(), '.codex', 'skills')];
    const disabledSkills = registry.skills.flatMap(({ id }) => skillRoots.map((skillRoot) => path.join(skillRoot, id, 'SKILL.md')));
    const tomlPath = (value) => value.replaceAll('\\', '/').replaceAll('"', '\\"');
    const config = [
      'approval_policy = "never"',
      'sandbox_mode = "workspace-write"',
      '',
      ...disabledSkills.flatMap((skillPath) => ['[[skills.config]]', `path = "${tomlPath(skillPath)}"`, 'enabled = false', '']),
    ].join('\n');
    fs.writeFileSync(path.join(isolatedCodexHome, 'config.toml'), config);
    let invocation;
    let containerName = null;
    if (codexContainer) {
      const containerScript = 'npm install -g @openai/codex@0.146.0 >/tmp/npm-install.log && codex exec --ephemeral --ignore-rules --disable plugins --disable remote_plugin --disable skill_search --skip-git-repo-check --dangerously-bypass-approvals-and-sandbox --cd /workspace --model "$2" -c model_reasoning_effort="low" --json "$1"';
      containerName = `agent-skills-eval-${crypto.randomBytes(6).toString('hex')}`;
      invocation = {
        command: 'docker',
        args: ['run', '--rm', '--name', containerName, '--mount', `type=bind,source=${workspace},target=/workspace`, '--mount', `type=bind,source=${isolatedCodexHome},target=/root/.codex`, 'mcr.microsoft.com/playwright:v1.49.1-noble', 'bash', '-lc', containerScript, '_', prompt, model],
      };
    } else {
      invocation = resolveInvocation('codex', args);
    }
    const result = spawnSync(invocation.command, invocation.args, {
      cwd: workspace,
      encoding: 'utf8',
      timeout: timeoutMs,
      maxBuffer: 50 * 1024 * 1024,
      env: {
        ...process.env,
        // Codex discovers shared skills under the OS user profile independently
        // of --ignore-user-config. Isolate that root so control/policy cells
        // cannot see the evaluator operator's installed skills. Authentication
        // is copied into the temporary Codex home without copying settings,
        // plugins, skills, memory, or session history.
        USERPROFILE: isolatedProfile,
        HOME: isolatedProfile,
        CODEX_HOME: isolatedCodexHome,
      },
    });
    if (containerName && result.error?.code === 'ETIMEDOUT') {
      spawnSync('docker', ['rm', '--force', containerName], { encoding: 'utf8', timeout: 15_000 });
    }
    const events = (result.stdout || '').split('\n').filter(Boolean).flatMap((line) => { try { return [JSON.parse(line)]; } catch { return []; } });
    const usage = [...events].reverse().find((event) => event.type === 'turn.completed')?.usage;
    const totalTokens = usage ? (usage.input_tokens || 0) + (usage.output_tokens || 0) : null;
    const rates = JSON.parse(fs.readFileSync(path.join(suiteRoot, 'eval', 'evidence.json'), 'utf8')).costRates?.[`codex:${model}`];
    const uncachedInput = usage ? Math.max(0, (usage.input_tokens || 0) - (usage.cached_input_tokens || 0)) : null;
    const costCredits = rates && usage
      ? (uncachedInput * rates.inputPerMillion + (usage.cached_input_tokens || 0) * rates.cachedInputPerMillion + (usage.output_tokens || 0) * rates.outputPerMillion) / 1_000_000
      : null;
    return {
      result,
      harnessVersion: codexContainer ? 'codex-cli 0.146.0 (Ubuntu container)' : commandVersion('codex', ['--version']),
      totalTokens,
      costUsd: null,
      costCredits,
    };
  }
  usage(`unsupported harness: ${harness}`);
}

const args = parseArgs(process.argv.slice(2));
for (const required of ['case', 'condition', 'harness', 'model']) if (!args[required]) usage(`missing --${required}`);
if (args['codex-external-sandbox'] && args.harness !== 'codex') usage('--codex-external-sandbox is only valid with --harness codex');
if (args['codex-container'] && args.harness !== 'codex') usage('--codex-container is only valid with --harness codex');
if (args['codex-container'] && args['codex-external-sandbox']) usage('choose only one of --codex-container or --codex-external-sandbox');
if (args['codex-external-sandbox'] && process.env.AGENT_SKILLS_OUTER_SANDBOX !== '1') {
  usage('--codex-external-sandbox requires AGENT_SKILLS_OUTER_SANDBOX=1; do not use it without an independently enforced outer sandbox');
}
const casePath = path.join(suiteRoot, 'eval', 'cases-v2', `${args.case}.json`);
if (!fs.existsSync(casePath)) usage(`unknown case: ${args.case}`);
const caseRaw = fs.readFileSync(casePath);
const testCase = JSON.parse(caseRaw);
if (!testCase.conditions.includes(args.condition)) usage(`condition ${args.condition} is not configured for ${testCase.id}`);
const fixture = path.join(suiteRoot, ...testCase.fixture.split('/'));
const grader = path.join(suiteRoot, ...testCase.grader.split('/'));
if (!fs.existsSync(fixture) || !fs.existsSync(grader)) usage('case fixture or grader is missing');

const runId = `${testCase.id}-${args.harness}-${args.condition}-${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}-${crypto.randomBytes(3).toString('hex')}`;
const configuredTemp = process.env.AGENT_SKILLS_EVAL_TMP;
const writableTemp = configuredTemp || (process.platform === 'win32' && fs.existsSync('C:\\tmp') ? 'C:\\tmp' : os.tmpdir());
fs.mkdirSync(writableTemp, { recursive: true });
const tempRoot = fs.mkdtempSync(path.join(writableTemp, 'agent-skills-eval-'));
const workspace = path.join(tempRoot, 'workspace');
const runDir = path.join(suiteRoot, 'eval', 'runs', runId);
const outputsDir = path.join(runDir, 'outputs');
copyTree(fixture, workspace);
const stagedInput = stageConditionInputs(testCase, args.condition, workspace);
const prompt = buildPrompt(testCase, args.condition, stagedInput);
// Hash of whatever was staged into .agent-input for this condition — the
// skill text for a skill arm, the checker for a checker arm. Without it two
// skill runs of the same case are indistinguishable in eval/runs even when
// the skill was rewritten between them, which is exactly what an experiment
// on the skill's own wording needs to tell apart. Absent for control and
// policy, which stage nothing.
const stagedInputRoot = path.join(workspace, '.agent-input');
const stagedInputSha256 = fs.existsSync(stagedInputRoot) ? hashTree(stagedInputRoot) : null;
if (args['prepare-only']) {
  cleanupTemp(tempRoot);
  console.log(JSON.stringify({ caseId: testCase.id, condition: args.condition, harness: args.harness, model: args.model, prompt }, null, 2));
  process.exit(0);
}
fs.mkdirSync(runDir, { recursive: true });
fs.writeFileSync(path.join(runDir, 'prompt.txt'), prompt + '\n');
const startedAt = new Date();
let harnessRun;
let gradingResult;
try {
  harnessRun = runHarness(args.harness, args.model, prompt, workspace,
    Number(args['max-budget-usd'] || 2), Number(args['timeout-ms'] || 900_000),
    Boolean(args['codex-external-sandbox']), Boolean(args['codex-container']));
  fs.writeFileSync(path.join(runDir, 'transcript.jsonl'), harnessRun.result.stdout || '');
  fs.writeFileSync(path.join(runDir, 'stderr.txt'), harnessRun.result.stderr || harnessRun.result.error?.stack || '');
  gradingResult = spawnSync(process.execPath, [grader, '--root', workspace], {
    cwd: suiteRoot, encoding: 'utf8', timeout: 120_000, maxBuffer: 20 * 1024 * 1024,
  });
  fs.writeFileSync(path.join(runDir, 'grader-raw.txt'), gradingResult.stdout || '');
  fs.writeFileSync(path.join(runDir, 'grader-stderr.txt'), gradingResult.stderr || '');
  copyTree(workspace, outputsDir, EXCLUDED_OUTPUTS);
} finally {
  cleanupTemp(tempRoot);
}

let grading;
try { grading = JSON.parse(gradingResult.stdout); }
catch { grading = { schemaVersion: 2, caseId: testCase.id, assertions: testCase.assertions.map((a) => ({ id: a.id, status: 'not_evaluated', evidence: 'grader emitted invalid JSON' })) }; }
const harnessEvidence = harnessDiagnostics(harnessRun.result);
// A run that never got a model turn is missing evidence, not a negative
// result. Quota exhaustion was not in this list, so two runs that produced
// no model output at all were graded as five model failures each — the
// exact "absence reads as a bad result" error this system exists to
// prevent, committed by the system itself. Observed 2026-08-17 on
// engineering-assessment-hidden-risks.
const environmentFailure = /not logged in|failed to authenticate|oauth session expired|writing is blocked by read-only sandbox|workspace is mounted read-only|spawnSync .* (?:EPERM|EACCES)|usage limit|rate limit|quota exceeded|insufficient credits|overloaded_error|529|service unavailable/i.exec(harnessEvidence);
// Structural backstop, independent of any provider's wording: a non-zero
// exit with no tokens billed means no model turn happened. Message matching
// alone is brittle — every provider phrases exhaustion differently, and the
// next unmatched phrase would silently become five model failures again.
const noModelTurn = harnessRun.result.status !== 0
  && (harnessRun.totalTokens === null || harnessRun.totalTokens === 0);
// Contamination is the opposite case: it lives in what the model DID — its
// tool calls and commands — so this one reads the full transcript on
// purpose, and must not be narrowed to harness diagnostics.
const fullTranscript = `${harnessRun.result.stdout || ''}\n${harnessRun.result.stderr || ''}`;
const ambientSkillAccess = ['control', 'policy'].includes(args.condition)
  && /(?:[A-Z]:\\\\Users\\\\[^\s"']+\\\\(?:\.agents|\.codex)\\\\skills\\\\|\/(?:home|Users)\/[^\s"']+\/(?:\.agents|\.codex)\/skills\/)/i.exec(fullTranscript);
if (environmentFailure || noModelTurn || ambientSkillAccess) {
  let failure;
  if (environmentFailure) failure = `harness environment failure: ${environmentFailure[0]}`;
  else if (noModelTurn) failure = `harness environment failure: harness exited ${harnessRun.result.status} with no tokens billed — no model turn ran`;
  else failure = `evaluation contamination: control/policy accessed an ambient installed skill (${ambientSkillAccess[0]})`;
  grading = {
    schemaVersion: 2,
    caseId: testCase.id,
    assertions: testCase.assertions.map((assertion) => ({
      id: assertion.id,
      status: 'not_evaluated',
      evidence: failure,
    })),
  };
}
fs.writeFileSync(path.join(runDir, 'grading.json'), JSON.stringify(grading, null, 2) + '\n');
const counts = {
  passed: grading.assertions.filter((a) => a.status === 'pass').length,
  failed: grading.assertions.filter((a) => a.status === 'fail').length,
  notEvaluated: grading.assertions.filter((a) => a.status === 'not_evaluated').length,
  total: grading.assertions.length,
};
const finishedAt = new Date();
const manifest = {
  schemaVersion: 2,
  runId,
  caseId: testCase.id,
  caseRevision: testCase.revision,
  caseSha256: sha256(caseRaw),
  stagedInputSha256,
  condition: args.condition,
  harness: args.harness,
  harnessVersion: harnessRun.harnessVersion,
  model: args.model,
  startedAt: startedAt.toISOString(),
  finishedAt: finishedAt.toISOString(),
  durationMs: finishedAt - startedAt,
  totalTokens: harnessRun.totalTokens,
  costUsd: harnessRun.costUsd,
  costCredits: harnessRun.costCredits,
  exitCode: harnessRun.result.status ?? 124,
  artifactSha256: hashTree(outputsDir),
  files: { prompt: 'prompt.txt', transcript: 'transcript.jsonl', stderr: 'stderr.txt', grading: 'grading.json', workspace: 'outputs' },
  grading: counts,
};
fs.writeFileSync(path.join(runDir, 'run.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({ runDir, ...manifest }, null, 2));
process.exit(manifest.exitCode === 0 && counts.failed === 0 && counts.notEvaluated === 0 ? 0 : 1);
