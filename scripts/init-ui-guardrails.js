#!/usr/bin/env node
/**
 * Scaffold project-level UI CI guardrails (fragile-surfaces config, ui-check script, optional GitHub workflow).
 *
 * Usage:
 *   node init-ui-guardrails.js [--root .] [--shell sidebar|topbar] [--ci github|none]
 *   node init-ui-guardrails.js --root ./my-app --shell sidebar --ci github
 *
 * Creates:
 *   ui-guardrails/fragile-surfaces.json
 *   ui-guardrails/README.md
 *   scripts/ui-check.js
 *   .github/workflows/ui-guardrails.yml  (with --ci github)
 *   Appends AGENTS.md section if file exists
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { findSkillRoot } = require('./lib-skill-root.cjs');

const AGENTS_SECTION = `
## Visual / UI engineering (frontend-design skill)

Do not fix UI by stacking broad global overrides. Identify the owning surface/file before editing CSS.

Before claiming a UI fix complete:
- Run \`node scripts/ui-check.js --base-url http://localhost:PORT --strict\`
- Run \`node <SKILL_ROOT>/scripts/design-critique.js --root .\` — report SHIP/BLOCK
- Verify desktop, tablet, and mobile for touched surfaces.
- Edit \`ui-guardrails/fragile-surfaces.json\` when adding fragile routes.

Stop condition: if more than two fixes in the same area need global overrides, refactor layout ownership first.
See skill reference: regression-guardrails.md.
`.trim();

function parseArgs(argv) {
  const out = { root: process.cwd(), shell: null, ci: 'none', force: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--root') out.root = path.resolve(argv[++i]);
    else if (a === '--skill-root') out.skillRoot = path.resolve(argv[++i]);
    else if (a === '--shell') out.shell = argv[++i];
    else if (a === '--ci') out.ci = argv[++i];
    else if (a === '--force') out.force = true;
  }
  return out;
}

function copyTemplate(skillRoot, name, dest, force) {
  const src = path.join(skillRoot, 'templates', 'ui-guardrails', name);
  if (!fs.existsSync(src)) {
    console.error(`Template missing: ${src}`);
    process.exit(1);
  }
  if (fs.existsSync(dest) && !force) {
    console.log(`  skip (exists): ${path.relative(process.cwd(), dest)}`);
    return false;
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  console.log(`  wrote: ${path.relative(process.cwd(), dest)}`);
  return true;
}

function patchPackageJson(root) {
  const pkgPath = path.join(root, 'package.json');
  if (!fs.existsSync(pkgPath)) return;
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  pkg.scripts = pkg.scripts || {};
  if (!pkg.scripts['ui:check']) {
    pkg.scripts['ui:check'] = 'node scripts/ui-check.js --base-url http://127.0.0.1:4173';
    pkg.scripts['ui:check:strict'] = 'node scripts/ui-check.js --base-url http://127.0.0.1:4173 --strict';
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
    console.log('  patched: package.json scripts ui:check, ui:check:strict');
  }
}

function appendAgentsMd(root, force) {
  const agentsPath = path.join(root, 'AGENTS.md');
  const marker = '## Visual / UI engineering (frontend-design skill)';
  if (fs.existsSync(agentsPath)) {
    const content = fs.readFileSync(agentsPath, 'utf8');
    if (content.includes(marker)) {
      console.log('  skip: AGENTS.md already has UI guardrails section');
      return;
    }
    fs.appendFileSync(agentsPath, '\n\n' + AGENTS_SECTION + '\n');
    console.log('  appended: AGENTS.md');
  } else {
    const snippetPath = path.join(root, 'ui-guardrails', 'AGENTS-snippet.md');
    if (!fs.existsSync(snippetPath) || force) {
      fs.writeFileSync(snippetPath, AGENTS_SECTION + '\n');
      console.log('  wrote: ui-guardrails/AGENTS-snippet.md (paste into AGENTS.md)');
    }
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const skillRoot = findSkillRoot(args.skillRoot);
  if (!skillRoot) {
    console.error('Cannot find skill root. Pass --skill-root or set FRONTEND_DESIGN_SKILL_ROOT.');
    process.exit(1);
  }

  if (!args.shell) {
    console.error(
      'Missing required --shell sidebar|topbar.\n' +
        '  Pick the shell from discovery / design-direction.md — do not assume sidebar.\n' +
        '  See references/discovery.md',
    );
    process.exit(1);
  }
  if (!['sidebar', 'topbar'].includes(args.shell)) {
    console.error('--shell must be sidebar or topbar');
    process.exit(1);
  }

  const root = args.root;
  console.log(`\ninit-ui-guardrails: ${root} (shell=${args.shell}, ci=${args.ci})\n`);

  const guardDir = path.join(root, 'ui-guardrails');
  const fragileName = args.shell === 'topbar'
    ? 'fragile-surfaces.topbar.json'
    : 'fragile-surfaces.sidebar.json';

  copyTemplate(skillRoot, fragileName, path.join(guardDir, 'fragile-surfaces.json'), args.force);
  copyTemplate(skillRoot, 'README.md', path.join(guardDir, 'README.md'), args.force);
  copyTemplate(skillRoot, 'ui-check.js', path.join(root, 'scripts', 'ui-check.js'), args.force);

  const ctxDir = path.join(skillRoot, 'templates', 'project-context');
  const designTpl = path.join(ctxDir, 'design-direction.template.md');
  if (!fs.existsSync(path.join(root, 'design-direction.md')) && fs.existsSync(designTpl)) {
    fs.copyFileSync(designTpl, path.join(root, 'design-direction.md'));
    console.log('  wrote: design-direction.md (template — fill in)');
  }
  const briefTpl = path.join(ctxDir, 'product-brief.md');
  if (!fs.existsSync(path.join(root, 'product-brief.md')) && fs.existsSync(briefTpl)) {
    fs.copyFileSync(briefTpl, path.join(root, 'product-brief.md'));
    console.log('  wrote: product-brief.md (template — fill in)');
  }

  if (args.ci === 'github') {
    copyTemplate(
      skillRoot,
      'github-workflow.yml',
      path.join(root, '.github', 'workflows', 'ui-guardrails.yml'),
      args.force,
    );
  }

  patchPackageJson(root);
  appendAgentsMd(root, args.force);

  console.log(`
Next steps:
  1. Edit ui-guardrails/fragile-surfaces.json — paths and selectors for your app
  2. cd "${path.join(skillRoot, 'ab-harness')}" && npm install  (once, for Playwright)
  3. Start app: python -m http.server 4173  (or your dev server)
  4. node scripts/ui-check.js --base-url http://127.0.0.1:4173 --strict

Set FRONTEND_DESIGN_SKILL_ROOT in CI if skill is not at ~/.cursor/skills/frontend-design
`);
}

main();
