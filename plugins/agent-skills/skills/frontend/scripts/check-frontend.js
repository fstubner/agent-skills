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

const FRAMEWORKS = ['react', 'vue', 'svelte', '@angular/core', 'solid-js', 'preact'];
const ICON_DEPS = ['lucide-react', 'lucide', '@heroicons/react', 'react-icons', '@fortawesome/fontawesome-free', 'feather-icons', '@tabler/icons-react'];

// --- color parsing (hex, rgb()/rgba(), hsl()/hsla()) ---
function hexToRgb(hex) {
  const h = hex.replace('#', '');
  let full = h;
  if (full.length === 3 || full.length === 4) full = full.split('').map((c) => c + c).join('');
  if (!/^[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(full)) return null;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)); // alpha (if any) ignored for contrast
}
function hslToRgb(h, s, l) {
  s /= 100;
  l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let rp;
  let gp;
  let bp;
  if (h < 60) [rp, gp, bp] = [c, x, 0];
  else if (h < 120) [rp, gp, bp] = [x, c, 0];
  else if (h < 180) [rp, gp, bp] = [0, c, x];
  else if (h < 240) [rp, gp, bp] = [0, x, c];
  else if (h < 300) [rp, gp, bp] = [x, 0, c];
  else [rp, gp, bp] = [c, 0, x];
  return [Math.round((rp + m) * 255), Math.round((gp + m) * 255), Math.round((bp + m) * 255)];
}
function parseColor(value) {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  if (v.startsWith('#')) return hexToRgb(v);
  let m = v.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*[\d.]+\s*)?\)$/i);
  if (m) return [Number(m[1]), Number(m[2]), Number(m[3])];
  m = v.match(/^hsla?\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%\s*(?:,\s*[\d.]+\s*)?\)$/i);
  if (m) return hslToRgb(Number(m[1]), Number(m[2]), Number(m[3]));
  return null;
}
function relLuminance([r, g, b]) {
  const lin = [r, g, b].map((v) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}
function contrastRatio(fgValue, bgValue) {
  const fg = parseColor(fgValue);
  const bg = parseColor(bgValue);
  if (!fg || !bg) return null;
  const [l1, l2] = [relLuminance(fg), relLuminance(bg)].sort((a, b) => b - a);
  return (l1 + 0.05) / (l2 + 0.05);
}

// A token file is either flat ({ "text-main": "#111" }) or one level of
// theme grouping ({ light: {...}, dark: {...} }). Each theme is validated
// INDEPENDENTLY — a prior version flattened all nesting into one namespace,
// which silently mixed a dark theme's text color against a light theme's
// surface color (and vice versa), producing both false BLOCKs and false
// passes. Anything nested deeper than one theme level is rejected rather
// than silently flattened.
function tokenSetsFrom(raw) {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('design-tokens.json must be a JSON object');
  }
  const isFlat = Object.values(raw).every((v) => typeof v === 'string');
  if (isFlat) return { default: raw };
  const sets = {};
  for (const [name, value] of Object.entries(raw)) {
    if (value && typeof value === 'object' && !Array.isArray(value) && Object.values(value).every((v) => typeof v === 'string')) {
      sets[name] = value;
    } else {
      throw new Error(
        `unsupported nesting under "${name}" — use a flat token map, or one level of theme ` +
        `grouping (e.g. { "light": {...}, "dark": {...} }); each leaf must be a color string`
      );
    }
  }
  return sets;
}

function run(root) {
  const cls = classify(root, { evidenceDir: registry.evidenceDir });
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
    const text = cls.readFileSafe(i);
    if (text === null) continue;
    if (/font-?awesome|material-icons/i.test(text)) cdnIcons++;
  }
  const iconSystems = iconDeps.length + (cdnIcons > 0 ? 1 : 0);
  checks.push(iconSystems > 1
    ? check('F-dual-icons', 'fail', `multiple icon systems: ${iconDeps.join(', ')}${cdnIcons ? ' + CDN icon stylesheet' : ''}`)
    : check('F-dual-icons', 'pass'));

  // Token contrast. Fail-closed rules: token file present but required text
  // tokens missing => FAIL; unsupported nesting => FAIL; no token file at
  // all => not_evaluated, which caps the verdict at CONDITIONAL rather than
  // silently passing.
  const tokensPath = path.join(root, 'design-tokens.json');
  if (!fs.existsSync(tokensPath)) {
    checks.push(check('F-tokens-contrast', 'not_evaluated',
      'no design-tokens.json; lock the design step or add tokens to evaluate contrast'));
    return checks;
  }
  let tokenSets;
  try {
    tokenSets = tokenSetsFrom(JSON.parse(fs.readFileSync(tokensPath, 'utf8')));
  } catch (e) {
    checks.push(check('F-tokens-contrast', 'fail', `design-tokens.json: ${e.message}`));
    return checks;
  }
  const required = ['text-main', 'surface-base'];
  const failing = [];
  let evaluated = 0;
  for (const [themeName, tokens] of Object.entries(tokenSets)) {
    const label = themeName === 'default' ? '' : `[${themeName}] `;
    const missing = required.filter((k) => !(k in tokens));
    if (missing.length > 0) {
      failing.push(`${label}missing required tokens: ${missing.join(', ')}`);
      continue;
    }
    const pairs = [['text-main', 'surface-base']];
    if ('text-muted' in tokens) pairs.push(['text-muted', 'surface-base']);
    for (const [fgKey, bgKey] of pairs) {
      const ratio = contrastRatio(tokens[fgKey], tokens[bgKey]);
      if (ratio === null) {
        failing.push(`${label}${fgKey}/${bgKey}: unparseable color`);
        continue;
      }
      evaluated++;
      // 4.5:1 on every pair, which is stricter than WCAG for large text
      // (SC 1.4.3 allows 3:1 at 18pt / 14pt bold). A token carries no size —
      // whichever component uses it at 13px decides whether the pair was
      // legible — so the body-text bar is the only safe one to apply here.
      // The measured ratio is reported so a genuine display-only token can be
      // argued as a documented exception rather than by lowering this number.
      if (ratio < 4.5) failing.push(`${label}${fgKey}/${bgKey}: ${ratio.toFixed(2)} < 4.5 (body-text bar; WCAG allows 3:1 only for 18pt+/14pt-bold text)`);
    }
  }
  checks.push(failing.length > 0
    ? check('F-tokens-contrast', 'fail', failing.join('; '))
    : check('F-tokens-contrast', 'pass', `${evaluated} pair(s) >= 4.5:1 across ${Object.keys(tokenSets).length} theme(s)`));

  if (cls.truncated) {
    checks.push(check('F-scan-completeness', 'not_evaluated',
      'file walk hit the safety cap; icon/framework scan may not cover the whole tree'));
  }

  return checks;
}

module.exports = { run, parseColor, contrastRatio, tokenSetsFrom };

if (require.main === module) {
  const artifact = registry.artifacts.find((a) => a.producer === 'frontend' && a.kind === 'report');
  runCli({
    skill: 'frontend',
    reportFile: path.basename(artifact.file),
    evidenceDir: registry.evidenceDir,
    runFn: run,
    argv: process.argv.slice(2),
    parseArgs,
  });
}
