#!/usr/bin/env node
// Profile frontend stack + eng smells. Writes stack-profile.json.
// Usage: node profile-stack.js [--root <dir>] [--out stack-profile.json]

'use strict';

const fs = require('fs');
const path = require('path');

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const key = argv[i].slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) out[key] = true;
      else {
        out[key] = next;
        i++;
      }
    }
  }
  return out;
}

function readJSON(p) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

function readText(p) {
  try {
    return fs.readFileSync(p, 'utf8');
  } catch {
    return '';
  }
}

function exists(root, rel) {
  return fs.existsSync(path.join(root, rel));
}

function detectFramework(deps, root) {
  if (deps['next']) return 'Next.js (React)';
  if (deps['@remix-run/react']) return 'Remix (React)';
  if (deps['nuxt']) return 'Nuxt (Vue)';
  if (deps['@angular/core']) return 'Angular';
  if (deps['@sveltejs/kit']) return 'SvelteKit';
  if (deps['svelte']) return 'Svelte';
  if (deps['astro']) return 'Astro';
  if (deps['solid-js']) return 'Solid';
  if (deps['react']) return 'React';
  if (deps['vue']) return 'Vue';
  if (deps['vite'] && !deps['react'] && !deps['vue'] && !deps['svelte']) return 'Vite (unspecified UI)';
  if (exists(root, 'astro.config.mjs') || exists(root, 'astro.config.ts')) return 'Astro';
  if (exists(root, 'next.config.js') || exists(root, 'next.config.mjs') || exists(root, 'next.config.ts')) {
    return 'Next.js';
  }
  return null;
}

function inferScopeTier(root, deps) {
  const publicApp = exists(root, 'public/app.js') || exists(root, 'public/index.html');
  const hasShell =
    /\.app-shell|sidebar|data-tab=/i.test(readText(path.join(root, 'public/index.html'))) ||
    /\.app-shell|sidebar|data-tab=/i.test(readText(path.join(root, 'index.html')));
  const hasRouter =
    exists(root, 'app.js') ||
    exists(root, 'src/router') ||
    exists(root, 'src/routes') ||
    exists(root, 'app') ||
    Boolean(deps['react-router-dom'] || deps['vue-router'] || deps['@tanstack/react-router']);
  if ((hasRouter || hasShell || publicApp) && (exists(root, 'index.html') || exists(root, 'public/index.html') || exists(root, 'src/App.tsx'))) {
    if (hasShell || hasRouter || exists(root, 'server.js')) return 'app';
  }
  if (exists(root, 'index.html') || exists(root, 'src/pages') || exists(root, 'app')) return 'page';
  return 'component';
}

function countLines(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8').split(/\r?\n/).length;
  } catch {
    return 0;
  }
}

function walkFiles(root, pred, max = 8000) {
  const out = [];
  const stack = [root];
  let seen = 0;
  const skip = new Set(['node_modules', '.git', 'dist', 'build', '.next', '.nuxt', 'coverage', '.svelte-kit', 'out']);
  while (stack.length && seen < max) {
    const dir = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (!skip.has(e.name) && !e.name.startsWith('.')) stack.push(full);
      } else {
        seen++;
        if (pred(full, e.name)) out.push(full);
      }
    }
  }
  return out;
}

function detectIconSystems(root, deps) {
  const systems = new Set();
  const htmlFiles = walkFiles(root, (f, name) => /\.html?$/i.test(name)).slice(0, 40);
  const blob = htmlFiles.map(readText).join('\n') + JSON.stringify(deps);
  if (/lucide/i.test(blob) || deps['lucide-react'] || deps['lucide']) systems.add('lucide');
  if (/font-awesome|fontawesome|fa-solid|cdnjs\.cloudflare\.com\/ajax\/libs\/font-awesome/i.test(blob) || deps['@fortawesome/fontawesome-free']) {
    systems.add('font-awesome');
  }
  if (/heroicons/i.test(blob) || deps['@heroicons/react']) systems.add('heroicons');
  if (/material-icons|material-symbols|fonts\.googleapis\.com\/icon/i.test(blob)) systems.add('material-icons');
  return [...systems];
}

