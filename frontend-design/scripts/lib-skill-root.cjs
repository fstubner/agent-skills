'use strict';

const fs = require('fs');
const path = require('path');

/** Resolve frontend-design skill root (directory containing SKILL.md). */
function findSkillRoot(explicit) {
  if (explicit) {
    const resolved = path.resolve(explicit);
    if (fs.existsSync(path.join(resolved, 'SKILL.md'))) return resolved;
  }
  const env = process.env.FRONTEND_DESIGN_SKILL_ROOT;
  if (env && fs.existsSync(path.join(env, 'SKILL.md'))) return path.resolve(env);
  const home = process.env.USERPROFILE || process.env.HOME || '';
  const candidate = path.join(home, '.cursor', 'skills', 'frontend-design');
  if (fs.existsSync(path.join(candidate, 'SKILL.md'))) return candidate;
  return null;
}

/** Directory where Playwright is installed (project or ab-harness). */
function findPlaywrightCwd(projectRoot, skillRoot) {
  const tryDirs = [
    projectRoot,
    path.join(skillRoot, 'ab-harness'),
  ];
  for (const dir of tryDirs) {
    try {
      require.resolve('playwright', { paths: [dir] });
      return dir;
    } catch {
      /* next */
    }
  }
  return path.join(skillRoot, 'ab-harness');
}

module.exports = { findSkillRoot, findPlaywrightCwd };
