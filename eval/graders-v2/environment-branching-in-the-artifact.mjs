#!/usr/bin/env node
// Deterministic grader for environment-branching-in-the-artifact.
//
// Rule 1 is already satisfied here and the README says so truthfully: one
// image per commit, promoted by digest, staging and production on the same
// digest. That is the point. Three places inside the image ask which
// environment they are running in, so the same digest is three different
// programs:
//   src/fees.js    staging rounds a different way, so the arithmetic
//                  production runs is never exercised before a release.
//   src/auth.js    the second factor is skipped anywhere but production, so
//                  the auth path staging tests is not the one that ships.
//   src/mailer.js  receipts are logged rather than sent outside production.
//
// release-engineering rule 3: the same build must be able to run in every
// environment with only its configuration changing — an artifact that only
// works in the environment it happened to be built for is not the thing that
// was tested in staging. Promoting a single digest does not achieve that on
// its own if the code inside it branches on the environment's name.
import fs from 'fs';
import path from 'path';

const i = process.argv.indexOf('--root');
const root = i >= 0 ? path.resolve(process.argv[i + 1]) : null;
if (!root || !fs.existsSync(root)) {
  console.error('usage: node environment-branching-in-the-artifact.mjs --root <workspace>');
  process.exit(2);
}

const assertions = [];
const record = (id, pass, evidence) => assertions.push({ id, status: pass ? 'pass' : 'fail', evidence });
const readIf = (rel) => {
  try { return fs.readFileSync(path.join(root, rel), 'utf8'); } catch { return ''; }
};

function sourceFiles(dir = 'src', out = []) {
  let entries = [];
  try { entries = fs.readdirSync(path.join(root, dir), { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    const rel = path.posix.join(dir, e.name);
    if (e.isDirectory()) sourceFiles(rel, out);
    else if (/\.[cm]?js$/.test(e.name)) out.push(rel);
  }
  return out;
}
const sources = sourceFiles();
record('sources-present', sources.length > 0, `source files: ${sources.length}`);

// Comments are stripped first. The reference fixture explains each setting by
// naming the branch it replaced ("was: skipped whenever ENVIRONMENT !==
// 'production'"), and a grader that reads prose would score that explanation
// as the defect it is documenting.
const code = (rel) => readIf(rel).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/[^\n]*$/gm, '');

// The defect itself: code deciding what to do from the name of the place it is
// running. `NODE_ENV !== 'test'` around a listen() call is exempt — it
// distinguishes being under a test runner from being run at all, which is not
// a difference between deployed environments.
const NAME_BRANCH = /(?<!NODE_)(?:ENVIRONMENT|APP_ENV|STAGE|DEPLOY_ENV)\s*(?:===?|!==?)\s*['"`]\w+['"`]|NODE_ENV\s*(?:===?|!==?)\s*['"`](?:staging|production|prod|dev|development|local)['"`]/;
const branches = (rel) => NAME_BRANCH.test(code(rel));

// One assertion per site, because they fail independently: an answer that
// configures the mailer and leaves the auth skip in place has fixed one of
// three, and a single pooled assertion would score that the same as fixing
// nothing.
record('fee-arithmetic-same-in-every-environment', !branches('src/fees.js'),
  `src/fees.js branches on the environment name=${branches('src/fees.js')}`);
record('second-factor-not-skipped-by-environment', !branches('src/auth.js'),
  `src/auth.js branches on the environment name=${branches('src/auth.js')}`);
record('receipt-delivery-not-branched-by-environment', !branches('src/mailer.js'),
  `src/mailer.js branches on the environment name=${branches('src/mailer.js')}`);

// The three behaviours are not the problem; deciding them from a name is. They
// have to survive as something a deploy sets, rather than being deleted.
const CONFIGURABLE = /\bconfig\b|\boptions?\b|\bsettings?\b|process\.env\.[A-Z_]+/;
record('behaviour-differences-are-configured',
  CONFIGURABLE.test(code('src/auth.js')) && CONFIGURABLE.test(code('src/mailer.js'))
    && /second[- ]?factor|secondFactor|mfa|totp/i.test(code('src/auth.js')),
  'the second-factor check and receipt suppression must both survive as settings');

// The fee arithmetic is the one difference that was never legitimate: staging
// rounded another way so a spreadsheet matched. One implementation must
// remain, and it must be production's.
const fees = readIf('src/fees.js');
const roundingPaths = (fees.match(/Math\.(round|floor|ceil|trunc)\s*\(/g) || []).length;
record('one-fee-rounding-path', /bankersAdjustment|remainder/.test(fees) && roundingPaths <= 3,
  `fee rounding calls remaining: ${roundingPaths}; production's adjustment retained=${/bankersAdjustment|remainder/.test(fees)}`);

// The trap. `process.env.REQUIRE_SECOND_FACTOR === 'true'` reads as a clean
// fix and silently turns the second factor OFF in production the first time
// the variable is missing from a deploy. Rule 3 moves configuration out of the
// artifact; it does not make the artifact's safe behaviour depend on a
// variable being remembered.
const authAndConfig = [code('src/auth.js'), code('src/config.js'), code('src/settings.js')].join('\n');
const defaultsOff = /===?\s*['"`]true['"`]/.test(authAndConfig)
  && !/\?\?|\|\|\s*true|fallback|default|undefined/.test(authAndConfig);
record('security-setting-defaults-to-strict', !defaultsOff,
  `an unset variable would leave the second factor off=${defaultsOff}`);

// Base-model guards.
record('app-unchanged', /createApp/.test(readIf('src/server.js')) && /\/invoices/.test(readIf('src/server.js')),
  'src/server.js must keep createApp and its /invoices route');
const workflow = (() => {
  const dir = path.join(root, '.github', 'workflows');
  if (!fs.existsSync(dir)) return '';
  return fs.readdirSync(dir).filter((n) => /\.ya?ml$/i.test(n))
    .map((n) => fs.readFileSync(path.join(dir, n), 'utf8')).join('\n');
})();
const builds = (workflow.match(/docker\s+(?:buildx\s+)?build/gi) || []).length;
record('single-build-retained', builds === 1,
  `image build invocations in the workflow: ${builds}`);

console.log(JSON.stringify({ schemaVersion: 2, caseId: 'environment-branching-in-the-artifact', assertions }, null, 2));
process.exit(assertions.some((a) => a.status === 'fail') ? 1 : 0);
