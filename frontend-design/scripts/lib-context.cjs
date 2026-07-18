'use strict';

const fs = require('fs');
const path = require('path');

function loadJson(p) {
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

/**
 * Infer register, shell, scope tier from profile + direction docs.
 * Used by audit-generic, design-critique, ci-check.
 */
function loadProjectContext(root) {
  const profile = loadJson(path.join(root, 'design-profile.json'));
  const direction = readText(path.join(root, 'design-direction.md'));
  const brief = readText(path.join(root, 'product-brief.md'));
  const tokens = loadJson(path.join(root, 'design-tokens.json'));

  let register = null;
  let shell = null;
  let scopeTier = profile?.scopeTier || null;
  let archetype = tokens?.meta?.archetype || null;

  const publicApp = fs.existsSync(path.join(root, 'public', 'app.js'));
  const indexHtml =
    readText(path.join(root, 'public', 'index.html')) ||
    readText(path.join(root, 'index.html'));
  const shellHint = /\.app-shell|data-tab=/i.test(indexHtml);
  if (
    scopeTier === 'component' &&
    (fs.existsSync(path.join(root, 'app.js')) || publicApp || shellHint)
  ) {
    scopeTier = 'app';
  }

  const corpus = `${direction}\n${brief}`;
  if (/\*\*Register:\*\*\s*brand|Register:\s*brand|brand\s*\/\s*marketing/i.test(corpus)) {
    register = 'brand';
  } else if (/\*\*Register:\*\*\s*product|Register:\s*product|product\s*UI/i.test(corpus)) {
    register = 'product';
  }

  if (/\*\*Shell:\*\*\s*None|Shell:\s*None|no sidebar|no app shell/i.test(corpus)) {
    shell = 'none';
  } else if (/\*\*Shell:\*\*\s*topbar|left sidebar|sidebar shell|shell.*sidebar/i.test(corpus)) {
    shell = 'sidebar';
  } else if (/\btopbar\b/i.test(corpus) && !/sidebar/i.test(corpus)) {
    shell = 'topbar';
  }

  if (tokens?.meta?.shell) shell = tokens.meta.shell;
  if (tokens?.meta?.archetype === 'editorial' && shell === null) register = register || 'brand';

  if (!scopeTier) {
    const hasApp =
      fs.existsSync(path.join(root, 'app.js')) ||
      publicApp ||
      shellHint ||
      (fs.existsSync(path.join(root, 'index.html')) &&
        /\.app-shell|sidebar-nav/i.test(readText(path.join(root, 'index.html'))));
    scopeTier = hasApp
      ? 'app'
      : fs.existsSync(path.join(root, 'index.html')) ||
          fs.existsSync(path.join(root, 'public', 'index.html'))
        ? 'page'
        : 'component';
  }

  if (archetype === 'editorial' && register === null) register = 'brand';
  if (archetype === 'enterprise' && register === null) register = 'product';

  return {
    root,
    scopeTier,
    register,
    shell,
    archetype,
    hasDirection: Boolean(direction.trim()),
    hasBrief: Boolean(brief.trim()),
    hasTokens: Boolean(tokens),
    tokens,
  };
}

function isComponentCssFile(cssPath) {
  const base = path.basename(cssPath).toLowerCase();
  return /^(button|input|card|modal|badge|chip|avatar|tooltip)\./i.test(base)
    || base.includes('component');
}

module.exports = { loadProjectContext, isComponentCssFile, loadJson, readText };
