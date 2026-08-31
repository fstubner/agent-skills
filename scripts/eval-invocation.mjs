#!/usr/bin/env node
// Selection-layer harness: given the installed skills' names and descriptions
// and a user request, which skill does the model say it would invoke first?
//
// This measures SELECTION, not invocation. Asking "which skill would you
// invoke" is a direct question about the router; a real session must also
// spontaneously decide to consult the list mid-task, which this deliberately
// does not test. Selection is an upper bound on invocation: a prompt the
// router cannot match here will certainly not fire in a session. Results
// therefore carry protocol: "selection-declared", and nothing written by this
// script is evidence about unprimed invocation — that stays with the unprimed
// protocol in eval/README.md.
//
// Why it exists: unprimed invocation measured ~0% (eval/README.md), and the
// efficacy programme deliberately bypasses the router. Nothing measured the
// router itself, and description changes were unfalsifiable. Each trial
// shuffles the skill listing deterministically so a fixed listing order
// cannot masquerade as description quality (position bias is real and now
// measurable: every trial records the chosen skill's position).
//
// usage:
//   node scripts/eval-invocation.mjs --prompts eval/invocation/prompts.json \
//     --model <model> [--trials 3] [--limit N] [--offset N] [--dry-run]
import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { spawnSync } from 'child_process';
import { pathToFileURL } from 'url';

const root = path.resolve(import.meta.dirname, '..');

export function extractFrontmatterDescription(text) {
  const normalized = text.replace(/\r\n/g, '\n');
  const match = normalized.match(/^---\n([\s\S]*?)\n---(?:\n|$)/);
  if (!match) return null;
  const lines = match[1].split('\n');
  for (let i = 0; i < lines.length; i++) {
    const key = /^description:(?:\s*(.*))?$/.exec(lines[i]);
    if (!key) continue;
    const raw = (key[1] ?? '').trim();
    if (!/^[>|][-+]?\s*$/.test(raw)) return raw;
    const block = [];
    i++;
    while (i < lines.length && /^\s+/.test(lines[i])) { block.push(lines[i].trim()); i++; }
    return block.join(raw.startsWith('>') ? ' ' : '\n').trim();
  }
  return null;
}

export function loadSkillListing(rootDir = root) {
  const registry = JSON.parse(fs.readFileSync(path.join(rootDir, 'registry.json'), 'utf8'));
  const ids = (registry.skills ?? registry).map((s) => s.id ?? s.name ?? s);
  return ids.map((id) => {
    const description = extractFrontmatterDescription(
      fs.readFileSync(path.join(rootDir, id, 'SKILL.md'), 'utf8'),
    );
    if (!description) throw new Error(`no description extracted for ${id}`);
    return { id, description };
  });
}

