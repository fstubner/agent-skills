#!/usr/bin/env node
'use strict';

/**
 * Project-local entry point for frontend-design CI checks.
 * Invokes the skill's ci-check.js — set FRONTEND_DESIGN_SKILL_ROOT if non-standard install.
 */
const path = require('path');
const { spawnSync } = require('child_process');

function skillRoot() {
  if (process.env.FRONTEND_DESIGN_SKILL_ROOT) {
    return process.env.FRONTEND_DESIGN_SKILL_ROOT;
  }
  const home = process.env.USERPROFILE || process.env.HOME || '';
  return path.join(home, '.cursor', 'skills', 'frontend-design');
}

const projectRoot = path.resolve(__dirname, '..');
const ciCheck = path.join(skillRoot(), 'scripts', 'ci-check.js');

const r = spawnSync(
  process.execPath,
  [ciCheck, '--root', projectRoot, ...process.argv.slice(2)],
  { stdio: 'inherit', env: process.env, shell: false },
);

process.exit(r.status ?? 1);
