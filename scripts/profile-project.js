#!/usr/bin/env node
// Inspect the current project and write a portable design-profile.json describing
// the framework, styling system, and likely component directory.
//
// Usage: node profile-project.js [--root <dir>] [--out design-profile.json]
//
// Reads package.json + config files; falls back to scanning source file
// extensions when dependencies don't identify the stack. Writes only its own
// output file and never modifies existing project config.

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
      else { out[key] = next; i++; }
    }
  }
  return out;
}

function readJSON(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
}

function detectFromDeps(deps, root) {
  let framework = null;
  let styling = null;
  const uiLibraries = [];

  if (deps['next']) framework = 'Next.js (React)';
  else if (deps['@remix-run/react']) framework = 'Remix (React)';
  else if (deps['nuxt']) framework = 'Nuxt (Vue)';
  else if (deps['@angular/core']) framework = 'Angular';
  else if (deps['svelte'] || deps['@sveltejs/kit']) framework = 'Svelte';
  else if (deps['solid-js']) framework = 'Solid';
  else if (deps['react']) framework = 'React';
  else if (deps['vue']) framework = 'Vue';

  if (deps['@mui/material'] || deps['@material-ui/core']) uiLibraries.push('MUI');
  if (deps['@chakra-ui/react']) uiLibraries.push('Chakra UI');
  if (deps['@mantine/core']) uiLibraries.push('Mantine');
  if (deps['@radix-ui/react-dialog'] || deps['@radix-ui/react-dropdown-menu']) {
    uiLibraries.push('Radix UI');
  }
  if (root && fs.existsSync(path.join(root, 'components.json'))) {
    uiLibraries.push('shadcn/ui');
  }

  if (deps['tailwindcss']) styling = 'Tailwind CSS';
  else if (deps['styled-components']) styling = 'styled-components';
  else if (deps['@emotion/react'] || deps['@emotion/styled']) styling = 'Emotion';
  else if (deps['@stitches/react']) styling = 'Stitches';
  else if (deps['sass'] || deps['node-sass']) styling = 'SCSS/Sass';

  return { framework, styling, uiLibraries };
}

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', '.nuxt', 'out', 'coverage', '.svelte-kit']);

function scanExtensions(root, maxFiles = 4000) {
  const counts = Object.create(null);
  let seen = 0;
  const stack = [root];
  while (stack.length && seen < maxFiles) {
    const dir = stack.pop();
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      if (e.isDirectory()) {
        if (!SKIP_DIRS.has(e.name) && !e.name.startsWith('.')) stack.push(path.join(dir, e.name));
      } else {
        seen++;
        const ext = path.extname(e.name).toLowerCase();
        if (ext) counts[ext] = (counts[ext] || 0) + 1;
      }
    }
  }
  return counts;
}

function inferFromExtensions(counts) {
  let framework = null;
  let styling = null;
  if (counts['.svelte']) framework = 'Svelte (inferred)';
  else if (counts['.vue']) framework = 'Vue (inferred)';
  else if (counts['.tsx'] || counts['.jsx']) framework = 'JSX/React-style (inferred)';
  else if (counts['.astro']) framework = 'Astro (inferred)';
  if (counts['.scss'] || counts['.sass']) styling = 'SCSS/Sass (inferred)';
  else if (counts['.css'] && !styling) styling = 'CSS (inferred)';
  return { framework, styling };
}

function findComponentDir(root) {
  const candidates = ['src/components', 'app/components', 'components', 'src/lib/components', 'src'];
  for (const c of candidates) {
    if (fs.existsSync(path.join(root, c))) return c + '/';
  }
  return null;
}

function detectTokens(root) {
  const candidates = ['design-tokens.json', 'tokens.json', 'src/design-tokens.json', 'src/styles/tokens.json'];
  for (const c of candidates) if (fs.existsSync(path.join(root, c))) return c;
  return null;
}

function fileExists(root, name) {
  return fs.existsSync(path.join(root, name));
}

function inferScopeTier(root) {
  const hasRouter =
    fileExists(root, 'app.js') ||
    fileExists(root, 'src/router') ||
    fileExists(root, 'src/routes') ||
    (() => {
      try {
        const pkg = readJSON(path.join(root, 'package.json'));
        const deps = { ...(pkg?.dependencies || {}), ...(pkg?.devDependencies || {}) };
        return Boolean(deps['react-router-dom'] || deps['vue-router'] || deps['@tanstack/react-router']);
      } catch { return false; }
    })();
  if (hasRouter && (fileExists(root, 'index.html') || fileExists(root, 'src/App.tsx') || fileExists(root, 'src/App.jsx'))) {
    return 'app';
  }
  if (fileExists(root, 'index.html') || fileExists(root, 'src/pages') || fileExists(root, 'app')) {
    return 'page';
  }
  return 'component';
}

