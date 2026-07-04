#!/usr/bin/env node
// Generate a semantic design-tokens.json from an archetype + brand color.
// Computes accessible neutrals/text and verifies key contrasts (WCAG AA).
//
// Usage:
//   node init-design-tokens.js --archetype <enterprise|consumer|editorial> --brand "#2563eb" [--shell none|sidebar|topbar] [--mode light|dark] [--out design-tokens.json] [--force]
//
// Non-interactive by design so agents can run it. Refuses to overwrite an
// existing file unless --force is given.

'use strict';

const fs = require('fs');
const path = require('path');
const {
  contrastRatio, adjustLightness, bestTextColor, hexToHsl, hslToHex, parseHex,
} = require('./color-utils');

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) { out[key] = true; }
      else { out[key] = next; i++; }
    }
  }
  return out;
}

// Per-archetype structural + surface presets, for light and dark modes.
const ARCHETYPES = {
  enterprise: {
    density: 'high',
    space: ['4px', '8px', '12px', '16px', '20px', '28px', '40px', '56px'],
    radius: { sm: '2px', md: '4px', lg: '8px' },
    light: { base: '#ffffff', raised: '#f4f6f8', overlay: '#ffffff', borderSubtle: '#d9dee4', borderStrong: '#b6bfc9' },
    dark:  { base: '#161d27', raised: '#1d2532', overlay: '#242d3d', borderSubtle: '#2a3340', borderStrong: '#3a4654' },
    fonts: {
      sans: "'IBM Plex Sans', system-ui, sans-serif",
      mono: "'IBM Plex Mono', ui-monospace, monospace",
      googleFonts:
        'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap',
    },
    chrome: {
      light: { bg: '#111827', textSeed: '#e5e7eb', mutedSeed: '#9ca3af', border: '#1f2937' },
      dark:  { bg: '#07090d', textSeed: '#e5e7eb', mutedSeed: '#9ca3af', border: '#151b24' },
    },
    contentWell: { light: '#e8ecf1', dark: '#0c1018' },
    accentSubtle: { light: '#e4eaf5', dark: '#152238' },
    layout: { sidebarWidth: '13.5rem', headerHeight: '3rem' },
  },
  consumer: {
    density: 'medium',
    space: ['4px', '8px', '12px', '16px', '24px', '32px', '48px', '64px'],
    radius: { sm: '6px', md: '10px', lg: '16px' },
    light: { base: '#ffffff', raised: '#f8fafc', overlay: '#ffffff', borderSubtle: '#e2e8f0', borderStrong: '#cbd5e1' },
    dark:  { base: '#141a24', raised: '#1b2331', overlay: '#222c3d', borderSubtle: '#27303d', borderStrong: '#3a4554' },
    fonts: {
      sans: "'Plus Jakarta Sans', system-ui, sans-serif",
      mono: "'JetBrains Mono', ui-monospace, monospace",
      googleFonts:
        'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap',
    },
    chrome: {
      light: { bg: '#f0f4ff', textSeed: '#0f172a', mutedSeed: '#475569', border: '#dbe4f0' },
      dark:  { bg: '#101620', textSeed: '#e2e8f0', mutedSeed: '#94a3b8', border: '#1c2433' },
    },
    contentWell: { light: '#ffffff', dark: '#0b0f17' },
    accentSubtle: { light: '#eff6ff', dark: '#1a2744' },
    layout: { sidebarWidth: '15rem', headerHeight: '3.5rem' },
  },
  editorial: {
    density: 'low',
    space: ['6px', '12px', '20px', '32px', '48px', '72px', '104px', '144px'],
    radius: { sm: '4px', md: '12px', lg: '24px' },
    light: { base: '#fbfaf7', raised: '#ffffff', overlay: '#ffffff', borderSubtle: '#e7e3da', borderStrong: '#cfc8ba' },
    dark:  { base: '#1d1813', raised: '#26201a', overlay: '#2e261f', borderSubtle: '#332b22', borderStrong: '#473c30' },
    fonts: {
      sans: "'Source Sans 3', system-ui, sans-serif",
      mono: "'IBM Plex Mono', ui-monospace, monospace",
      display: "'Fraunces', Georgia, serif",
      googleFonts:
        'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,700&family=IBM+Plex+Mono:wght@400&family=Source+Sans+3:wght@400;500;600&display=swap',
    },
    chrome: {
      light: { bg: '#f5f0e8', textSeed: '#1c1917', mutedSeed: '#57534e', border: '#e7e0d4' },
      dark:  { bg: '#14110d', textSeed: '#f5f0e8', mutedSeed: '#a8a29e', border: '#292524' },
    },
    contentWell: { light: '#fbfaf7', dark: '#1a1510' },
    accentSubtle: { light: '#f3ebe0', dark: '#2a2218' },
    layout: { sidebarWidth: '16rem', headerHeight: '4rem' },
  },
};

