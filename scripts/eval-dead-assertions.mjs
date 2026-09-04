#!/usr/bin/env node
// Every assertion in the measured programme, scored against every archived
// bundle by the CURRENT grader, and asked one question: does it ever move?
//
// An assertion no run in any arm has ever satisfied does not bias a delta —
// it is zero on both sides — but it makes the programme smaller than its case
// files claim, and it is usually a defect rather than a hard question. Run on
// 2026-09-04 this found 28 such assertions in product-acceptance and 7 in
// engineering-assessment, and among them: a case whose named verdict no run
// has ever returned because the fixture does not warrant it, and an assertion
// requiring a command the claude-code arm has no permission to execute.
//
// The mirror case matters too. An assertion that always passes may be a true
// negative or an instrument that cannot fail; the difference is a judgement
// about its subject, which is why integrity guards are excluded from that
// column rather than counted as findings.
//
// Slow — it spawns every grader once per bundle. It reads nothing but
// archived output and spends no runs.
//
// usage: node scripts/eval-dead-assertions.mjs
import fs from 'fs';
import { execFileSync } from 'child_process';

const ev = JSON.parse(fs.readFileSync('eval/evidence.json', 'utf8'));
const attr = JSON.parse(fs.readFileSync('eval/assertion-attribution.json', 'utf8'));
const measured = new Set(ev.measuredSkills);

const rows = [];
for (const f of fs.readdirSync('eval/cases-v2').filter((x) => x.endsWith('.json'))) {
  const c = JSON.parse(fs.readFileSync('eval/cases-v2/' + f, 'utf8'));
  if (!measured.has(c.skill)) continue;
  let out;
  try {
    out = JSON.parse(execFileSync('node', ['scripts/eval-regrade.mjs', '--case', c.id, '--json'],
      { encoding: 'utf8', maxBuffer: 2e8 }));
  } catch { continue; }
  if (out.scored < 6) continue;
  for (const t of out.table) {
    rows.push({
      skill: c.skill, caseId: c.id, id: t.id,
      cls: attr.cases[c.id]?.assertions?.[t.id] ?? '?',
      verdict: t.verdict, scored: out.scored,
    });
  }
}

for (const skill of ev.measuredSkills) {
  const mine = rows.filter((r) => r.skill === skill);
  if (!mine.length) continue;
  const dead = mine.filter((r) => r.verdict);
  console.log(`\n==== ${skill}: ${mine.length} assertions scored, ${dead.length} never move`);
  const never = mine.filter((r) => r.verdict === 'never passes');
  if (never.length) {
    console.log(`  NEVER PASSES — no run in any arm has ever satisfied these (${never.length}):`);
    for (const r of never) console.log(`    [${r.cls.padEnd(15)}] ${r.caseId} :: ${r.id}`);
  }
  const always = mine.filter((r) => r.verdict === 'ALWAYS PASSES' && r.cls !== 'integrity-guard');
  if (always.length) {
    console.log(`  always passes, excluding integrity guards (${always.length}):`);
    for (const r of always) console.log(`    [${r.cls.padEnd(15)}] ${r.caseId} :: ${r.id}`);
  }
}