// Deterministic per-trial shuffle (mulberry32 over a sha256-derived seed), so
// a run is reproducible and listing order varies across trials.
export function shuffledListing(listing, promptId, trial) {
  const seed = crypto.createHash('sha256').update(`${promptId}\n${trial}`).digest().readUInt32BE(0);
  let a = seed || 1;
  const rand = () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const copy = listing.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function composePrompt(listing, request) {
  const lines = listing.map((s) => `- ${s.id}: ${s.description}`);
  return [
    'You are a coding agent. The Agent Skills below are installed. A skill is',
    "invoked when the user's request matches what its description says it is",
    'for; invoking one loads its full instructions before you start the task.',
    '',
    '<installed-skills>',
    ...lines,
    '</installed-skills>',
    '',
    "The user's request:",
    '',
    '<request>',
    request,
    '</request>',
    '',
    'Which ONE installed skill would you invoke first for this request, if',
    'any? Many requests match no installed skill; do not force a match.',
    'Reply with only a single-line JSON object, nothing else:',
    '{"skill": "<skill-name>" | null, "alternatives": ["<other plausible skill names, in order>"]}',
  ].join('\n');
}

export function parseReply(text, knownIds) {
  const match = String(text).match(/\{[\s\S]*\}/);
  if (!match) return { skill: undefined, alternatives: [], parseError: 'no JSON object in reply' };
  try {
    const parsed = JSON.parse(match[0]);
    const known = new Set(knownIds);
    const skill = parsed.skill === null ? null
      : known.has(parsed.skill) ? parsed.skill : undefined;
    const alternatives = Array.isArray(parsed.alternatives)
      ? parsed.alternatives.filter((s) => known.has(s)) : [];
    return {
      skill,
      alternatives,
      parseError: skill === undefined && parsed.skill !== null ? `unknown skill ${JSON.stringify(parsed.skill)}` : null,
    };
  } catch (error) {
    return { skill: undefined, alternatives: [], parseError: `unparseable JSON: ${error.message}` };
  }
}

export function scoreTrial(reply, expected, ordered) {
  const isDistractor = expected.length === 0;
  return {
    top1: !isDistractor && expected.includes(reply.skill),
    nullCorrect: isDistractor && reply.skill === null,
    altHit: !isDistractor && !expected.includes(reply.skill)
      && reply.alternatives.some((s) => expected.includes(s)),
    chosenPosition: reply.skill ? ordered.findIndex((s) => s.id === reply.skill) + 1 : null,
  };
}

function resolveInvocation(name, args) {
  if (process.platform !== 'win32') return { command: name, args };
  const found = spawnSync('where.exe', [name], { encoding: 'utf8', timeout: 10_000 });
  const candidates = (found.stdout || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  return { command: candidates.find((c) => c.toLowerCase().endsWith('.exe')) || name, args };
}

function runTrial(model, prompt, workspace, timeoutMs) {
  const args = ['-p', '--safe-mode', '--disable-slash-commands', '--setting-sources', 'project',
    '--no-session-persistence', '--output-format', 'json', '--model', model,
    '--max-budget-usd', '0.2', prompt];
  const invocation = resolveInvocation('claude', args);
  const result = spawnSync(invocation.command, invocation.args, {
    cwd: workspace, encoding: 'utf8', timeout: timeoutMs, maxBuffer: 16 * 1024 * 1024,
  });
  let parsed = null;
  try { parsed = JSON.parse(result.stdout); } catch { /* recorded raw below */ }
  return {
    exitCode: result.status,
    replyText: parsed?.result ?? result.stdout ?? '',
    costUsd: parsed?.total_cost_usd ?? null,
    stderr: (result.stderr || '').slice(0, 2000),
  };
}

function aggregate(records) {
  const skillTrials = records.filter((r) => r.expected.length > 0);
  const distractorTrials = records.filter((r) => r.expected.length === 0);
  const perSkill = {};
  for (const r of skillTrials) {
    for (const s of r.expected) {
      perSkill[s] = perSkill[s] || { trials: 0, top1: 0 };
      perSkill[s].trials++;
      if (r.score.top1) perSkill[s].top1++;
    }
  }
  const confusion = {};
  for (const r of skillTrials.filter((t) => !t.score.top1 && t.reply.skill)) {
    const key = `${r.expected.join('+')} -> ${r.reply.skill}`;
    confusion[key] = (confusion[key] || 0) + 1;
  }
  return {
    skillTrials: skillTrials.length,
    top1: skillTrials.filter((r) => r.score.top1).length,
    altHit: skillTrials.filter((r) => r.score.altHit).length,
    distractorTrials: distractorTrials.length,
    nullCorrect: distractorTrials.filter((r) => r.score.nullCorrect).length,
    parseErrors: records.filter((r) => r.reply.parseError).length,
    perSkill,
    confusion,
  };
}

function main() {
  const argv = process.argv.slice(2);
  const opt = (name, fallback) => {
    const i = argv.indexOf(`--${name}`);
    return i >= 0 ? argv[i + 1] : fallback;
  };
  const promptsPath = opt('prompts', 'eval/invocation/prompts.json');
  const model = opt('model', null);
  const trials = Number(opt('trials', '3'));
  const limit = Number(opt('limit', 'Infinity'));
  const offset = Number(opt('offset', '0'));
  const dryRun = argv.includes('--dry-run');
  if (!model && !dryRun) {
    console.error('usage: node scripts/eval-invocation.mjs --prompts <file> --model <model> [--trials 3] [--limit N] [--offset N] [--dry-run]');
    process.exit(2);
  }

  const promptSet = JSON.parse(fs.readFileSync(path.resolve(root, promptsPath), 'utf8'));
  const listing = loadSkillListing();
  const knownIds = listing.map((s) => s.id);
  const canonical = listing.map((s) => `${s.id}: ${s.description}`).join('\n');
  const selected = promptSet.prompts.slice(offset, offset + (Number.isFinite(limit) ? limit : promptSet.prompts.length));

  if (dryRun) {
    const sample = composePrompt(shuffledListing(listing, selected[0].id, 0), selected[0].prompt);
    console.log(sample);
    console.log(`\n[dry-run] ${selected.length} prompts x ${trials} trials; listing sha256=${crypto.createHash('sha256').update(canonical).digest('hex').slice(0, 16)}`);
    return;
  }

  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-select-'));
  const records = [];
  for (const item of selected) {
    for (let trial = 0; trial < trials; trial++) {
      const ordered = shuffledListing(listing, item.id, trial);
      const prompt = composePrompt(ordered, item.prompt);
      const run = runTrial(model, prompt, workspace, 120_000);
      const reply = parseReply(run.replyText, knownIds);
      const score = scoreTrial(reply, item.expected, ordered);
      records.push({ promptId: item.id, trial, expected: item.expected, reply, score,
        costUsd: run.costUsd, exitCode: run.exitCode,
        rawReply: run.replyText.slice(0, 1500), stderr: run.stderr || undefined });
      const label = score.top1 ? 'top1' : score.nullCorrect ? 'null-ok'
        : reply.parseError ? `error(${reply.parseError})` : `chose ${reply.skill}`;
      console.log(`${item.id} t${trial}: ${label}`);
    }
  }

  const bundle = {
    schemaVersion: 1,
    protocol: 'selection-declared',
    model,
    trialsPerPrompt: trials,
    startedAt: new Date().toISOString(),
    promptsSha256: crypto.createHash('sha256').update(fs.readFileSync(path.resolve(root, promptsPath))).digest('hex'),
    descriptionsSha256: crypto.createHash('sha256').update(canonical).digest('hex'),
    descriptionsVariant: promptSet.descriptionsVariant ?? 'current',
    aggregate: aggregate(records),
    records,
  };
  const outDir = path.join(root, 'eval', 'invocation', 'runs');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `${new Date().toISOString().replace(/[:.]/g, '-')}-${model.replace(/[^a-z0-9.-]/gi, '_')}.json`);
  fs.writeFileSync(outPath, JSON.stringify(bundle, null, 1));
  const a = bundle.aggregate;
  console.log(`\ntop-1 ${a.top1}/${a.skillTrials} on skill prompts; null-correct ${a.nullCorrect}/${a.distractorTrials} on distractors; parse errors ${a.parseErrors}`);
  console.log(`written: ${path.relative(root, outPath)}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
