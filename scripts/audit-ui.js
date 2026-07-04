#!/usr/bin/env node
// Lightweight, scoped heuristics that flag common UI defects in a single file.
// Usage: node audit-ui.js <file> [<file> ...]
//
// IMPORTANT: these are advisory heuristics, not a parser. A clean pass is not
// proof of quality, and a finding is not always a real problem. Always exits 0
// (contrast is the only hard gate, via check-contrast.js). Use the output as a
// prompt to think, not a wall.

'use strict';

const fs = require('fs');
const path = require('path');

const SPACING_PROPS = /\b(padding|margin|gap|border-radius|font-size|row-gap|column-gap)\b\s*:\s*([^;{}\n]*)/gi;
const HEX = /#[0-9a-fA-F]{3,8}\b/;
const TW_ARBITRARY_PX = /\b[a-z-]+-\[\s*-?\d*\.?\d+px\s*\]/g; // e.g. mt-[13px]
const CLICK_ON_NONINTERACTIVE = /<(div|span)\b[^>]*\b(onClick|on:click|v-on:click|@click|\(click\))/i;
const IMG_TAG = /<img\b/i;

function isPageStylesheet(file) {
  const base = path.basename(file).toLowerCase();
  return base === 'styles.css' || base === 'global.css' || base === 'app.css';
}

function isPageLayoutSelector(line) {
  return /\.(hero|section|episode|subscribe|site-|footer|header|main|page|content|band|grid|list|nav|about|quote)|^(h[1-6]|p|ul|ol|li|figure|blockquote)\b/i.test(line);
}

function isTokenFile(file) {
  const p = file.toLowerCase();
  return /token|theme|\.example\.|design-system/.test(p);
}

// Blank out /* ... */ block comments while preserving line count and offsets, so
// commented-out code doesn't trigger findings and line numbers stay accurate.
function blankBlockComments(raw) {
  let out = '';
  let inBlock = false;
  for (let i = 0; i < raw.length; i++) {
    const two = raw.slice(i, i + 2);
    if (!inBlock && two === '/*') { inBlock = true; out += '  '; i++; continue; }
    if (inBlock && two === '*/') { inBlock = false; out += '  '; i++; continue; }
    const ch = raw[i];
    out += inBlock ? (ch === '\n' ? '\n' : ' ') : ch;
  }
  return out;
}