function buildOpenQuestions(profile) {
  const q = [];
  if (!profile.hasDesignDirection) {
    if (profile.scopeTier === 'component') {
      q.push('Accent color (hex) or match existing tokens/CSS?');
      q.push('Generate component tokens or map to existing design system?');
      return q;
    }
    q.push('Register: product UI (app/tool) or brand/marketing (landing/editorial)?');
    q.push('Archetype: enterprise (dense B2B), consumer (friendly app), or editorial (story/marketing)?');
    q.push('Brand accent color (hex) or match existing tokens/CSS?');
  }
  if (profile.scopeTier === 'app' && !profile.hasProductBrief && !profile.hasDesignDirection) {
    q.push('App shell: top bar, left sidebar, hybrid, or extend existing library chrome?');
    q.push('Theme: light only, dark only, or user-toggle dual theme?');
  }
  if (!profile.designTokens && !profile.hasDesignDirection) {
    q.push('Generate new design-tokens.json or map to existing design system?');
  }
  return q;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const root = path.resolve(process.cwd(), String(args.root || '.'));
  const outPath = path.resolve(root, String(args.out || 'design-profile.json'));

  let framework = null;
  let styling = null;
  let uiLibraries = [];
  let source = 'none';

  const pkg = readJSON(path.join(root, 'package.json'));
  if (pkg) {
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    const d = detectFromDeps(deps, root);
    framework = d.framework;
    styling = d.styling;
    uiLibraries = d.uiLibraries;
    source = 'package.json';
    // Config-file corroboration for styling.
    if (!styling) {
      if (['tailwind.config.js', 'tailwind.config.ts', 'tailwind.config.cjs', 'tailwind.config.mjs']
        .some((f) => fs.existsSync(path.join(root, f)))) styling = 'Tailwind CSS';
    }
  }

  if (!framework || !styling) {
    const counts = scanExtensions(root);
    const inferred = inferFromExtensions(counts);
    framework = framework || inferred.framework || 'Unknown / vanilla';
    styling = styling || inferred.styling || 'CSS (assumed)';
    if (source === 'none') source = 'file-scan';
    else source = 'package.json + file-scan';
  }

  const profile = {
    generatedBy: 'profile-project.js',
    root,
    framework,
    styling,
    uiLibraries: uiLibraries.length ? uiLibraries : null,
    componentDir: findComponentDir(root),
    designTokens: detectTokens(root),
    hasDesignDirection: fileExists(root, 'design-direction.md'),
    hasProductBrief: fileExists(root, 'product-brief.md'),
    scopeTier: inferScopeTier(root),
    detectedFrom: source,
    guidance: [
      'Read references/discovery.md — do not assume admin dashboard or enterprise chrome.',
      'Match this framework and styling system; do not introduce a competing one.',
      uiLibraries.length
        ? `Extend ${uiLibraries.join(', ')} theming/shell primitives — do not replace the library (design-systems.md, shell-patterns.md).`
        : 'Map values to design tokens; avoid hardcoded hex/px in component code.',
      'Components should not set their own outer margins; spacing is the parent layout\u2019s job.',
    ],
  };
  profile.openQuestions = buildOpenQuestions(profile);

  fs.writeFileSync(outPath, JSON.stringify(profile, null, 2) + '\n');
  console.log(`\nWrote ${outPath}`);
  console.log(`framework: ${framework}`);
  console.log(`styling:   ${styling}`);
  console.log(`scope:     ${profile.scopeTier}`);
  console.log(`ui libs:   ${profile.uiLibraries ? profile.uiLibraries.join(', ') : '(none detected)'}`);
  console.log(`components: ${profile.componentDir || '(not found)'}`);
  console.log(`tokens:    ${profile.designTokens || '(none \u2014 decide archetype, then init-design-tokens.js)'}`);
  console.log(`direction: ${profile.hasDesignDirection ? 'design-direction.md' : '(missing)'}`);
  console.log(`brief:     ${profile.hasProductBrief ? 'product-brief.md' : '(missing)'}`);
  if (profile.openQuestions.length) {
    console.log('\nopenQuestions (ask user before prescribing shell/archetype):');
    profile.openQuestions.forEach((q, i) => console.log(`  ${i + 1}. ${q}`));
  }
  console.log(`detected from: ${source}\n`);
}

main();
