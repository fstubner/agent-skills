// Invoking a harness: the three CLIs, and what each one lies about.
//
// Extracted from eval-run.mjs when that file passed 400 lines and this
// repository's own code-smells checker refused the commit. The seam is not
// arbitrary — everything here answers one question ("run this prompt against
// this harness and tell me what it cost"), and the three helpers below exist
// only to serve it. What stays behind in eval-run.mjs is the run bundle: what
// to stage, what to capture, what to write down.
//
// suiteRoot arrives as an argument rather than a module constant, because a
// library that reads its caller's globals is a library only by filename.
//
// An unsupported harness throws instead of calling usage(). Exiting the
// process is the caller's decision to make, not a helper's.
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { CLAUDE_ALLOWED_TOOLS } from './eval-harness-policy.mjs';

// Windows resolves a bare `codex` to a .cmd shim that spawnSync cannot run
// directly; the .exe or the underlying .js is what actually executes.
export function resolveInvocation(name, args) {
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

function commandVersion(command, args) {
  const invocation = resolveInvocation(command, args);
  const result = spawnSync(invocation.command, invocation.args, { encoding: 'utf8', timeout: 10_000 });
  return (result.stdout || result.stderr || result.error?.message || `exit-${result.status}`).trim().split('\n')[0];
}

// Harnesses report usage at different depths and under different names, so
// this walks for the keys rather than assuming a shape that changes per
// release.
export function numericValues(value, names, found = []) {
  if (!value || typeof value !== 'object') return found;
  for (const [key, child] of Object.entries(value)) {
    if (names.has(key) && typeof child === 'number') found.push(child);
    else numericValues(child, names, found);
  }
  return found;
}

function runClaudeCode({ model, prompt, workspace, maxBudgetUsd, timeoutMs }) {
  const args = ['-p', '--safe-mode', '--disable-slash-commands', '--setting-sources', 'project', '--no-session-persistence', '--output-format', 'json', '--permission-mode', 'acceptEdits', '--allowedTools', ...CLAUDE_ALLOWED_TOOLS, '--model', model, '--max-budget-usd', String(maxBudgetUsd)];
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
// Learned the hard way: `-p` takes its prompt attached or it swallows the
// next flag; --disable-slash-commands stops skill expansion, keeping a
// control arm off an ambient installed skill; and --add-dir is REQUIRED,
// because agy ignores the spawn cwd and edits in its own scratch dir, so
// without it the grader scores an untouched fixture. Pinned in a test.
function runAntigravity({ model, prompt, workspace, timeoutMs }) {
  const args = [
    '--output-format', 'json',
    '--disable-slash-commands',
    '--dangerously-skip-permissions',
    '--mode', 'accept-edits', '--add-dir', workspace,
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

// Codex discovers shared skills under the OS user profile independently of
// --ignore-user-config, so the profile root is isolated per run and the
// installed skills are disabled by name. Without this a control arm reads
// whatever the evaluator happens to have installed, which is contamination
// the eligibility rules then have to catch after the fact.
function isolateCodexHome(workspace, suiteRoot) {
  const isolatedProfile = path.join(path.dirname(workspace), 'isolated-user-profile');
  const isolatedCodexHome = path.join(isolatedProfile, '.codex');
  fs.mkdirSync(isolatedProfile, { recursive: true });
  fs.mkdirSync(isolatedCodexHome, { recursive: true });
  const sourceCodexHome = process.env.CODEX_HOME || path.join(os.homedir(), '.codex');
  const sourceAuth = path.join(sourceCodexHome, 'auth.json');
  // Authentication is copied without settings, plugins, skills, memory or
  // session history.
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
  return { isolatedProfile, isolatedCodexHome };
}

function runCodex({ model, prompt, workspace, timeoutMs, codexExternalSandbox, codexContainer, suiteRoot }) {
  const args = ['exec', '--ephemeral', '--ignore-rules', '--disable', 'plugins', '--disable', 'remote_plugin', '--disable', 'skill_search', '--skip-git-repo-check'];
  if (codexExternalSandbox) args.push('--dangerously-bypass-approvals-and-sandbox');
  else args.push('--sandbox', 'workspace-write');
  args.push('--cd', workspace, '--model', model, '-c', 'model_reasoning_effort="low"', '--json');
  args.push(prompt);
  const { isolatedProfile, isolatedCodexHome } = isolateCodexHome(workspace, suiteRoot);
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

// An options object rather than the eight positional arguments this carried
// in eval-run.mjs: the fifth and sixth were a budget and a timeout, both
// numbers, and nothing at the call site said which was which.
export function runHarness(options) {
  if (options.harness === 'claude-code') return runClaudeCode(options);
  if (options.harness === 'antigravity') return runAntigravity(options);
  if (options.harness === 'codex') return runCodex(options);
  throw new Error(`unsupported harness: ${options.harness}`);
}
