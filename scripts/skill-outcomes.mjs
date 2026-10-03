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
// Two things this script did NOT do until 2026-10-03, both of which made its
// numbers non-comparable between reports:
//
//   1. It de-duplicates now. A resumed session copies its earlier turns into a
//      new transcript, and a compacted one can repeat a turn inside a single
//      file, so one invocation could be counted several times. The `Skill`
//      tool_use id is minted once by the API and copied verbatim, which makes
//      it the key. In the 2026-08-04..2026-10-03 window this removed 13 of 140
//      rows: 7 across files, 6 within one file.
//   2. It takes a window. Without one, every report covers "everything on disk
//      today", and the store is mutable — resuming an August session in
//      October adds August-dated rows. The 2026-09-02 report's August table
//      could not be reproduced a month later for exactly this reason.
//
// usage: node scripts/skill-outcomes.mjs [--json] [--registry <path>]
//                                        [--strip <regex>] [--projects <path>]
//                                        [--from YYYY-MM-DD] [--to YYYY-MM-DD]
//   --strip     a pattern removed from the start of each project directory name
//               before it is printed, e.g. '^h--projects-private-'; the encoded
//               path prefix is whatever ~/.claude/projects uses on your machine
//   --projects  session store to read instead of ~/.claude/projects
//   --from/--to inclusive bounds on the invocation's own date
import fs from 'fs';
import os from 'os';
import path from 'path';

const argv = process.argv.slice(2);
const asJson = argv.includes('--json');
const flag = (name, dflt) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : dflt;
};
const registryPath = flag('--registry', path.join(import.meta.dirname, '..', 'registry.json'));
const stripArg = argv.indexOf('--strip');
const STRIP = stripArg >= 0 ? new RegExp(argv[stripArg + 1], 'i') : null;
const FROM = flag('--from', '');
const TO = flag('--to', '');
const SUITE = new Set(JSON.parse(fs.readFileSync(registryPath, 'utf8')).skills.map((s) => s.id));
const PROJECTS = flag('--projects', path.join(os.homedir(), '.claude', 'projects'));
// Claude Code names a project's session directory after its path, with every
// non-alphanumeric character turned into "-". Derived from where this checkout
// actually is, so the exclusion holds on any machine; a prefix match also
// covers this repository's worktrees, whose directories extend the name.
const SELF_PROJECT = path.resolve(import.meta.dirname, '..').replace(/[^A-Za-z0-9]/g, '-').toLowerCase();
const EXCLUDED_ELSEWHERE = /Temp-claude|Temp-eval/i;
const isExcluded = (dir) => dir.toLowerCase().startsWith(SELF_PROJECT) || EXCLUDED_ELSEWHERE.test(dir);

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
      skillCalls: parts.filter((c) => c.type === 'tool_use' && c.name === 'Skill')
        .map((c) => ({ skill: skillName(c.input?.skill), id: c.id || '' })),
      isToolResult: parts.some((c) => c.type === 'tool_result'),
      inputs: parts.filter((c) => c.type === 'tool_use').map((c) => JSON.stringify(c.input || {})).join('\n'),
    });
  }
  return turns;
}

// The last real thing the human said before the call, and whether it named
// the skill. "Named" means the slash command or the bare id appears; a request
// like "run acceptance on this" is model-chosen even though it is not subtle.
// The boundaries are character classes rather than \s and \b. With a leading
// \s, three August prompts that said `` `agent-skills:product-acceptance` ``
// or skill "agent-skills:product-acceptance" read as model-chosen, because the
// name was preceded by a backtick or a quote; they are explicit instructions to
// invoke it. With a trailing \b, a prompt naming frontend-design matched the
// skill `frontend`, since \b sits between "d" and "-".
function trigger(turns, i, skill) {
  const named = new RegExp(`(^|[^a-z0-9_-])/?(agent-skills:)?${skill}(?![a-z0-9-])`, 'i');
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
    for (const call of t.skillCalls.filter((c) => SUITE.has(c.skill))) {
      rows.push({
        at: (t.ts || '').slice(0, 10),
        session: path.basename(file, '.jsonl'),
        id: call.id,
        project,
        skill: call.skill,
        ...trigger(turns, i, call.skill),
        ...outcome(turns, i),
      });
    }
  });
  return rows;
}

