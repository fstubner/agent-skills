'use strict';

/**
 * Shared project classification for suite scripts.
 * Prefer existing pipeline profiles; fall back to broad manifests/dirs.
 * Writes/returns suite-profile.json shape.
 */

const fs = require('fs');
const path = require('path');

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

function classifyProject(root) {
  const stack = readJSON(path.join(root, 'stack-profile.json'));
  const design = readJSON(path.join(root, 'design-profile.json'));
  const arch = readJSON(path.join(root, 'architecture-profile.json'));
  const suiteCached = readJSON(path.join(root, 'suite-profile.json'));

  const pkg = readJSON(path.join(root, 'package.json')) || {};
  const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };

  const signals = [];
  let scopeTier = stack?.scopeTier || design?.scopeTier || null;
  let systemTier = arch?.systemTier || null;
  let source = 'heuristic';

  if (stack?.scopeTier || design?.scopeTier || arch?.systemTier) {
    source = 'pipeline-profiles';
  }

  // Manifest / framework signals (broad)
  const appManifests = [
    ['next.config.js', 'next'],
    ['next.config.mjs', 'next'],
    ['next.config.ts', 'next'],
    ['nuxt.config.ts', 'nuxt'],
    ['nuxt.config.js', 'nuxt'],
    ['svelte.config.js', 'sveltekit'],
    ['astro.config.mjs', 'astro'],
    ['astro.config.ts', 'astro'],
    ['remix.config.js', 'remix'],
    ['angular.json', 'angular'],
    ['manage.py', 'django'],
    ['Gemfile', 'rails'],
    ['pom.xml', 'maven'],
    ['build.gradle', 'gradle'],
    ['go.mod', 'go'],
    ['Cargo.toml', 'rust'],
  ];
  for (const [file, label] of appManifests) {
    if (exists(root, file)) {
      signals.push(label);
      if (!scopeTier) scopeTier = 'app';
      if (!systemTier && label !== 'astro') systemTier = systemTier || 'multi';
    }
  }
  if (deps['next'] || deps['nuxt'] || deps['@sveltejs/kit'] || deps['@remix-run/react'] || deps['astro']) {
    signals.push('package-meta-framework');
    if (!scopeTier) scopeTier = 'app';
  }
  if (exists(root, 'app') || exists(root, 'src/app') || exists(root, 'src/routes') || exists(root, 'pages')) {
    signals.push('routes-dir');
    if (!scopeTier) scopeTier = scopeTier || 'page';
  }
  if (exists(root, 'server.js') || exists(root, 'server.ts') || exists(root, 'api') || exists(root, 'src/server')) {
    signals.push('server');
    if (!scopeTier) scopeTier = 'app';
    if (!systemTier) systemTier = 'multi';
  }
  if (exists(root, 'public/app.js') || exists(root, 'public/index.html')) {
    signals.push('static-spa');
    const html = readText(path.join(root, 'public/index.html')) || readText(path.join(root, 'index.html'));
    if (/\.app-shell|data-tab=/i.test(html) || exists(root, 'public/app.js')) {
      if (!scopeTier) scopeTier = 'app';
    }
  }

  if (suiteCached?.scopeTier && source === 'heuristic') {
    // keep heuristic unless pipeline profiles present
  }

  if (!scopeTier) scopeTier = 'component';
  if (!systemTier) {
    systemTier = scopeTier === 'app' && signals.includes('server') ? 'multi' : 'single';
  }

  const appTier = scopeTier === 'app' || systemTier === 'multi' || systemTier === 'distributed';
  const multiPart = systemTier === 'multi' || systemTier === 'distributed';

  const profile = {
    generatedBy: 'classify-project.js',
    root,
    scopeTier,
    systemTier,
    appTier,
    multiPart,
    signals,
    source,
    hasProductContract: exists(root, 'PRODUCT.md') || exists(root, 'product-brief.md'),
    hasArchitectureDoc:
      exists(root, 'ARCHITECTURE.md') ||
      exists(root, 'architecture.md') ||
      exists(root, 'docs/ARCHITECTURE.md') ||
      exists(root, 'docs/architecture.md'),
    hasStackDecision: exists(root, 'stack-decision.md'),
  };

  return profile;
}

function writeSuiteProfile(root, outName = 'suite-profile.json') {
  const profile = classifyProject(root);
  const outPath = path.join(root, outName);
  fs.writeFileSync(outPath, JSON.stringify(profile, null, 2) + '\n');
  return { profile, outPath };
}

module.exports = { classifyProject, writeSuiteProfile };
