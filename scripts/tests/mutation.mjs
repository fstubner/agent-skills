import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  root, registry, read, expect, runNode, walk, pathToFileUrl,
  tmpBase, runFixture, assertFixture, ARCH, BACKEND, FRONTEND, ACCEPT,
} from './harness.mjs';

// ---------- 13. Mutation-killing checks ----------
// An external mutation audit ran 15 substantive mutations against this suite —
// thresholds moved, rule sets emptied, fail-closed policy inverted, drift
// detection disabled — and ALL 15 survived green. The fixtures pinned "a
// fixture exists for this line", not "this line is correct": every threshold
// was a free parameter over a huge range, because each fixture sat far from the
// boundary it was supposed to defend.
//
// Each block below is designed to DIE if the specific constant or branch it
// covers is changed. Where a threshold is involved, the values bracket it.
{
  const { hasHeading } = await import(pathToFileUrl(path.join(root, 'core', 'lib', 'report.cjs')));

  // hasHeading: the suite carried comments claiming to have killed v0.4's
  // "bare mention of the word satisfies the section" vacuity. It hadn't — the
  // block fixtures simply OMIT the word entirely, so they cannot distinguish a
  // prose mention from a real heading, and hasHeading could be reduced to a
  // substring match with every test still green.
  expect('hasHeading: a prose mention is NOT a heading',
    hasHeading('We take trust seriously and discuss Trust throughout.', 'Trust') === false);
  // These two are the ones that actually kill the vacuity mutant. A mid-sentence
  // mention is still rejected when the hash requirement is dropped but leading
  // whitespace is still required, so it does NOT discriminate on its own — the
  // word has to appear at the very start of a line, and indented, to force both
  // the `#{1,6}` and the `\s+` to be load-bearing.
  expect('hasHeading: a line STARTING with the word is not a heading',
    hasHeading('Trust is important to us.\n', 'Trust') === false);
  expect('hasHeading: an indented mention is not a heading',
    hasHeading('    Trust matters here.\n', 'Trust') === false);
  expect('hasHeading: a real heading is found', hasHeading('## Trust\n\nbody', 'Trust') === true);
  expect('hasHeading: requires a space after the hashes', hasHeading('##Trust', 'Trust') === false);
  expect('hasHeading: a longer word is not a match', hasHeading('## Trustworthy', 'Trust') === false);
  expect('hasHeading: regex metacharacters in the name are literal',
    hasHeading('## Totally unrelated heading', '.*') === false);

  // Contrast: bracket 4.5:1 tightly. The existing fixtures sit at 1.61 and
  // ~10.3, leaving the threshold free anywhere between.
  const { contrastRatio } = await import(pathToFileUrl(path.join(root, 'frontend', 'scripts', 'check-frontend.js')));
  const justBelow = contrastRatio('#777777', '#ffffff'); // 4.478
  const justAbove = contrastRatio('#767676', '#ffffff'); // 4.542
  expect('contrast: #777777 on white is just BELOW 4.5', justBelow < 4.5 && justBelow > 4.4, String(justBelow));
  expect('contrast: #767676 on white is just ABOVE 4.5', justAbove > 4.5 && justAbove < 4.6, String(justAbove));

  const tokenProj = (tokens) => {
    const p = fs.mkdtempSync(path.join(tmpBase, 'tokens-'));
    fs.mkdirSync(path.join(p, 'src'), { recursive: true });
    fs.writeFileSync(path.join(p, 'package.json'), '{"dependencies":{"react":"^18.0.0"}}\n');
    fs.writeFileSync(path.join(p, 'src', 'App.jsx'), 'export default () => null;\n');
    fs.writeFileSync(path.join(p, 'design-tokens.json'), JSON.stringify(tokens));
    return p;
  };
  const contrastStatus = (tokens) => {
    const r = runNode(path.join(root, ...FRONTEND.split('/')), ['--root', tokenProj(tokens), '--no-write']);
    try { return JSON.parse(r.stdout).checks.find((c) => c.id === 'F-tokens-contrast')?.status; }
    catch { return 'unparseable'; }
  };
  expect('contrast: 4.48:1 fails (just under the WCAG AA threshold)',
    contrastStatus({ 'text-main': '#777777', 'surface-base': '#ffffff' }) === 'fail');
  expect('contrast: 4.60:1 passes (just over the WCAG AA threshold)',
    contrastStatus({ 'text-main': '#767676', 'surface-base': '#ffffff' }) === 'pass');

  // Nesting depth and file size: bracket both thresholds exactly.
  const SMELLS = path.join(root, 'code-smells', 'scripts', 'check-smells.js');
  const smellsStatus = (id, files) => {
    const p = fs.mkdtempSync(path.join(tmpBase, 'smells-'));
    for (const [rel, content] of Object.entries(files)) fs.writeFileSync(path.join(p, rel), content);
    const r = runNode(SMELLS, ['--root', p]);
    try { return JSON.parse(r.stdout).checks.find((c) => c.id === id)?.status; } catch { return 'unparseable'; }
  };
  const nested = (depth) => {
    let s = '';
    for (let i = 0; i < depth; i++) s += `${'  '.repeat(i)}if (x${i}) {\n`;
    for (let i = depth - 1; i >= 0; i--) s += `${'  '.repeat(i)}}\n`;
    return s;
  };
  expect('nesting: depth 5 passes (at the limit)', smellsStatus('S-deep-nesting', { 'a.js': nested(5) }) === 'pass');
  expect('nesting: depth 6 fails (one over)', smellsStatus('S-deep-nesting', { 'a.js': nested(6) }) === 'fail');
  expect('file size: 400 lines passes (at the limit)',
    smellsStatus('S-large-file', { 'a.js': 'const a = 1;\n'.repeat(400) }) === 'pass');
  expect('file size: 401 lines fails (one over)',
    smellsStatus('S-large-file', { 'a.js': 'const a = 1;\n'.repeat(401) }) === 'fail');

  // isServerOnlyPath: every existing secret fixture puts the secret in a
  // client path, so the deny-list could be replaced with `return false` and
  // stay green. A secret under server/ must NOT be reported.
  const gl = spawnSync('gitleaks', ['version'], { encoding: 'utf8' });
  if (gl.error || gl.status !== 0) {
    console.log('skip  isServerOnlyPath discrimination test: gitleaks not installed');
  } else {
    const secretIn = (rel) => {
      const p = fs.mkdtempSync(path.join(tmpBase, 'serveronly-'));
      fs.mkdirSync(path.join(p, path.dirname(rel)), { recursive: true });
      fs.writeFileSync(path.join(p, 'package.json'), '{"dependencies":{"express":"^4.0.0"}}\n');
      fs.writeFileSync(path.join(p, 'server.js'), 'module.exports = {};\n');
      fs.writeFileSync(path.join(p, rel), `const t = "${'ghp_' + '1234567890abcdefghij1234567890ABCDEF'}";\n`);
      const r = runNode(path.join(root, ...BACKEND.split('/')), ['--root', p, '--no-write']);
      try { return JSON.parse(r.stdout).checks.find((c) => c.id === 'B-client-secrets')?.status; }
      catch { return 'unparseable'; }
    };
    expect('server-only: a secret in src/ IS reported', secretIn('src/config.js') === 'fail');
    expect('server-only: a secret under server/ is NOT reported', secretIn('server/config.js') === 'pass');
  }
}