const found = [];
for (const dir of fs.readdirSync(PROJECTS)) {
  if (isExcluded(dir)) continue;
  const full = path.join(PROJECTS, dir);
  if (!fs.statSync(full).isDirectory()) continue;
  const project = (STRIP ? dir.replace(STRIP, '') : dir).replace(/--claude-worktrees-/, '/');
  for (const f of fs.readdirSync(full).filter((x) => x.endsWith('.jsonl'))) {
    try { found.push(...invocationsIn(path.join(full, f), project)); } catch { /* unreadable session */ }
  }
}
found.sort((a, b) => a.at.localeCompare(b.at));

const inWindow = found.filter((r) => (!FROM || r.at >= FROM) && (!TO || r.at <= TO));
// One row per Skill tool_use id. A transcript shape without ids falls back to
// the tuple that identifies the same call, so an older store still de-duplicates.
const kept = new Map();
let duplicates = 0;
for (const r of inWindow) {
  const key = r.id || `${r.project}|${r.skill}|${r.at}|${r.prompt.slice(0, 120)}`;
  if (kept.has(key)) { duplicates += 1; continue; }
  kept.set(key, r);
}
const rows = [...kept.values()];

if (asJson) {
  console.log(JSON.stringify({
    window: { from: FROM || rows[0]?.at || null, to: TO || rows[rows.length - 1]?.at || null },
    found: inWindow.length,
    duplicatesRemoved: duplicates,
    invocations: rows.length,
    rows,
  }, null, 2));
  process.exit(0);
}

const count = (items, key) => {
  const t = {};
  for (const r of items) t[r[key] || '(none)'] = (t[r[key] || '(none)'] ?? 0) + 1;
  return t;
};
console.log(`Suite-skill invocations in Claude Code sessions: ${rows.length} across ${new Set(rows.map((r) => r.project)).size} projects`);
console.log(`Window: ${FROM || rows[0]?.at} .. ${TO || rows[rows.length - 1]?.at}`);
console.log(`Rows found: ${inWindow.length}; duplicates from resumed or compacted transcripts removed: ${duplicates}\n`);
console.log('BY TRIGGER', count(rows, 'trigger'));
console.log('BY SKILL', count(rows, 'skill'));
console.log('PRODUCT-ACCEPTANCE VERDICTS', count(rows.filter((r) => r.skill === 'product-acceptance'), 'verdict'));
// Per month, because a single total hides the thing the trend is about: on
// 2026-10-03 product-acceptance had 26 invocations in August and none after.
const months = [...new Set(rows.map((r) => r.at.slice(0, 7)))].sort();
console.log('\nBY MONTH');
for (const m of months) {
  const inMonth = rows.filter((r) => r.at.startsWith(m));
  const typed = inMonth.filter((r) => r.trigger === 'user-typed').length;
  console.log(`  ${m}  ${String(inMonth.length).padStart(4)} invocations  ${String(new Set(inMonth.map((r) => r.project)).size).padStart(3)} projects  ${typed} user-typed / ${inMonth.length - typed} model-chosen`);
  console.log(`          ${JSON.stringify(count(inMonth, 'skill'))}`);
}
console.log('\nDATE        PROJECT                  SKILL                   TRIG   VERDICT      PROMPT  ||  NEXT HUMAN TURN');
for (const r of rows) {
  console.log(`${r.at}  ${r.project.slice(0, 24).padEnd(24)} ${r.skill.padEnd(23)} ${r.trigger === 'user-typed' ? 'USER ' : 'model'}  ${(r.verdict || '-').padEnd(12)} ${r.prompt.slice(0, 70)}  ||  ${r.reply.slice(0, 70)}`);
}