function auditFile(file) {
  const findings = [];
  let raw;
  try { raw = fs.readFileSync(file, 'utf8'); } catch (e) {
    return [{ sev: 'error', line: 0, msg: `cannot read file: ${e.message}` }];
  }
  const tokenFile = isTokenFile(file);
  const pageSheet = isPageStylesheet(file);
  const cleaned = blankBlockComments(raw);
  const lines = cleaned.split(/\r?\n/);

  lines.forEach((line, idx) => {
    const n = idx + 1;
    const code = line.replace(/\/\/.*$/, ''); // drop trailing line comments (rough)

    // Hardcoded hex colors outside token/custom-property definitions.
    if (!tokenFile && HEX.test(code)) {
      const isCustomPropDef = /^\s*--[\w-]+\s*:/.test(code);
      const usesVar = /var\(\s*--/.test(code);
      if (!isCustomPropDef && !usesVar) {
        findings.push({ sev: 'warn', line: n, msg: `hardcoded hex color \u2014 map to a color token (design-systems.md)` });
      }
    }

    // Raw px in spacing/sizing properties (allow 0 and var()).
    let m;
    SPACING_PROPS.lastIndex = 0;
    while ((m = SPACING_PROPS.exec(code)) !== null) {
      const prop = m[1].toLowerCase();
      const value = m[2];
      if (/\bvar\(/.test(value)) continue;
      const pxNums = value.match(/-?\d*\.?\d+px/g) || [];
      const meaningful = pxNums.filter((v) => parseFloat(v) !== 0);
      if (meaningful.length) {
        const small = meaningful.every((v) => Math.abs(parseFloat(v)) <= (pageSheet ? 4 : 1));
        if (!small) {
          findings.push({ sev: 'warn', line: n, msg: `raw px in "${prop}" (${meaningful.join(', ')}) \u2014 use a space/radius token` });
        }
      }
    }

    // Tailwind arbitrary px values.
    const tw = code.match(TW_ARBITRARY_PX);
    if (tw) {
      findings.push({ sev: 'warn', line: n, msg: `Tailwind arbitrary px value(s): ${tw.join(', ')} \u2014 prefer scale/token utilities` });
    }

    // Component setting its own outer margin (composition smell).
    const marginDecl = code.match(/\bmargin(-top|-right|-bottom|-left)?\s*:\s*([^;{}\n]+)/i);
    if (marginDecl && !(pageSheet && isPageLayoutSelector(code))) {
      const val = marginDecl[2].trim();
      if (!/^(0(px|rem|em)?|auto|0\s+auto)$/i.test(val)) {
        findings.push({ sev: 'info', line: n, msg: `outer margin set on component \u2014 prefer parent layout gap (architecture.md)` });
      }
    }

    // Click handler on a non-interactive element (no keyboard/role for free).
    if (CLICK_ON_NONINTERACTIVE.test(code)) {
      findings.push({ sev: 'warn', line: n, msg: `clickable <div>/<span> \u2014 use a native <button>/<a> (accessibility.md, anti-patterns.md)` });
    }

    // <img> without an alt attribute on the same line (decorative -> alt="").
    if (IMG_TAG.test(code) && !/\balt\s*=/i.test(code)) {
      findings.push({ sev: 'warn', line: n, msg: `<img> without alt \u2014 add descriptive alt, or alt="" if decorative (accessibility.md)` });
    }
  });

  // File-level checks (run on comment-stripped source).
  const hasOutlineNone = /outline\s*:\s*(none|0)\b/i.test(cleaned);
  const hasFocusVisible = /:focus-visible/.test(cleaned);
  if (hasOutlineNone && !hasFocusVisible) {
    findings.push({ sev: 'warn', line: 0, msg: `"outline: none" without a :focus-visible replacement \u2014 keep a visible focus ring (visual-mechanics.md)` });
  }

  const hasOverflow = /overflow(-x|-y)?\s*:\s*(auto|scroll|overlay)\b/i.test(cleaned);
  const hasStaticMask = /mask-image\s*:\s*linear-gradient/i.test(cleaned);
  const hasDynamicOverflow = /data-overflow/.test(cleaned);
  const hasOcclusionCue = /(box-shadow|mask-image|linear-gradient|shadow-overflow)/i.test(cleaned);

  if (hasOverflow && !hasOcclusionCue) {
    findings.push({ sev: 'info', line: 0, msg: `scrollable overflow without an edge cue — add dynamic data-overflow + mask or shadow (visual-mechanics.md)` });
  }
  if (hasOverflow && hasStaticMask && !hasDynamicOverflow) {
    findings.push({ sev: 'warn', line: 0, msg: `static mask-image on scroll container — fade must toggle via data-overflow from scroll position, not always on (visual-mechanics.md)` });
  }
  if (/\.scroll-region[^{]*\{[^}]*mask-image/is.test(cleaned)) {
    findings.push({ sev: 'warn', line: 0, msg: `mask-image on .scroll-region overlaps the scrollbar — use .scroll-region-host overlays (visual-mechanics.md §2)` });
  }

  const stickyBlocks = cleaned.match(/[^{}]+\{[^}]*position\s*:\s*sticky[^}]*\}/gi) || [];
  if (stickyBlocks.some((b) => !/background\s*:/i.test(b))) {
    findings.push({ sev: 'warn', line: 0, msg: `position:sticky without background — content shows through while scrolling (sticky-and-scroll.md)` });
  }

  if (/\.app-shell[^{]*\{[^}]*min-height\s*:\s*100vh/i.test(cleaned)
      && !/\.app-shell[^{]*\{[^}]*height\s*:\s*100dvh/i.test(cleaned)) {
    findings.push({ sev: 'warn', line: 0, msg: `app-shell uses min-height:100vh without height:100dvh — whole page may scroll; viewport-lock shell (app-shell.md §8)` });
  }
  if (/\.app-shell/i.test(cleaned) && !/body[^{]*\{[^}]*overflow\s*:\s*hidden/i.test(cleaned)) {
    findings.push({ sev: 'info', line: 0, msg: `app-shell without body { overflow: hidden } — document scroll may move chrome off-screen (app-shell.md §8)` });
  }

  const importantCount = (cleaned.match(/!important/gi) || []).length;
  if (importantCount > 0) {
    const sev = importantCount > 3 ? 'warn' : 'info';
    findings.push({ sev, line: 0, msg: `${importantCount} !important — prefer fixing specificity/ownership (regression-guardrails.md)` });
  }

  if (/\.(sidebar|sidebar-pane|docs-sidebar|aside-nav)[^{]*\{[^}]*position\s*:\s*sticky/is.test(cleaned)) {
    findings.push({ sev: 'warn', line: 0, msg: `position:sticky on shell sidebar/pane — keeps full height in flow and can push main content down; use viewport lock or fixed column (regression-guardrails.md)` });
  }

  const broadGlobal = (cleaned.match(/(?:^|[\s}])(?:body|html)\s+[.#\w][^{]+\{/gi) || []).length;
  if (broadGlobal > 5) {
    findings.push({ sev: 'info', line: 0, msg: `${broadGlobal} body/html descendant rules — cross-surface regression risk; scope by surface (regression-guardrails.md)` });
  }

  // Colored-dot status pattern (::before circle as sole indicator).
  if (/\.status[\s\S]*::before\s*\{[^}]*border-radius\s*:\s*50%|\.status[\s\S]*::before\s*\{[^}]*radius-full/i.test(cleaned)) {
    findings.push({ sev: 'warn', line: 0, msg: `colored-dot status indicator — use icon + text + tinted banner (interaction.md)` });
  }

  // display:flex|grid on a class that uses [hidden] without :not([hidden]) in selector.
  if (/\[hidden\]/i.test(cleaned) && /\.[\w-]+\s*\{[^}]*display\s*:\s*(flex|grid|inline-flex)/i.test(cleaned)
      && !/:not\(\[hidden\]\)/i.test(cleaned)) {
    findings.push({ sev: 'warn', line: 0, msg: `display:flex/grid may override [hidden] — use .classname:not([hidden]) { display: … } (anti-patterns.md)` });
  }

  if (!/@media/i.test(cleaned) && /\.(stat-grid|dashboard-grid|projects-grid|meta-grid|grid-)/i.test(cleaned)) {
    findings.push({ sev: 'info', line: 0, msg: `multi-column grid without @media — add mobile stack or auto-fit/minmax (responsive-design.md)` });
  }
  if (/grid-template-columns\s*:\s*repeat\(\s*3/i.test(cleaned) && !/auto-fit|minmax/i.test(cleaned)) {
    findings.push({ sev: 'warn', line: 0, msg: `fixed 3-column grid — stack or use repeat(auto-fit, minmax(...)) for responsive (responsive-design.md)` });
  }
  if (/\bmin-width\s*:\s*\d{3,}px/i.test(cleaned) && !/@media[\s\S]*max-width/i.test(cleaned)) {
    findings.push({ sev: 'info', line: 0, msg: `large min-width without narrow override — likely horizontal overflow on mobile (responsive-design.md)` });
  }
  if (/\bwidth\s*:\s*\d{3,}px/i.test(cleaned) && !/max-width\s*:\s*100%/i.test(cleaned)) {
    findings.push({ sev: 'info', line: 0, msg: `fixed width on container — prefer max-width + fluid layout (responsive-design.md)` });
  }

  // Inconsistent button min-heights in the same file.
  const btnHeights = [...cleaned.matchAll(/\.btn[^{]*\{[^}]*min-height\s*:\s*([^;}\n]+)/gi)]
    .map((m) => m[1].trim());
  const uniqueHeights = [...new Set(btnHeights)];
  if (uniqueHeights.length > 1) {
    findings.push({ sev: 'info', line: 0, msg: `mixed .btn min-height values (${uniqueHeights.join(', ')}) — one size tier per toolbar (app-shell.md)` });
  }

  return findings;
}

function main() {
  const files = process.argv.slice(2);
  if (!files.length) {
    console.error('Usage: node audit-ui.js <file> [<file> ...]');
    process.exit(1);
  }

  let total = 0;
  for (const file of files) {
    const findings = auditFile(file);
    const rel = path.relative(process.cwd(), file) || file;
    if (!findings.length) {
      console.log(`\n${rel}: no heuristic findings.`);
      continue;
    }
    console.log(`\n${rel}: ${findings.length} finding(s)`);
    for (const f of findings.sort((a, b) => a.line - b.line)) {
      const loc = f.line ? `L${f.line}` : 'file';
      const tag = f.sev.toUpperCase().padEnd(5);
      console.log(`  ${tag} ${loc}: ${f.msg}`);
      total++;
    }
  }
  console.log(`\n${total} total finding(s). Advisory \u2014 fix or justify each. (Contrast is the only hard gate.)\n`);
  process.exit(0);
}

main();