// ---------- 13b. gen-contract drift detection must be able to fail ----------
// --check was only ever asserted in the passing direction, so its exit(1)
// branch could be deleted and CI would still be green while the contract
// silently drifted from registry.json.
{
  const copy = fs.mkdtempSync(path.join(tmpBase, 'drift-'));
  fs.cpSync(path.join(root, 'core'), path.join(copy, 'core'), { recursive: true });
  fs.cpSync(path.join(root, 'scripts'), path.join(copy, 'scripts'), { recursive: true });
  fs.cpSync(path.join(root, 'docs'), path.join(copy, 'docs'), { recursive: true });
  const reg = JSON.parse(read(path.join(root, 'registry.json')));
  reg.skills.push({ id: 'a-skill-not-in-the-contract', role: 'deliberate drift' });
  fs.writeFileSync(path.join(copy, 'registry.json'), JSON.stringify(reg, null, 2));
  const r = runNode(path.join(copy, 'scripts', 'gen-contract.mjs'), ['--check']);
  expect('gen-contract --check FAILS when the contract drifts from registry.json',
    r.status !== 0, `exit ${r.status}`);
}

// ---------- 13c. B-session-cookie: name scoping and flag detection ----------
// The fixture pair proves the check fires end to end on Express. These pin
// the parts a fixture can't reach cheaply: the other ecosystems' call
// syntax, the deliberate exclusion of CSRF and preference cookies, and
// flags written but set to false.
{
  const { cookieFindingsIn } = await import(
    pathToFileUrl(path.join(root, 'backend-engineering', 'scripts', 'check-backend.js')));
  const flagged = (src) => cookieFindingsIn('f.x', src).length > 0;

  expect('cookie: Flask set_cookie without flags is flagged',
    flagged('resp.set_cookie("session", v)'));
  expect('cookie: Flask set_cookie with all three passes',
    !flagged('resp.set_cookie("session", v, httponly=True, secure=True, samesite="Lax")'));
  expect('cookie: Go http.SetCookie with all three passes',
    !flagged('http.SetCookie(w, &http.Cookie{Name: "sid", HttpOnly: true, Secure: true, SameSite: http.SameSiteLaxMode})'));
  expect('cookie: Go http.SetCookie missing Secure is flagged',
    flagged('http.SetCookie(w, &http.Cookie{Name: "sid", HttpOnly: true, SameSite: http.SameSiteLaxMode})'));
  expect('cookie: Next.js cookies().set is recognized',
    flagged('cookies().set("auth_token", t, { httpOnly: true })'));

  // Scoping — these must NOT be flagged, or the check becomes noise.
  expect('cookie: a preference cookie is not session material',
    !flagged("res.cookie('theme', 'dark', { maxAge: 1000 })"));
  expect('cookie: a double-submit CSRF cookie must stay JS-readable',
    !flagged("res.cookie('csrf_token', t, { secure: true, sameSite: 'lax' })"));

  // A flag named but disabled is worse than absent, not better.
  expect('cookie: httpOnly:false counts as missing',
    flagged("res.cookie('sid', s, { httpOnly: false, secure: true, sameSite: 'lax' })"));
  expect('cookie: sameSite:"none" counts as missing',
    flagged("res.cookie('sid', s, { httpOnly: true, secure: true, sameSite: 'none' })"));
}
