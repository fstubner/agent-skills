#!/usr/bin/env node
// Aggregates the skill-invocation logs written by scripts/log-skill-invocation.mjs.
//
// alpha.3 shipped the writer and no reader, which made the data collectible
// but not answerable. The question this exists to answer is the one the evals
// left open: unprompted invocation measured at ~0% across two runs, so the
// useful output is not "which skills are popular" but "which skills have NEVER
// fired". That requires cross-referencing registry.json — a log alone can only
// show what did happen, never what didn't.
//
// Reports INVOCATION only. Whether a skill improved the work is a different
// question needing the forced-exposure A/B protocol in eval/ — this file
// deliberately makes no claim about efficacy, because a usage count that reads
// as an efficacy signal is worse than no number at all.
//
// Usage:
//   node scripts/skill-usage.mjs [--log <path>]... [--json] [--root <dir>]
//
// Default log: ~/.claude/agent-skills-telemetry/invocations.jsonl — one
// user-level file for all projects (rows carry {project, cwd}), matching
// where log-skill-invocation.mjs writes. AGENT_SKILLS_TELEMETRY_DIR
// overrides the directory, and --log overrides the file outright.

import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const DEFAULT_LOG = path.join(
  process.env.AGENT_SKILLS_TELEMETRY_DIR || path.join(os.homedir(), '.claude', 'agent-skills-telemetry'),
  'invocations.jsonl',
);

function parseArgs(argv) {
  const out = { logs: [], json: false, root: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--log') { const v = argv[++i]; if (v) out.logs.push(v); }
    else if (a === '--json') out.json = true;
    else if (a === '--root') out.root = argv[++i];
    else if (a === '--help' || a === '-h') out.help = true;
  }
  return out;
}

function readLog(file) {
  // A missing log is the NORMAL state before anything has been invoked, not an
  // error. Treating it as one would make the first run of this script look
  // like a failure rather than the honest answer "no data yet".
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    return { rows: [], missing: true, malformed: 0 };
  }
  const rows = [];
  let malformed = 0;
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    try {
      rows.push(JSON.parse(line));
    } catch {
      // Counted, not silently dropped: a partial write (two hooks racing on
      // one file) should be visible in the output, not quietly reduce the
      // denominator this whole script exists to make trustworthy.
      malformed++;
    }
  }
  return { rows, missing: false, malformed };
}

function registrySkillIds(root) {
  try {
    const reg = JSON.parse(fs.readFileSync(path.join(root, 'registry.json'), 'utf8'));
    return (reg.skills || []).map((s) => s.id).filter(Boolean).sort();
  } catch {
    return null;
  }
}

function tally(rows, key) {
  const counts = new Map();
  for (const r of rows) {
    const k = r[key] == null ? '(unknown)' : String(r[key]);
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log('Usage: node scripts/skill-usage.mjs [--log <path>]... [--json] [--root <dir>]');
    console.log('Default log: ' + DEFAULT_LOG);
    process.exit(0);
  }

  const root = args.root || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const logs = args.logs.length > 0 ? args.logs : [DEFAULT_LOG];

  let rows = [];
  let malformed = 0;
  const missing = [];
  for (const l of logs) {
    const res = readLog(path.isAbsolute(l) ? l : path.resolve(l));
    if (res.missing) missing.push(l);
    rows = rows.concat(res.rows);
    malformed += res.malformed;
  }

  const skillIds = registrySkillIds(root);
  const bySkill = tally(rows, 'skill');
  const invoked = new Set(rows.map((r) => r.skill).filter(Boolean));
  const neverInvoked = skillIds ? skillIds.filter((id) => !invoked.has(id)) : null;
  const sessions = new Set(rows.map((r) => r.session).filter(Boolean));
  const times = rows.map((r) => r.at).filter(Boolean).sort();

  const summary = {
    totalInvocations: rows.length,
    distinctSkills: invoked.size,
    registrySkills: skillIds ? skillIds.length : null,
    neverInvoked,
    sessions: sessions.size,
    firstAt: times[0] || null,
    lastAt: times[times.length - 1] || null,
    bySkill: Object.fromEntries(bySkill),
    byProject: Object.fromEntries(tally(rows, 'project')),
    malformedLines: malformed,
    missingLogs: missing,
  };

  if (args.json) {
    console.log(JSON.stringify(summary, null, 2));
    process.exit(0);
  }

  if (rows.length === 0) {
    console.log('No skill invocations recorded yet.');
    for (const m of missing) console.log(`  (no log at ${m})`);
    console.log('\nThe telemetry hook ships with the plugin and writes on the first');
    console.log('Skill tool call. If this stays empty while you are using the suite,');
    console.log('that is itself the finding — see README on invocation vs efficacy.');
    if (skillIds) console.log(`\n${skillIds.length} skills registered, 0 ever invoked.`);
    process.exit(0);
  }

  console.log(`Skill invocations: ${rows.length} across ${sessions.size} session(s)`);
  console.log(`Window: ${summary.firstAt} .. ${summary.lastAt}`);
  if (malformed > 0) console.log(`Malformed lines skipped: ${malformed}`);
  console.log('');

  const width = Math.max(...bySkill.map(([s]) => s.length), 5);
  console.log('BY SKILL');
  for (const [skill, n] of bySkill) {
    const pct = ((n / rows.length) * 100).toFixed(1).padStart(5);
    console.log(`  ${skill.padEnd(width)}  ${String(n).padStart(4)}  ${pct}%`);
  }

  const byProject = tally(rows, 'project');
  if (byProject.length > 1) {
    console.log('\nBY PROJECT');
    const pw = Math.max(...byProject.map(([p]) => p.length), 7);
    for (const [proj, n] of byProject) console.log(`  ${proj.padEnd(pw)}  ${String(n).padStart(4)}`);
  }

  if (neverInvoked) {
    console.log(`\nNEVER INVOKED (${neverInvoked.length}/${skillIds.length})`);
    if (neverInvoked.length === 0) console.log('  (none — every registered skill has fired at least once)');
    else for (const id of neverInvoked) console.log(`  ${id}`);
  } else {
    console.log('\n(registry.json not readable from --root; cannot list never-invoked skills)');
  }
  process.exit(0);
}

main();
