#!/usr/bin/env node
// Blind holistic comparison of two run bundles' deliverables.
//
// Every assertion in this suite is deterministic, which is the right default
// and leaves a real gap: two reports can pass identical assertions and differ
// enormously in whether a person could act on them. This asks a model to
// compare them on qualities no regex reaches — organisation, specificity,
// whether the ranking reflects real risk.
//
// It is NOT evidence under eval/evidence.json and never feeds promotion.
// Judgements land in eval/judgements/, are labelled with the judge model, and
// are reproducible only in the sense that the inputs and prompt are recorded.
//
// Blinding: the judge sees "Report A" and "Report B" with no condition,
// harness or filename. Which bundle takes which letter is decided by a hash
// of the two run ids, so the assignment is stable across re-runs rather than
// random — a rerun that flipped the labels would look like a changed verdict.
//
// Usage:
//   node scripts/eval-judge.mjs --a <runId> --b <runId> [--model <name>] [--equal-length] [--dry-run]

import crypto from 'crypto';
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
  console.error('usage: node scripts/eval-judge.mjs --a <runId> --b <runId> [--model <name>] [--equal-length] [--dry-run]');
  process.exit(2);
}

const runIdA = flag('a');
const runIdB = flag('b');
if (!runIdA || !runIdB) usage('both --a and --b are required');
const judgeModel = flag('model') || 'claude-haiku-4-5-20251001';

function loadRun(runId) {
  const dir = path.join(suiteRoot, 'eval', 'runs', runId);
  const manifestPath = path.join(dir, 'run.json');
  if (!fs.existsSync(manifestPath)) usage(`no run bundle at eval/runs/${runId}`);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const outputs = path.join(dir, manifest.files.workspace || 'outputs');
  const candidates = ['ASSESSMENT.md', 'assessment.md', 'REVIEW.md', 'review.md'];
  const found = candidates.map((name) => path.join(outputs, name)).find((p) => fs.existsSync(p));
  if (!found) usage(`no deliverable found in eval/runs/${runId}/outputs`);
  return { runId, manifest, deliverable: fs.readFileSync(found, 'utf8'), file: path.basename(found) };
}

const left = loadRun(runIdA);
const right = loadRun(runIdB);
if (left.manifest.caseId !== right.manifest.caseId) {
  usage(`runs are from different cases (${left.manifest.caseId} vs ${right.manifest.caseId})`);
}

// Stable coin flip from the pair of ids.
const flip = parseInt(crypto.createHash('sha256').update(`${runIdA}|${runIdB}`).digest('hex').slice(0, 2), 16) % 2 === 1;
const asA = flip ? right : left;
const asB = flip ? left : right;

const testCase = JSON.parse(fs.readFileSync(path.join(suiteRoot, 'eval', 'cases-v2', `${left.manifest.caseId}.json`), 'utf8'));

// --equal-length: cut both deliverables to the shorter one's size, at a line
// boundary, so the judge cannot see which agent wrote more.
//
// Measured on 2026-08-30, the unmodified judge agreed with the byte count
// twelve times out of twelve across twelve pairs — the skill arm won exactly
// when its report was longer. That pass could not distinguish better from
// bigger, and the skill arm reliably writes more.
//
// This trades one bias for a smaller one rather than removing bias. Only the
// LONGER report is actually cut, so it ends mid-thought; a report that saves
// its conclusions for the end is penalised, and a front-loaded one is
// flattered. The prompt says a report was truncated and that an abrupt ending
// is not a defect, because without that the cut becomes a bias against the
// document it cut — the exact mirror of the problem being fixed.
const equalLength = has('equal-length');
function cutToBytes(text, limit) {
  if (Buffer.byteLength(text, 'utf8') <= limit) return { text, truncated: false };
  let out = '';
  for (const line of text.split('\n')) {
    if (Buffer.byteLength(`${out}${line}\n`, 'utf8') > limit) break;
    out += `${line}\n`;
  }
  return { text: out, truncated: true };
}
let lengthControl = null;
if (equalLength) {
  const limit = Math.min(
    Buffer.byteLength(left.deliverable, 'utf8'),
    Buffer.byteLength(right.deliverable, 'utf8'),
  );
  const cutLeft = cutToBytes(left.deliverable, limit);
  const cutRight = cutToBytes(right.deliverable, limit);
  left.deliverable = cutLeft.text;
  right.deliverable = cutRight.text;
  lengthControl = {
    mode: 'equal-length',
    limitBytes: limit,
    truncated: { [left.runId]: cutLeft.truncated, [right.runId]: cutRight.truncated },
  };
}

