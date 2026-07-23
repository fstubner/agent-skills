#!/usr/bin/env node
'use strict';
// Frontend gate: one framework, one icon system, and token contrast when a
// token file exists. Taste stays in the skill; this measures what a regex
// and WCAG math can actually measure.
//
// Usage: node check-frontend.js --root <dir> [--strict] [--out <file>] [--no-write]

const fs = require('fs');
const path = require('path');
const { corePaths } = require('./resolve-core.cjs');
const core = corePaths();
const { parseArgs } = require(path.join(core.lib, 'args.cjs'));
const { classify } = require(path.join(core.lib, 'classify.cjs'));
const { check, runCli } = require(path.join(core.lib, 'report.cjs'));
const registry = require(core.registry);

const FRAMEWORKS = ['react', 'vue', 'svelte', '@angular/core', 'solid-js'];
const ICON_DEPS = ['lucide-react', 'lucide', '@heroicons/react', 'react-icons', '@fortawesome/fontawesome-free', 'feather-icons', '@tabler/icons-react'];

// --- WCAG contrast math ---
function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
}
function relLuminance([r, g, b]) {
  const lin = [r, g, b].map((v) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}
function contrastRatio(fgHex, bgHex) {
  const fg = hexToRgb(fgHex);
  const bg = hexToRgb(bgHex);
  if (!fg || !bg) return null;
  const [l1, l2] = [relLuminance(fg), relLuminance(bg)].sort((a, b) => b - a);
  return (l1 + 0.05) / (l2 + 0.05);
}

function flattenTokens(obj, out = {}) {
  for (const [k, v] of Object.entries(obj || {})) {
    if (typeof v === 'string') out[k] = v;
    else if (v && typeof v === 'object') flattenTokens(v, out);
  }
  return out;
}

function run(root) {
  const cls = classify(root);
  const checks = [];

  if (!cls.frontendPresent) {
    checks.push(check('F-scope', 'pass', 'no frontend detected; frontend gate not required'));
    return checks;
  }

  // One framework.
  if (!cls.pkg) {
    checks.push(check('F-dual-framework', 'not_evaluated', 'no package.json readable'));
  } else {
    const found = FRAMEWORKS.filter((d) => d in cls.deps);
    checks.push(found.length > 1
      ? check('F-dual-framework', 'fail', `multiple frameworks in dependencies: ${found.join(', ')}`)
      : check('F-dual-framework', 'pass', found[0] ? `framework: ${found[0]}` : 'no framework dependency'));
  }

  // One icon system (deps + CDN link tags in html).
  const iconDeps = ICON_DEPS.filter((d) => d in cls.deps);
  let cdnIcons = 0;
  for (let i = 0; i < cls.files.length; i++) {
    if (!cls.rel[i].endsWith('.html')) continue;
    let text;
    try { text = fs.readFileSync(cls.files[i], 'utf8'); } catch { continue; }
    if (/font-?awesome|material-icons/i.test(text)) cdnIcons++;
  }
  const iconSystems = iconDeps.length + (cdnIcons > 0 ? 1 : 0);
  checks.push(iconSystems > 1
    ? check('F-dual-icons', 'fail', `multiple icon systems: ${iconDeps.join(', ')}${cdnIcons ? ' + CDN icon stylesheet' : ''}`)
    : check('F-dual-icons', 'pass'));

  // Token contrast. Fail-closed rules: token file present but required text
  // tokens missing => FAIL (v0.4 printed "All pairs pass" on zero pairs);
  // no token file at all => not_evaluated, which caps the verdict at
  // CONDITIONAL rather than silently passing.
  const tokensPath = path.join(root, 'design-tokens.json');
  if (!fs.existsSync(tokensPath)) {
    checks.push(check('F-tokens-contrast', 'not_evaluated',
      'no design-tokens.json; lock the design step or add tokens to evaluate contrast'));
    return checks;
  }
  let tokens;
  try {
    tokens = flattenTokens(JSON.parse(fs.readFileSync(tokensPath, 'utf8')));
  } catch (e) {
    checks.push(check('F-tokens-contrast', 'fail', `design-tokens.json is not valid JSON: ${e.message}`));
    return checks;
  }
  const required = ['text-main', 'surface-base'];
  const missing = required.filter((k) => !(k in tokens));
  if (missing.length > 0) {
    checks.push(check('F-tokens-contrast', 'fail', `design-tokens.json missing required tokens: ${missing.join(', ')}`));
    return checks;
  }
  const pairs = [['text-main', 'surface-base']];
  if ('text-muted' in tokens) pairs.push(['text-muted', 'surface-base']);
  const failing = [];
  let evaluated = 0;
  for (const [fgKey, bgKey] of pairs) {
    const ratio = contrastRatio(tokens[fgKey], tokens[bgKey]);
    if (ratio === null) {
      failing.push(`${fgKey}/${bgKey}: unparseable color`);
      continue;
    }
    evaluated++;
    if (ratio < 4.5) failing.push(`${fgKey}/${bgKey}: ${ratio.toFixed(2)} < 4.5`);
  }
  checks.push(failing.length > 0
    ? check('F-tokens-contrast', 'fail', failing.join('; '))
    : check('F-tokens-contrast', 'pass', `${evaluated} pair(s) >= 4.5:1`));

  return checks;
}

module.exports = { run };

if (require.main === module) {
  runCli({
    skill: 'frontend',
    reportFile: 'frontend-report.json',
    evidenceDir: registry.evidenceDir,
    runFn: run,
    argv: process.argv.slice(2),
    parseArgs,
  });
}
