#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const i = process.argv.indexOf('--root');
const root = i >= 0 ? path.resolve(process.argv[i + 1]) : null;
if (!root || !fs.existsSync(root)) { console.error('usage: node grader.mjs --root <workspace>'); process.exit(2); }
const read = (name) => { try { return fs.readFileSync(path.join(root, name), 'utf8'); } catch { return ''; } };
const original = read('draft.md');
const revised = read('revised.md');
const changes = read('changes.md');
const assertions = [];
const record = (id, pass, evidence) => assertions.push({ id, status: pass ? 'pass' : 'fail', evidence });

const banned = ["here's the thing", 'marks a pivotal moment', 'transformative', 'research suggests', 'robust', 'plays a crucial role', 'in conclusion', 'streamlined', 'underscores the importance', 'harnessing'];
const remaining = banned.filter((term) => revised.toLowerCase().includes(term));
record('patterns-removed', revised.length > 0 && remaining.length === 0, `revisionBytes=${revised.length}; remaining=${remaining.join(',') || 'none'}`);

const protectedLines = [
  'I wrote the first version after the pager woke me at 02:13 last Friday.',
  'It is 43 lines, including the rude comment about YAML.',
  'Mara calls the deploy button “the big red nope button.”'
];
const missingProtected = protectedLines.filter((line) => !revised.split(/\r?\n/).includes(line));
record('voice-preserved', revised.length > 0 && missingProtected.length === 0, `missing byte-identical lines=${missingProtected.length}`);

const originalNumbers = original.match(/\d+(?::\d+)?/g) || [];
const revisedNumbers = revised.match(/\d+(?::\d+)?/g) || [];
const requiredWords = ['Tuesday', 'minutes', 'seconds'];
record('facts-preserved', revised.length > 0 && JSON.stringify(revisedNumbers) === JSON.stringify(originalNumbers) && requiredWords.every((w) => revised.includes(w)), `numbers=${JSON.stringify(revisedNumbers)}; expected=${JSON.stringify(originalNumbers)}`);

const binaryGone = !/(?:does\s+not|doesn't)\s+just\b/i.test(revised);
record('judgment-pattern-fixed', revised.length > 0 && binaryGone && /11 minutes[\s\S]{0,100}74 seconds/i.test(revised), `binaryGone=${binaryGone}; speedClaimPresent=${/11 minutes[\s\S]{0,100}74 seconds/i.test(revised)}`);

const categories = ['throat', 'inflated', 'weasel', 'importance', 'recap', 'binary'];
const named = categories.filter((term) => changes.toLowerCase().includes(term));
const verdict = /(?:written|generated|authored)\s+by\s+(?:an?\s+)?(?:ai|model)|\bai[- ](?:written|generated)\b/i.test(changes);
record('evidence-not-verdict', changes.length > 0 && named.length >= 4 && !verdict, `namedCategories=${named.join(',') || 'none'}; authorshipVerdict=${verdict}`);

console.log(JSON.stringify({ schemaVersion: 2, caseId: 'ai-prose-voice-edit', assertions }, null, 2));
process.exit(assertions.some((a) => a.status === 'fail') ? 1 : 0);
