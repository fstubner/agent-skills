#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
const i = process.argv.indexOf('--root');
const root = i >= 0 ? path.resolve(process.argv[i + 1]) : null;
if (!root || !fs.existsSync(root)) { console.error('usage: node grader.mjs --root <workspace>'); process.exit(2); }
let text = ''; try { text = fs.readFileSync(path.join(root, 'diagnosis.md'), 'utf8'); } catch {}
const low = text.toLowerCase();
const assertions = [];
const record = (id, pass, evidence) => assertions.push({ id, status: pass ? 'pass' : 'fail', evidence });
const causeGroups = [/(campaign|traffic|request)/, /(recommendation|fan.?out|rollout)/, /(database|db).{0,30}(pool|saturat)|(?:pool|saturat).{0,30}(database|db)/, /retr(?:y|ies).{0,40}(amplif|feedback|wors|load)|(?:amplif|feedback).{0,40}retr/];
const causes = causeGroups.map((r) => r.test(low));
record('interacting-causes', text.length > 0 && causes.every(Boolean), `causeGroups=${causes.join(',')}`);
const timestamps = ['09:15', '09:28', '09:45', '09:47', '09:49', '09:52', '10:04', '10:10'].filter((v) => text.includes(v));
const metrics = ['310', '900', '95%', '18%', '340', '60%'].filter((v) => text.includes(v));
record('distinguishing-evidence', timestamps.length >= 2 && metrics.length >= 1, `timestamps=${timestamps.join(',')}; metrics=${metrics.join(',')}`);
const deployMention = /(v184|deploy)/i.test(text);
const ruled = /(v184|deploy)[\s\S]{0,220}(unlikely|not (?:the )?(?:trigger|cause)|rule[ds]? out|downgrade|preceded|timing)|(?:unlikely|rule[ds]? out|not (?:the )?(?:trigger|cause))[\s\S]{0,220}(v184|deploy)/i.test(text);
record('deploy-decoy-ruled-out', deployMention && ruled && /09:(?:15|28)/.test(text), `deployMention=${deployMention}; evidenceBasedRejection=${ruled}`);
const actionSection = (text.match(/(?:first action|immediate action|recommendation|mitigation)[\s\S]{0,500}/i) || [''])[0];
const reversible = /(restore|roll back|rollback|disable|reduce|limit|cap).{0,100}(recommendation|rollout|fan.?out|retr)/i.test(actionSection);
record('safe-first-action', reversible, `reversible loop mitigation=${reversible}`);
const fields = ['lens:', 'chose it because:', 'candidates:', 'distinguishing evidence:', 'ruled out:', 'defensibility:'].map((f) => low.includes(f));
const falsifier = /defensibility:[\s\S]{0,300}(?:wrong|fals|would have to|if .{0,80}(?:not|remain|persist|fail))/i.test(text);
record('auditable-reasoning', fields.every(Boolean) && falsifier, `fields=${fields.join(',')}; falsifier=${falsifier}`);
console.log(JSON.stringify({ schemaVersion: 2, caseId: 'mental-models-latency-loop', assertions }, null, 2));
process.exit(assertions.some((a) => a.status === 'fail') ? 1 : 0);
