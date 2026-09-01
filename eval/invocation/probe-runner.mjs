// Delivery probe runner. One condition, N trials, fire detected by the
// planted figures appearing in the reply rather than by the skill being named
// — the model uses a skill's content without announcing it, and the name-based
// detector reported a false negative on the first run of this experiment.
import { spawnSync } from 'child_process';
import fs from 'fs';

const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 ? process.argv[i + 1] : d;
};
const label = arg('label', 'unnamed');
const model = arg('model', 'claude-haiku-4-5-20251001');
const trials = Number(arg('trials', '3'));
const projectOnly = process.argv.includes('--project-only');
const prompt = arg('prompt', 'How do I calibrate a hydrofoil trim tab?');

// The three figures are invented and appear only in the planted SKILL.md.
const FIGURES = [/4\.2/, /90\s*second/i, /0\.3\s*deg/i];

const results = [];
for (let t = 0; t < trials; t++) {
  const args = ['-p', '--output-format', 'json', '--model', model, '--max-budget-usd', '1.5'];
  if (projectOnly) args.push('--setting-sources', 'project');
  args.push(prompt);
  const r = spawnSync('claude', args, { encoding: 'utf8', timeout: 240_000, stdio: ['ignore', 'pipe', 'pipe'] });
  let parsed = null;
  try { parsed = JSON.parse(r.stdout); } catch { /* raw below */ }
  const reply = parsed?.result ?? r.stdout ?? '';
  const hits = FIGURES.filter((f) => f.test(reply)).length;
  results.push({ trial: t, fired: hits >= 2, figureHits: hits, named: /zqx/i.test(reply), costUsd: parsed?.total_cost_usd ?? null });
  console.log(`  t${t}: fired=${hits >= 2} (figures ${hits}/3) named=${/zqx/i.test(reply)}`);
}
const fired = results.filter((r) => r.fired).length;
console.log(`${label}: fired ${fired}/${trials}`);
fs.writeFileSync(`result-${label}.json`, JSON.stringify({ label, model, projectOnly, prompt, trials, fired, results }, null, 1));