const prompt = `You are comparing two engineering reports written for the same task by two different agents. You do not know which agent produced which, and that is deliberate — judge only what is on the page.

The task they were both given:
"""
${testCase.prompt.trim()}
"""

Score each report 1-5 on each dimension, where 3 is competent and unremarkable:
- actionability: could an engineer act on these findings today without further investigation?
- evidence: are claims tied to specific files, lines or command output rather than asserted?
- prioritisation: does the ordering reflect real risk, or is it arbitrary?
- honesty: does it distinguish what was checked from what was assumed, and admit gaps?
- readability: is it organised so the important thing is found first?

Then name a winner ("A", "B", or "tie") and give one sentence of reasoning citing something concrete from each report.${equalLength ? `

Both reports below have been cut to the same length so that neither is longer than the other. One of them therefore stops abruptly, possibly mid-section. That is an artefact of the cut, not a fault of the report: do not treat an unfinished ending, a missing summary, or absent closing sections as a defect, and do not reward or penalise either report for its length.` : ''}

Respond with ONLY a JSON object, no prose around it:
{"scores":{"A":{"actionability":n,"evidence":n,"prioritisation":n,"honesty":n,"readability":n},"B":{...}},"winner":"A|B|tie","reasoning":"..."}

=== Report A ===
${asA.deliverable}

=== Report B ===
${asB.deliverable}
`;

if (has('dry-run')) {
  console.log(JSON.stringify({ caseId: left.manifest.caseId, judgeModel, blinding: { A: asA.runId, B: asB.runId }, promptChars: prompt.length }, null, 2));
  process.exit(0);
}

const result = spawnSync('claude', ['-p', '--output-format', 'json', '--model', judgeModel, prompt], {
  cwd: suiteRoot, encoding: 'utf8', timeout: 300_000, maxBuffer: 20 * 1024 * 1024,
});
if (result.error || result.status !== 0) {
  console.error(`judge did not run: ${result.error?.message || result.stderr || `exit ${result.status}`}`);
  process.exit(1);
}

let verdict = null;
let rawText = '';
try {
  const envelope = JSON.parse(result.stdout);
  rawText = envelope.result || '';
  const match = rawText.match(/\{[\s\S]*\}/);
  verdict = match ? JSON.parse(match[0]) : null;
} catch { /* recorded as unparsed below */ }

const stamp = left.manifest.startedAt.replace(/[-:.TZ]/g, '').slice(0, 14);
// The suffix keeps a length-controlled judgement from overwriting the
// unmodified one for the same pair; comparing the two IS the experiment.
const suffix = equalLength ? '-equal-length' : '';
const outPath = path.join(suiteRoot, 'eval', 'judgements', `${left.manifest.caseId}-${stamp}-${runIdA.slice(-6)}-vs-${runIdB.slice(-6)}${suffix}.json`);
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, `${JSON.stringify({
  schemaVersion: 1,
  evidentiary: false,
  note: 'Blind LLM comparison. Not evidence under eval/evidence.json; never feeds promotion.',
  caseId: left.manifest.caseId,
  judgeModel,
  blinding: { A: asA.runId, B: asB.runId },
  conditions: { [asA.runId]: asA.manifest.condition, [asB.runId]: asB.manifest.condition },
  skillVersions: { [asA.runId]: asA.manifest.stagedInputSha256 || null, [asB.runId]: asB.manifest.stagedInputSha256 || null },
  lengthControl,
  verdict,
  rawText: verdict ? undefined : rawText.slice(0, 4000),
}, null, 2)}\n`);

const winnerRun = verdict?.winner === 'A' ? asA : verdict?.winner === 'B' ? asB : null;
console.log(JSON.stringify({
  caseId: left.manifest.caseId,
  winner: verdict?.winner ?? 'unparsed',
  winnerCondition: winnerRun ? winnerRun.manifest.condition : null,
  scores: verdict?.scores ?? null,
  written: path.relative(suiteRoot, outPath),
}, null, 2));
