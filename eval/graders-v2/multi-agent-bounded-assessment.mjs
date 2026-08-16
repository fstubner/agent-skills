#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const i = process.argv.indexOf('--root');
const root = i >= 0 ? path.resolve(process.argv[i + 1]) : null;
if (!root || !fs.existsSync(root)) { console.error('usage: node multi-agent-bounded-assessment.mjs --root <workspace>'); process.exit(2); }
let design = null;
let raw = '';
try { raw = fs.readFileSync(path.join(root, 'design.json'), 'utf8'); design = JSON.parse(raw); } catch {}
const low = raw.toLowerCase();
const assertions = [];
const record = (id, pass, evidence) => assertions.push({ id, status: pass ? 'pass' : 'fail', evidence });
const has = (re) => re.test(low);
const valid = design !== null && typeof design === 'object';

const comparison = has(/single.?agent/) && has(/multi.?agent/) && has(/(?:wall.?clock|minutes?|time)/) && has(/tokens?|cost/);
const benefit = has(/parallel(?:ism|ization| execution)|speciali[sz]ation|context isolation/);
record('explicit-architecture-decision', valid && comparison && benefit, `validJson=${valid}; comparison=${comparison}; namedBenefit=${benefit}`);

const manager = has(/manager|coordinator|orchestrator/);
const worker = has(/worker/);
const aggregate = has(/aggregat|consolidat/);
const bounded = has(/(?:max|global)[_ -]?(?:concurr|worker|agent)|concurr.{0,30}(?:12|limit|cap)/);
const badTopology = has(/peer.?network|recursive delegation|unbounded/);
record('bounded-topology', valid && manager && worker && aggregate && bounded && !badTopology, `manager=${manager}; worker=${worker}; aggregate=${aggregate}; bounded=${bounded}; prohibitedTopology=${badTopology}`);

const typed = has(/(?:string|integer|number|boolean|array|object)/) && has(/required/);
const criteria = has(/success[_ -]?criteria/) && has(/failure[_ -]?criteria/);
const perAgentLimits = has(/max[_ -]?tokens|token[_ -]?budget/) && has(/max[_ -]?(?:wall[_ -]?clock|duration|time)|timeout/);
const tools = has(/allowed[_ -]?tools/) && has(/forbidden[_ -]?(?:actions|tools)/);
const escalation = has(/on[_ -]?failure/) && has(/on[_ -]?ambiguity/);
record('complete-contracts', valid && typed && criteria && perAgentLimits && tools && escalation, `typed=${typed}; criteria=${criteria}; limits=${perAgentLimits}; tools=${tools}; escalation=${escalation}`);

const globalLimit = /(?:global|max)[_ -]?(?:concurrency|concurrent_agents|agents)[\s\S]{0,40}(?:12|[1-9]\b)/i.test(raw);
const providerLimit = /provider[\s\S]{0,50}(?:concurrency|concurrent|limit)[\s\S]{0,30}4\b/i.test(raw) || /(?:aws|azure|gcp)[\s\S]{0,40}(?:limit|concurr)[\s\S]{0,20}4\b/i.test(raw);
const depth = has(/(?:max[_ -]?)?delegation[_ -]?depth|depth[_ -]?limit/);
const totalBudget = has(/total[_ -]?(?:token[_ -]?)?budget/) && has(/total[_ -]?(?:wall[_ -]?clock|time|duration)/);
const safety = has(/read.?only/) && has(/human (?:approval|confirmation)|approval[_ -]?(?:gate|required)/) && has(/remediat/);
record('governance-limits', valid && globalLimit && providerLimit && depth && totalBudget && perAgentLimits && safety, `global=${globalLimit}; provider=${providerLimit}; depth=${depth}; totalBudgets=${totalBudget}; perAgent=${perAgentLimits}; safety=${safety}`);

const retry = has(/retry[\s\S]{0,80}(?:once|1\b)/) && has(/backoff/);
const partial = has(/partial/) && has(/timeout/) && has(/continue|unaffected|remaining/);
const trace = has(/trace[_ -]?id/);
const accounting = has(/tokens?[_ -]?used|cost[_ -]?(?:tracking|accounting|used)/) && has(/wall[_ -]?clock|timing|elapsed/);
const validation = has(/(?:validate|validation|quality[_ -]?gate)[\s\S]{0,100}(?:evidence|worker|output)/);
record('recovery-observability', valid && retry && partial && trace && accounting && validation, `retry=${retry}; partial=${partial}; trace=${trace}; accounting=${accounting}; validation=${validation}`);

console.log(JSON.stringify({ schemaVersion: 2, caseId: 'multi-agent-bounded-assessment', assertions }, null, 2));
process.exit(assertions.some((a) => a.status === 'fail') ? 1 : 0);
