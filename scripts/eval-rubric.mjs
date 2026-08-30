#!/usr/bin/env node
// Structured extraction from ONE report, instead of a preference between two.
//
// Why this exists. The pairwise judge asks "which report is better". Measured
// over fifty length-controlled pairs on 2026-08-30, three judges agreed with
// each other 54-58% of the time — barely above coin flips on a two-way choice
// — and the panel came out 22-22. An instrument that unreliable cannot detect
// an effect of any size, so more pairs buy precision on a number whose meaning
// is unclear.
//
// The diagnosis is the question, not the sample. "Better" is a preference, and
// preferences are what disagreed. So this asks for COUNTS AND FACTS a careful
// reader should extract identically: how many findings, how many cite a file,
// does it say what it did not examine. Extraction is checkable; preference is
// not.
//
// One report at a time, with no sibling to compare against, because a
// comparison reintroduces preference through the back door and because a
// report's own qualities should not depend on what it is sitting next to.
//
// Agreement is measured BEFORE any skill-vs-policy number is reported. An
// instrument has to earn its readings, which is the same standard this suite
// applies to its own checkers.
//
// Usage:
//   node scripts/eval-rubric.mjs --run <runId> [--model <name>]
//     [--judge-harness claude-code|codex] [--dry-run]

import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const suiteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? null : args[i + 1];
};
const has = (name) => args.includes(`--${name}`);

function usage(message) {
  if (message) console.error(message);
  console.error('usage: node scripts/eval-rubric.mjs --run <runId> [--model <name>] [--judge-harness claude-code|codex] [--dry-run]');
  process.exit(2);
}

const runId = flag('run');
if (!runId) usage('--run is required');
const judgeModel = flag('model') || 'claude-haiku-4-5-20251001';
const judgeHarness = flag('judge-harness') || 'claude-code';
if (!['claude-code', 'codex'].includes(judgeHarness)) usage(`unknown --judge-harness ${judgeHarness}`);

const runDir = path.join(suiteRoot, 'eval', 'runs', runId);
if (!fs.existsSync(path.join(runDir, 'run.json'))) usage(`no run bundle at eval/runs/${runId}`);
const manifest = JSON.parse(fs.readFileSync(path.join(runDir, 'run.json'), 'utf8'));
const outputs = path.join(runDir, manifest.files.workspace || 'outputs');
const found = ['ASSESSMENT.md', 'assessment.md', 'REVIEW.md', 'review.md']
  .map((name) => path.join(outputs, name)).find((p) => fs.existsSync(p));
if (!found) usage(`no deliverable found in eval/runs/${runId}/outputs`);
const deliverable = fs.readFileSync(found, 'utf8');

// Every item is a count or a yes/no with a stated decision rule. No item asks
// whether something is good, useful, well-organised or clear — those are the
// judgements that did not replicate.
//
// An eighth item, scopeLimitsNamed ("how many distinct scope limits"), was
// removed after measurement: judges agreed on it 44% of the time, WORSE than
// the holistic question it replaced. Where one such statement ends and the
// next begins is itself a judgement, so counting them smuggles subjectivity
// back in. statesScopeLimits carries the same information at 83%.
//
// longestFindingSupported agreed 100% and every report in the validation
// sample passed it. It is kept as a floor check, not as a discriminator.
const prompt = `Below is an engineering report. Extract facts about it. Do not evaluate whether it is good; only count and check what is present.

Definitions, applied exactly:
- A FINDING is a distinct problem, risk or defect the report asserts about the code under review. A recommendation with no problem behind it is not a finding. Restating the same problem in a summary and again in a detail section counts ONCE.
- EVIDENCE for a finding means a file path, a file path with a line number, a quoted code snippet, or quoted command/test output that appears in the report itself. A description of where to look is not evidence.
- A SCOPE LIMIT is an explicit statement that something was not examined, could not be checked, or is unverified. A general caveat like "further review may be needed" is not a scope limit; naming what was not examined is.

Answer these:
1. findingsTotal: how many distinct findings, by the definition above?
2. findingsWithFilePath: how many of those cite a file path?
3. findingsWithLineOrOutput: how many cite a line number, a code snippet, or command/test output?
4. statesScopeLimits: does the report explicitly name at least one thing it did not examine or could not verify? true or false.
5. verdictStated: does the report state an overall verdict, recommendation or decision? true or false.
6. longestFindingSupported: for the finding the report treats as most severe, does it carry evidence as defined above? true or false. If there are no findings, false.

Respond with ONLY a JSON object, no prose:
{"findingsTotal":n,"findingsWithFilePath":n,"findingsWithLineOrOutput":n,"statesScopeLimits":true|false,"verdictStated":true|false,"longestFindingSupported":true|false}

=== Report ===
${deliverable}
`;