function detectFrameworkRuntimes(deps) {
  const runtimes = [];
  if (deps['react'] || deps['next']) runtimes.push('react');
  if (deps['vue'] || deps['nuxt']) runtimes.push('vue');
  if (deps['svelte'] || deps['@sveltejs/kit']) runtimes.push('svelte');
  if (deps['@angular/core']) runtimes.push('angular');
  if (deps['solid-js']) runtimes.push('solid');
  return runtimes;
}

function findMonoliths(root) {
  const candidates = walkFiles(
    root,
    (f, name) => /\.(js|ts|tsx|jsx|css)$/i.test(name) && !/\.min\./i.test(name) && !/tokens(\.dark)?\.css$/i.test(name),
  );
  const big = [];
  for (const f of candidates) {
    const rel = path.relative(root, f).replace(/\\/g, '/');
    if (rel.includes('node_modules')) continue;
    const lines = countLines(f);
    if (lines > 400) big.push({ path: rel, lines });
  }
  big.sort((a, b) => b.lines - a.lines);
  return big.slice(0, 20);
}

function hasComponentSurface(root) {
  const dirs = [
    'src/components',
    'components',
    'app/components',
    'src/lib/components',
    'src/routes',
    'src/views',
    'src/pages',
    'app',
  ];
  return dirs.some((d) => exists(root, d));
}

function isUnknown(framework) {
  if (!framework) return true;
  return /unknown|vanilla/i.test(framework);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const root = path.resolve(process.cwd(), String(args.root || '.'));
  const outPath = path.resolve(root, String(args.out || 'stack-profile.json'));

  const pkg = readJSON(path.join(root, 'package.json')) || {};
  const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
  let framework = detectFramework(deps, root);
  if (!framework) {
    if (exists(root, 'public/app.js') || exists(root, 'app.js')) framework = 'Unknown / vanilla';
    else framework = 'Unknown / vanilla';
  }

  const scopeTier = inferScopeTier(root, deps);
  const hasStackDecision = exists(root, 'stack-decision.md');
  const hasProduct =
    exists(root, 'PRODUCT.md') || exists(root, 'product-brief.md');
  const icons = detectIconSystems(root, deps);
  const runtimes = detectFrameworkRuntimes(deps);
  const monoliths = findMonoliths(root);
  const smells = [];

  if (icons.length >= 2) smells.push({ id: 'dual-icons', detail: icons.join(', ') });
  if (runtimes.length >= 2) smells.push({ id: 'dual-framework', detail: runtimes.join(', ') });
  if (scopeTier === 'app' && monoliths.some((m) => m.lines > 400)) {
    smells.push({
      id: 'monolith-files',
      detail: monoliths
        .slice(0, 5)
        .map((m) => `${m.path}:${m.lines}`)
        .join('; '),
    });
  }
  if (scopeTier === 'app' && !hasComponentSurface(root) && /vanilla|unknown/i.test(framework)) {
    smells.push({ id: 'no-component-surface', detail: 'app tier without components/routes/views' });
  }
  if (isUnknown(framework) && (scopeTier === 'app' || scopeTier === 'page') && !hasStackDecision) {
    smells.push({ id: 'stack-undecided', detail: 'unknown/vanilla without stack-decision.md' });
  }

  const needsStackInterview =
    (isUnknown(framework) && (scopeTier === 'app' || scopeTier === 'page') && !hasStackDecision) ||
    smells.some((s) => s.id === 'stack-undecided');

  const profile = {
    generatedBy: 'profile-stack.js',
    root,
    framework,
    scopeTier,
    hasStackDecision,
    hasProductContract: hasProduct,
    iconSystems: icons,
    frameworkRuntimes: runtimes,
    monoliths,
    hasComponentSurface: hasComponentSurface(root),
    smells,
    needsStackInterview,
    guidance: [
      needsStackInterview
        ? 'Invoke stack interview (references/stack-selection.md); do not lock vanilla for app/page tier.'
        : 'Extend existing stack; do not introduce a competing framework.',
      'Write stack-decision.md after confirmation.',
      'Run check-structure.js --strict before handing off to frontend-design polish.',
    ],
  };

  fs.writeFileSync(outPath, JSON.stringify(profile, null, 2) + '\n');
  console.log(`\nWrote ${outPath}`);
  console.log(`framework: ${framework}`);
  console.log(`scope:     ${scopeTier}`);
  console.log(`interview: ${needsStackInterview}`);
  console.log(`smells:    ${smells.length ? smells.map((s) => s.id).join(', ') : '(none)'}`);
  console.log('');
}

main();
