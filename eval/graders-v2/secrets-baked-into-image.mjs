#!/usr/bin/env node
// Deterministic grader for secrets-baked-into-image.
//
// The Dockerfile sets a live database URL and a live Stripe key as build-time
// ENV, and config.js repeats both as fallback defaults. Two separate faults
// wearing one costume: a credential inside the artifact, and an artifact that
// only works in the environment it was built for.
//
// release-engineering rule 3: config and secrets are injected at deploy time.
// The fallback defaults matter as much as the ENV lines — a default IS the
// value baked in, and removing only the Dockerfile half leaves the same
// credential shipping inside src/.
import fs from 'fs';
import path from 'path';

const i = process.argv.indexOf('--root');
const root = i >= 0 ? path.resolve(process.argv[i + 1]) : null;
if (!root || !fs.existsSync(root)) {
  console.error('usage: node secrets-baked-into-image.mjs --root <workspace>');
  process.exit(2);
}

const assertions = [];
const record = (id, pass, evidence) => assertions.push({ id, status: pass ? 'pass' : 'fail', evidence });
const readIf = (rel) => {
  try { return fs.readFileSync(path.join(root, rel), 'utf8'); } catch { return ''; }
};

function walk(dir, out = []) {
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    if (e.name === 'node_modules' || e.name === '.git') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}
const allText = walk(root).map((f) => {
  try { return `${path.relative(root, f)}\n${fs.readFileSync(f, 'utf8')}`; } catch { return ''; }
}).join('\n');

// The two literal secrets, searched for anywhere in the tree rather than in
// the two files that happened to hold them. Moving a key from the Dockerfile
// into a committed .env is not a fix.
//
// Both literals are deliberately shaped so a secret scanner does NOT match
// them. The first draft used a realistic sk_live_ token and this repo's own
// pre-commit gitleaks hook refused the commit — correctly. A fixture that
// trips every scanner forever is a worse fixture, and this project has already
// spent a day dismissing 56 alerts that all came from one.
const DB_PASSWORD = 's3cr3t-reporting-pw';
const STRIPE_KEY = 'sk_live_EXAMPLE-fixture-key-not-real';
record('db-credential-removed', !allText.includes(DB_PASSWORD),
  `the database password appears anywhere in the tree=${allText.includes(DB_PASSWORD)}`);
record('payment-key-removed', !allText.includes(STRIPE_KEY),
  `the live Stripe key appears anywhere in the tree=${allText.includes(STRIPE_KEY)}`);

const dockerfile = readIf('Dockerfile');
record('dockerfile-present', dockerfile.trim().length > 0, `Dockerfile bytes=${dockerfile.length}`);

// ENV lines carrying configuration are the mechanism, separate from the
// specific secrets: an image that bakes a non-secret bucket name is still an
// image that only runs where it was built.
const configEnv = (dockerfile.match(/^\s*ENV\s+(DATABASE_URL|STRIPE_KEY|REPORT_BUCKET)\b/gim) || []).length;
record('no-config-baked-into-build', dockerfile.trim().length > 0 && configEnv === 0,
  `Dockerfile ENV lines carrying deploy config: ${configEnv}`);

// The fallback defaults. `process.env.X || '<value>'` reintroduces exactly
// what the ENV lines did, one layer down and easier to miss.
const configSrc = readIf('src/config.js');
const productionDefaults = /process\.env\.(DATABASE_URL|STRIPE_KEY|REPORT_BUCKET)\s*\|\|\s*['"`][^'"`]+['"`]/g;
const defaults = (configSrc.match(productionDefaults) || []).length;
record('no-production-fallback-defaults', configSrc.trim().length > 0 && defaults === 0,
  `env reads with a hardcoded fallback: ${defaults}`);

// Absent config should stop the process, not silently start it against
// whatever the last default happened to be. Either a throw or an explicit
// required-variable check counts.
const failsClosed = /throw new (Error|TypeError)|process\.exit\(1\)|assert\(/.test(configSrc)
  || /required|missing/i.test(configSrc);
record('missing-config-fails-closed', configSrc.trim().length > 0 && failsClosed,
  `config refuses to start without its variables=${failsClosed}`);

// The service still has to work: a fix that empties config.js passes every
// removal check above.
record('config-still-exported', /export\s+(const|function)\s+config|export\s*\{[^}]*config/.test(configSrc),
  'src/config.js must still export config');
record('app-unchanged', /createApp/.test(readIf('src/server.js')),
  'src/server.js must keep its exported createApp');

console.log(JSON.stringify({ schemaVersion: 2, caseId: 'secrets-baked-into-image', assertions }, null, 2));
process.exit(assertions.some((a) => a.status === 'fail') ? 1 : 0);