// Nudge a text color toward black/white until it meets the target ratio on bg.
function ensureContrast(textHex, bgHex, target = 4.5) {
  if (contrastRatio(textHex, bgHex) >= target) return textHex;
  const toward = bestTextColor(bgHex);
  const dir = toward === '#ffffff' ? +1 : -1;
  let { h, s, l } = hexToHsl(textHex);
  for (let i = 0; i < 100; i++) {
    l = Math.max(0, Math.min(1, l + dir * 0.02));
    const candidate = hslToHex({ h, s, l });
    if (contrastRatio(candidate, bgHex) >= target) return candidate;
    if (l <= 0 || l >= 1) break;
  }
  return toward;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const archetypeName = String(args.archetype || 'consumer').toLowerCase();
  const mode = String(args.mode || 'light').toLowerCase();
  const brand = String(args.brand || '#2563eb');
  const outPath = path.resolve(process.cwd(), String(args.out || 'design-tokens.json'));
  let shell = args.shell ? String(args.shell).toLowerCase() : null;
  if (!shell) {
    shell = archetypeName === 'editorial' ? 'none' : 'sidebar';
  }
  if (!['none', 'sidebar', 'topbar'].includes(shell)) {
    console.error(`Unknown shell "${shell}". Use: none | sidebar | topbar`);
    process.exit(1);
  }

  const preset = ARCHETYPES[archetypeName];
  if (!preset) {
    console.error(`Unknown archetype "${archetypeName}". Use: enterprise | consumer | editorial`);
    process.exit(1);
  }
  if (mode !== 'light' && mode !== 'dark') {
    console.error(`Unknown mode "${mode}". Use: light | dark`);
    process.exit(1);
  }
  try { parseHex(brand); } catch (e) { console.error(`Error: ${e.message}`); process.exit(1); }

  if (fs.existsSync(outPath) && !args.force) {
    console.error(`Refusing to overwrite existing ${outPath}. Re-run with --force to replace it.`);
    process.exit(1);
  }

  const surfaces = preset[mode];
  const chromePreset = preset.chrome[mode];
  const accent = brand;
  const hoverDelta = mode === 'dark' ? +0.06 : -0.06;
  const accentHover = adjustLightness(accent, hoverDelta);
  const accentActive = adjustLightness(accent, hoverDelta * 2);

  const textMainSeed = mode === 'dark' ? '#e6edf3' : '#0f172a';
  const textMutedSeed = mode === 'dark' ? '#9aa7b4' : '#475569';
  const textMain = ensureContrast(textMainSeed, surfaces.base, 4.5);
  const textMuted = ensureContrast(textMutedSeed, surfaces.base, 4.5);
  const textOnAccent = ensureContrast(bestTextColor(accent), accent, 4.5);

  const chromeText = ensureContrast(chromePreset.textSeed, chromePreset.bg, 4.5);
  const chromeTextMuted = ensureContrast(chromePreset.mutedSeed, chromePreset.bg, 4.5);

  const contentWell = preset.contentWell[mode];
  const accentSubtle = preset.accentSubtle[mode];

  const statusSeeds = mode === 'dark'
    ? { success: '#4ade80', warning: '#fbbf24', danger: '#f87171', info: '#38bdf8' }
    : { success: '#16a34a', warning: '#b45309', danger: '#dc2626', info: '#0284c7' };
  const status = Object.fromEntries(
    Object.entries(statusSeeds).map(([k, v]) => {
      let color = ensureContrast(v, surfaces.base, 4.5);
      color = ensureContrast(color, surfaces.raised, 4.5);
      return [k, color];
    })
  );

  const shadowAlpha = mode === 'dark' ? 0.5 : 0.12;
  const a = (m) => `rgba(0, 0, 0, ${Math.round(shadowAlpha * m * 100) / 100})`;
  const shadowStrength = archetypeName === 'enterprise' ? 0.85 : archetypeName === 'consumer' ? 1 : 0.7;

  const typeTokens = {
    'font-sans': preset.fonts.sans,
    'font-mono': preset.fonts.mono,
    ...(preset.fonts.display ? { 'font-display': preset.fonts.display } : {}),
    'text-xs': archetypeName === 'enterprise' ? '11px' : '12px',
    'text-sm': archetypeName === 'enterprise' ? '13px' : '14px',
    'text-base': '16px',
    'text-lg': archetypeName === 'editorial' ? '20px' : '18px',
    'text-xl': archetypeName === 'editorial' ? '28px' : '24px',
    'text-2xl': archetypeName === 'editorial' ? '40px' : '32px',
    'leading-tight': '1.2',
    'leading-normal': '1.5',
    'leading-loose': archetypeName === 'editorial' ? '1.7' : '1.65',
    'tracking-label': '0.04em',
  };

  const tokens = {
    meta: {
      archetype: archetypeName,
      density: preset.density,
      mode,
      shell,
      generatedBy: 'init-design-tokens.js',
      fontsUrl: preset.fonts.googleFonts,
      visualNote: archetypeName === 'enterprise'
        ? 'Dark chrome + light content well. Use font-mono for data rows.'
        : archetypeName === 'consumer'
          ? 'Tinted chrome + approachable radius. Accent on nav active state.'
          : 'Warm surfaces + display serif for page titles.',
    },
    color: {
      'chrome-bg': chromePreset.bg,
      'chrome-text': chromeText,
      'chrome-text-muted': chromeTextMuted,
      'chrome-border': chromePreset.border,
      'content-well': contentWell,
      'accent-subtle': accentSubtle,
      'surface-base': surfaces.base,
      'surface-raised': surfaces.raised,
      'surface-overlay': surfaces.overlay,
      'text-main': textMain,
      'text-muted': textMuted,
      'text-on-accent': textOnAccent,
      'border-subtle': surfaces.borderSubtle,
      'border-strong': surfaces.borderStrong,
      accent,
      'accent-hover': accentHover,
      'accent-active': accentActive,
      'focus-ring': accent,
      success: status.success,
      warning: status.warning,
      danger: status.danger,
      info: status.info,
    },
    space: Object.fromEntries(preset.space.map((v, i) => [`space-${i + 1}`, v])),
    radius: {
      'radius-sm': preset.radius.sm,
      'radius-md': preset.radius.md,
      'radius-lg': preset.radius.lg,
      'radius-full': '9999px',
    },
    shadow: {
      'shadow-sm': `0 1px 2px ${a(0.5 * shadowStrength)}`,
      'shadow-md': `0 4px 12px ${a(0.85 * shadowStrength)}`,
      'shadow-lg': `0 12px 32px ${a(1.3 * shadowStrength)}`,
      'shadow-overflow': `inset -12px 0 8px -8px ${a(1.25)}`,
    },
    type: typeTokens,
    layout: {
      ...(shell !== 'none' ? { 'sidebar-width': preset.layout.sidebarWidth } : {}),
      'header-height': preset.layout.headerHeight,
      'fade-size': preset.space[3],
      'scrollbar-gutter': '10px',
      'content-max': archetypeName === 'editorial' ? '42rem' : '48rem',
      'z-sticky-local': '5',
      'z-sticky-subnav': '10',
      'z-chrome': '20',
      'z-dropdown': '30',
      'z-modal': '40',
      'z-toast': '50',
    },
    motion: {
      'duration-fast': '120ms',
      'duration-base': '200ms',
      'duration-slow': '320ms',
      'ease-standard': 'cubic-bezier(0.16, 1, 0.3, 1)',
    },
  };

  fs.writeFileSync(outPath, JSON.stringify(tokens, null, 2) + '\n');

  const report = [
    ['text-main on surface-base', textMain, surfaces.base],
    ['text-main on surface-raised', textMain, surfaces.raised],
    ['text-muted on surface-base', textMuted, surfaces.base],
    ['text-muted on surface-raised', textMuted, surfaces.raised],
    ['chrome-text on chrome-bg', chromeText, chromePreset.bg],
    ['chrome-text-muted on chrome-bg', chromeTextMuted, chromePreset.bg],
    ['text-main on content-well', textMain, contentWell],
    ['text-on-accent on accent', textOnAccent, accent],
    ['success on surface-base', status.success, surfaces.base],
    ['success on surface-raised', status.success, surfaces.raised],
    ['warning on surface-base', status.warning, surfaces.base],
    ['warning on surface-raised', status.warning, surfaces.raised],
    ['danger on surface-base', status.danger, surfaces.base],
    ['danger on surface-raised', status.danger, surfaces.raised],
    ['info on surface-base', status.info, surfaces.base],
    ['info on surface-raised', status.info, surfaces.raised],
  ];
  console.log(`\nWrote ${outPath}`);
  console.log(`archetype=${archetypeName} mode=${mode} shell=${shell} accent=${accent}`);
  console.log(`fonts: ${preset.fonts.sans.split(',')[0]}`);
  console.log(`Load fonts: ${preset.fonts.googleFonts}\n`);
  console.log('Verified contrast (WCAG AA, target 4.5:1):');
  for (const [label, fg, bg] of report) {
    const ratio = Math.round(contrastRatio(fg, bg) * 100) / 100;
    console.log(`  ${ratio >= 4.5 ? 'PASS' : 'WARN'}  ${label}: ${fg} on ${bg} = ${ratio}:1`);
  }
  console.log('');
}

main();