if (has('dry-run')) {
  console.log(JSON.stringify({ runId, judgeModel, judgeHarness, promptChars: prompt.length }, null, 2));
  process.exit(0);
}

function resolveCodex(codexArgs) {
  if (process.platform !== 'win32') return { command: 'codex', args: codexArgs };
  const found2 = spawnSync('where.exe', ['codex'], { encoding: 'utf8', timeout: 10_000 });
  const candidates = (found2.stdout || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const shim = candidates.find((candidate) => candidate.toLowerCase().endsWith('.cmd'));
  if (shim) {
    const script = path.join(path.dirname(shim), 'node_modules', '@openai', 'codex', 'bin', 'codex.js');
    if (fs.existsSync(script)) return { command: process.execPath, args: [script, ...codexArgs] };
  }
  return { command: candidates.find((c) => c.toLowerCase().endsWith('.exe')) || 'codex', args: codexArgs };
}

function runJudge() {
  if (judgeHarness === 'codex') {
    const codexArgs = [
      'exec', '--ephemeral', '--ignore-rules',
      '--disable', 'plugins', '--disable', 'remote_plugin', '--disable', 'skill_search',
      '--skip-git-repo-check', '--sandbox', 'read-only',
      '--model', judgeModel, '-c', 'model_reasoning_effort="low"', '--json', prompt,
    ];
    const invocation = resolveCodex(codexArgs);
    const out = spawnSync(invocation.command, invocation.args, {
      cwd: suiteRoot, encoding: 'utf8', timeout: 300_000, maxBuffer: 20 * 1024 * 1024,
    });
    if (out.error || out.status !== 0) return { failed: out, text: '' };
    const events = (out.stdout || '').split(String.fromCharCode(10)).filter(Boolean).flatMap((line) => {
      try { return [JSON.parse(line)]; } catch { return []; }
    });
    const message = [...events].reverse()
      .find((event) => event.type === 'item.completed' && event.item?.type === 'agent_message');
    return { failed: null, text: message?.item?.text || '' };
  }
  const out = spawnSync('claude', ['-p', '--output-format', 'json', '--model', judgeModel, prompt], {
    cwd: suiteRoot, encoding: 'utf8', timeout: 300_000, maxBuffer: 20 * 1024 * 1024,
  });
  if (out.error || out.status !== 0) return { failed: out, text: '' };
  try { return { failed: null, text: JSON.parse(out.stdout).result || '' }; }
  catch { return { failed: null, text: '' }; }
}

const judged = runJudge();
if (judged.failed) {
  const f = judged.failed;
  console.error(`rubric judge did not run: ${f.error?.message || f.stderr || `exit ${f.status}`}`);
  process.exit(1);
}

let extraction = null;
try {
  const match = judged.text.match(/\{[\s\S]*\}/);
  extraction = match ? JSON.parse(match[0]) : null;
} catch { /* recorded as unparsed */ }

const modelTag = `${judgeHarness === 'codex' ? 'codex-' : ''}${judgeModel}`.replace(/[^a-z0-9]+/gi, '-').replace(/-+$/, '');
const outPath = path.join(suiteRoot, 'eval', 'rubric', `${runId}--${modelTag}.json`);
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, `${JSON.stringify({
  schemaVersion: 1,
  evidentiary: false,
  note: 'Structured extraction by an LLM. Not evidence under eval/evidence.json; never feeds promotion. Report agreement across judges before reporting any comparison.',
  runId,
  caseId: manifest.caseId,
  condition: manifest.condition,
  harness: manifest.harness,
  judgeModel,
  judgeHarness,
  deliverableBytes: Buffer.byteLength(deliverable, 'utf8'),
  extraction,
  rawText: extraction ? undefined : judged.text.slice(0, 4000),
}, null, 2)}\n`);

console.log(JSON.stringify({ runId, judge: modelTag, extraction, written: path.relative(suiteRoot, outPath) }, null, 2));
