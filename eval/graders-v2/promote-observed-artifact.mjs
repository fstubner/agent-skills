#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const rootAt = process.argv.indexOf('--root');
const root = rootAt >= 0 ? path.resolve(process.argv[rootAt + 1]) : null;
if (!root || !fs.existsSync(root)) {
  console.error('usage: node promote-observed-artifact.mjs --root <workspace>');
  process.exit(2);
}
const workflowPath = path.join(root, '.github', 'workflows', 'release.yml');
const workflow = fs.existsSync(workflowPath) ? fs.readFileSync(workflowPath, 'utf8') : '';
const assertions = [];
const record = (id, pass, evidence) => assertions.push({ id, status: pass ? 'pass' : 'fail', evidence });

function parseJobs(source) {
  const lines = source.split(/\r?\n/);
  const jobs = new Map();
  let inJobs = false;
  let current = null;
  for (const line of lines) {
    if (/^jobs:\s*$/.test(line)) { inJobs = true; continue; }
    if (!inJobs) continue;
    const job = line.match(/^  ([A-Za-z0-9_-]+):\s*$/);
    if (job) {
      current = job[1];
      jobs.set(current, { body: '', needs: [] });
      continue;
    }
    if (/^[^ ]/.test(line) && line.trim()) { inJobs = false; current = null; continue; }
    if (!current) continue;
    jobs.get(current).body += `${line}\n`;
    const needs = line.match(/^    needs:\s*(.+?)\s*$/);
    if (needs) jobs.get(current).needs = needs[1].replace(/[\[\]'\"]/g, '').split(',').map((item) => item.trim()).filter(Boolean);
  }
  return jobs;
}

const jobs = parseJobs(workflow);
const ancestors = (name, seen = new Set()) => {
  for (const dependency of jobs.get(name)?.needs || []) {
    if (!seen.has(dependency)) { seen.add(dependency); ancestors(dependency, seen); }
  }
  return seen;
};
const findJob = (pattern) => [...jobs].find(([, job]) => pattern.test(job.body));
const testJob = findJob(/(?:npm\s+test|node\s+--test)/i);
const buildJobs = [...jobs].filter(([, job]) => /scripts\/build\.mjs/i.test(job.body));
const stagePromote = findJob(/scripts\/promote\.mjs[^\n]*--environment\s+staging/i);
const prodPromote = findJob(/scripts\/promote\.mjs[^\n]*--environment\s+production/i);

const gatedTargets = [...buildJobs, stagePromote, prodPromote].filter(Boolean);
const testsGate = Boolean(testJob) && gatedTargets.length >= 3 && gatedTargets.every(([name]) => name === testJob[0] || ancestors(name).has(testJob[0]));
record('tests-gate-release', testsGate, `testJob=${testJob?.[0] || 'none'}; targets=${gatedTargets.map(([name]) => name).join(',') || 'none'}`);

const buildCount = (workflow.match(/scripts\/build\.mjs/g) || []).length;
const imageArgument = (body, environment) => body.match(new RegExp(`scripts/promote\\.mjs[^\\n]*--image\\s+(.+?)\\s+--environment\\s+${environment}`, 'i'))?.[1].trim();
const stageImage = stagePromote ? imageArgument(stagePromote[1].body, 'staging') : null;
const prodImage = prodPromote ? imageArgument(prodPromote[1].body, 'production') : null;
const buildBody = buildJobs[0]?.[1].body || '';
const immutableOutput = /GITHUB_OUTPUT/i.test(buildBody) && /(?:github\.sha|GITHUB_SHA|digest|sha256)/i.test(buildBody);
const outputReference = stageImage && /needs\.[^.]+\.outputs\./i.test(stageImage);
record('single-promoted-artifact', buildCount === 1 && stageImage === prodImage && immutableOutput && outputReference, `buildCount=${buildCount}; stagingImage=${JSON.stringify(stageImage)}; productionImage=${JSON.stringify(prodImage)}; immutableOutput=${immutableOutput}`);

const stagingHealth = findJob(/scripts\/health\.mjs[^\n]*--environment\s+staging/i);
const prodAncestors = prodPromote ? ancestors(prodPromote[0]) : new Set();
const stageBeforeHealth = Boolean(stagingHealth && stagePromote) && (stagingHealth[0] === stagePromote[0] || ancestors(stagingHealth[0]).has(stagePromote[0]));
const stagingGates = stageBeforeHealth && Boolean(prodPromote) && prodAncestors.has(stagingHealth[0]);
record('staging-gates-production', stagingGates, `stagingPromote=${stagePromote?.[0] || 'none'}; stagingHealth=${stagingHealth?.[0] || 'none'}; production=${prodPromote?.[0] || 'none'}`);

const productionHealth = findJob(/scripts\/health\.mjs[^\n]*--environment\s+production/i);
let healthAction = false;
if (productionHealth && prodPromote) {
  const healthAfterPromotion = productionHealth[0] === prodPromote[0]
    ? productionHealth[1].body.search(/scripts\/health\.mjs[^\n]*--environment\s+production/i) > productionHealth[1].body.search(/scripts\/promote\.mjs[^\n]*--environment\s+production/i)
    : ancestors(productionHealth[0]).has(prodPromote[0]);
  healthAction = healthAfterPromotion && !/continue-on-error:\s*true/i.test(productionHealth[1].body);
}
record('production-health-action', Boolean(productionHealth) && healthAction, `productionHealth=${productionHealth?.[0] || 'none'}; definedFailureAction=${healthAction}`);

const releasePath = path.join(root, 'RELEASE.md');
const release = fs.existsSync(releasePath) ? fs.readFileSync(releasePath, 'utf8') : '';
const rollbackCommand = release.match(/(?:node\s+)?scripts\/promote\.mjs\s+--image\s+([^\s]+)\s+--environment\s+production/i);
const rollback = Boolean(rollbackCommand) && /(?:previous|rollback|digest|sha)/i.test(rollbackCommand[1]);
record('executable-rollback', rollback, rollback ? 'literal production promote command found' : 'literal previous-artifact production promote command missing');

console.log(JSON.stringify({ schemaVersion: 2, caseId: 'promote-observed-artifact', assertions }, null, 2));
process.exit(assertions.some((item) => item.status === 'fail') ? 1 : 0);
