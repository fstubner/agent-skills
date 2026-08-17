#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

const i = process.argv.indexOf('--root');
const root = i >= 0 ? path.resolve(process.argv[i + 1]) : null;
if (!root || !fs.existsSync(root)) { console.error('usage: node engineering-assessment-hidden-risks.mjs --root <workspace>'); process.exit(2); }
let report = ''; try { report = fs.readFileSync(path.join(root, 'ASSESSMENT.md'), 'utf8'); } catch {}
const low = report.toLowerCase();
const assertions = [];
const record = (id, pass, evidence) => assertions.push({ id, status: pass ? 'pass' : 'fail', evidence });
const lineOf = (file, needle) => fs.readFileSync(path.join(root, file), 'utf8').split(/\r?\n/).findIndex((line) => line.includes(needle)) + 1;
const citations = [
  ['src/server.js', lineOf('src/server.js', "ADMIN_TOKEN || 'admin'"), /(default|fallback|hard.?coded).{0,80}(admin|credential|token)|(?:admin|credential|token).{0,80}(default|fallback|hard.?coded)/i],
  ['src/files.js', lineOf('src/files.js', 'path.join'), /(path traversal|containment|outside|escape)/i],
  ['migrations/003_remove_audit.sql', 1, /(drop|destructive|data loss)/i]
];
const citationPass = citations.map(([file, line, issue]) => issue.test(report) && new RegExp(file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?:`|\\s|:)*' + line, 'i').test(report));
record('planted-risks-cited', citationPass.every(Boolean), `citationChecks=${citationPass.join(',')}`);

const smoke = /(smoke|tests\/smoke\.js|tests\\smoke\.js)/i.test(report);
const inadequate = /(no assertions|does not (?:exercise|test)|not meaningful|only (?:logs|prints)|false green|zero assertions|inadequate coverage)/i.test(report);
const readmeContrast = /readme/i.test(report) && /(claim|contradict|despite|but)/i.test(report);
record('false-green-detected', smoke && inadequate && readmeContrast, `smoke=${smoke}; inadequate=${inadequate}; readmeContrast=${readmeContrast}`);

const severity = /\b(critical|high|medium|low|info)\b/i.test(report);
const recs = (report.match(/recommend(?:ation|ed)|remediat|replace|validate|reject|remove|backup/gi) || []).length;
const confirmedSplit = /(unconfirmed|requires investigation|suspected)/i.test(report);
record('ranked-actionable-findings', severity && recs >= 3 && confirmedSplit, `severity=${severity}; remediationTerms=${recs}; confirmedSplit=${confirmedSplit}`);

const test = process.platform === 'win32'
  ? spawnSync(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', 'npm test'], { cwd: root, encoding: 'utf8', timeout: 20_000 })
  : spawnSync('npm', ['test'], { cwd: root, encoding: 'utf8', timeout: 20_000 });
const reportsPass = /(npm test|test command)[\s\S]{0,160}(pass|exit.{0,10}0|success)/i.test(report);
record('tooling-evidence', test.status === 0 && reportsPass && inadequate, `actualExit=${test.status}; reportRecordsPass=${reportsPass}; reportQuestionsAdequacy=${inadequate}`);

const gaps = /(coverage gaps|out of scope|not examined|unavailable|could not)/i.test(report);
const production = /(production (?:config|configuration|environment|deployment)|deployment (?:config|controls)|runtime configuration)/i.test(report);
const noAssumption = !/(production (?:is|appears) safe|production always supplies|secure in production)/i.test(low);
record('coverage-honesty', gaps && production && noAssumption, `gaps=${gaps}; productionEvidenceNamed=${production}; noSafetyAssumption=${noAssumption}`);

console.log(JSON.stringify({ schemaVersion: 2, caseId: 'engineering-assessment-hidden-risks', assertions }, null, 2));
process.exit(assertions.some((a) => a.status === 'fail') ? 1 : 0);
