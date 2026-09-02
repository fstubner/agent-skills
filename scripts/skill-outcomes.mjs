#!/usr/bin/env node
// What happened after a suite skill was invoked in a real Claude Code session.
//
// scripts/skill-usage.mjs counts invocations from the telemetry log and
// deliberately says nothing about outcomes. This reads the session transcripts
// themselves and answers the two questions the telemetry cannot:
//
//   1. Who reached for the skill — the human typing its name, or the model
//      choosing it from a plain-language request?
//   2. What came out — for product-acceptance, the verdict; for every skill,
//      the next thing the human typed.
//
// It is field evidence about delivery and about whether findings got acted on.
// It is NOT efficacy evidence: nothing here says what the model would have
// found without the skill. That comparison is eval/'s job.
//
// Reads ~/.claude/projects. Excludes this repository's own sessions and the
// eval harness's temporary workspaces, both of which invoke skills for reasons
// that are not ordinary work.
//
// usage: node scripts/skill-outcomes.mjs [--json] [--registry <path>]
import fs from 'fs';
import os from 'os';
import path from 'path';

const argv = process.argv.slice(2);
const asJson = argv.includes('--json');
const registryArg = argv.indexOf('--registry');
const registryPath = registryArg >= 0 ? argv[registryArg + 1] : path.join(import.meta.dirname, '..', 'registry.json');
const SUITE = new Set(JSON.parse(fs.readFileSync(registryPath, 'utf8')).skills.map((s) => s.id));
const PROJECTS = path.join(os.homedir(), '.claude', 'projects');
const EXCLUDED_PROJECT = /needs-work-agent-skills|Temp-claude|Temp-eval/i;

const textOf = (content) => {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content.filter((c) => c.type === 'text').map((c) => c.text).join('\n');
};
const skillName = (s) => String(s || '').replace(/^agent-skills:/, '');
// A user turn that is not the human speaking: harness notices, the Skill
// tool's own payload (which arrives as a plain user turn), interruptions.
const isNoise = (u) => /^<(system-reminder|task-notification|local-command)/.test(u)
  || /^\[Request interrupted/.test(u)
  || /^(Base directory for this skill|\(Re-invocation of)/.test(u);

function readTurns(file) {
  const turns = [];
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    let o;
    try { o = JSON.parse(line); } catch { continue; }
    if (o.type !== 'user' && o.type !== 'assistant') continue;
    const content = o.message?.content;
    const parts = Array.isArray(content) ? content : [];
    turns.push({
      type: o.type,
      ts: o.timestamp,
      text: textOf(content),
      skills: parts.filter((c) => c.type === 'tool_use' && c.name === 'Skill').map((c) => skillName(c.input?.skill)),
      isToolResult: parts.some((c) => c.type === 'tool_result'),
      inputs: parts.filter((c) => c.type === 'tool_use').map((c) => JSON.stringify(c.input || {})).join('\n'),
    });
  }
  return turns;
}

// The last real thing the human said before the call, and whether it named
// the skill. "Named" means the slash command or the bare id appears; a request
// like "run acceptance on this" is model-chosen even though it is not subtle.
function trigger(turns, i, skill) {
  const named = new RegExp(`(^|\\s|<command-name>)/?(agent-skills:)?${skill}\\b`);
  for (let j = i - 1; j >= 0; j--) {
    const t = turns[j];
    if (t.type !== 'user' || t.isToolResult) continue;
    const u = t.text.trim();
    if (!u || isNoise(u)) continue;
    return { trigger: named.test(u) ? 'user-typed' : 'model-chosen', prompt: u.replace(/\s+/g, ' ') };
  }
  return { trigger: 'model-chosen', prompt: '' };
}

const VERDICT_FORMS = [
  /verdict[^A-Za-z]{0,30}(SHIP|CONDITIONAL|BLOCK)\b/i,
  /\b(SHIP|CONDITIONAL|BLOCK)\b[^\n]{0,40}verdict/i,
  /\\"verdict\\"\s*:\s*\\"(SHIP|CONDITIONAL|BLOCK)\\"/i,
  /"verdict"\s*:\s*"(SHIP|CONDITIONAL|BLOCK)"/i,
];
const verdictIn = (hay) => {
  for (const form of VERDICT_FORMS) {
    const m = form.exec(hay);
    if (m) return m[1].toUpperCase();
  }
  return '';
};

// Verdicts up to the next real human turn (the last one seen wins — a run may
// revise), and that human turn itself.
function outcome(turns, i) {
  let verdict = '';
  for (let j = i + 1; j < turns.length; j++) {
    const t = turns[j];
    if (t.type === 'assistant') verdict = verdictIn(`${t.text}\n${t.inputs}`) || verdict;
    if (t.type !== 'user' || t.isToolResult) continue;
    const u = t.text.trim();
    if (u && !isNoise(u)) return { verdict, reply: u.replace(/\s+/g, ' ') };
  }
  return { verdict, reply: '' };
}

function invocationsIn(file, project) {
  const turns = readTurns(file);
  const rows = [];
  turns.forEach((t, i) => {
    if (t.type !== 'assistant') return;
    for (const skill of t.skills.filter((s) => SUITE.has(s))) {
      rows.push({ at: (t.ts || '').slice(0, 10), project, skill, ...trigger(turns, i, skill), ...outcome(turns, i) });
    }
  });
  return rows;
}

const rows = [];
for (const dir of fs.readdirSync(PROJECTS)) {
  if (EXCLUDED_PROJECT.test(dir)) continue;
  const full = path.join(PROJECTS, dir);
  if (!fs.statSync(full).isDirectory()) continue;
  const project = dir.replace(/^.*needs-work-|^.*eventwall-|^h--projects-private-/i, '').replace(/--claude-worktrees-/, '/');
  for (const f of fs.readdirSync(full).filter((x) => x.endsWith('.jsonl'))) {
    try { rows.push(...invocationsIn(path.join(full, f), project)); } catch { /* unreadable session */ }
  }
}
rows.sort((a, b) => a.at.localeCompare(b.at));

if (asJson) {
  console.log(JSON.stringify(rows, null, 2));
  process.exit(0);
}

const count = (items, key) => {
  const t = {};
  for (const r of items) t[r[key] || '(none)'] = (t[r[key] || '(none)'] ?? 0) + 1;
  return t;
};
console.log(`Suite-skill invocations in Claude Code sessions: ${rows.length} across ${new Set(rows.map((r) => r.project)).size} projects`);
console.log(`Window: ${rows[0]?.at} .. ${rows[rows.length - 1]?.at}\n`);
console.log('BY TRIGGER', count(rows, 'trigger'));
console.log('BY SKILL', count(rows, 'skill'));
console.log('PRODUCT-ACCEPTANCE VERDICTS', count(rows.filter((r) => r.skill === 'product-acceptance'), 'verdict'));
console.log('\nDATE        PROJECT                  SKILL                   TRIG   VERDICT      PROMPT  ||  NEXT HUMAN TURN');
for (const r of rows) {
  console.log(`${r.at}  ${r.project.slice(0, 24).padEnd(24)} ${r.skill.padEnd(23)} ${r.trigger === 'user-typed' ? 'USER ' : 'model'}  ${(r.verdict || '-').padEnd(12)} ${r.prompt.slice(0, 70)}  ||  ${r.reply.slice(0, 70)}`);
}
