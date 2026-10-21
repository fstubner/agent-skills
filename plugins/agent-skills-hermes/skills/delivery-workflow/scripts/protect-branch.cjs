#!/usr/bin/env node
'use strict';
// Sets GitHub branch protection on a repository's default branch, so the
// workflow holds in every tool, not only where the guard hook runs:
//
//   - changes reach the default branch through a pull request
//   - the checks that ran on the last merged pull request must pass
//   - administrators are not exempt
//   - force pushes and deleting the branch are refused
//
// No approving review is required. The agent works through the owner's own
// login, and GitHub doesn't let the author of a pull request approve it, so a
// required review would block every merge. The owner approves in chat.
//
// It prints the settings and changes nothing unless given --apply.
//
// Usage: node protect-branch.cjs [--repo owner/name] [--apply]

const { spawnSync } = require('child_process');

function gh(args) {
  const r = spawnSync('gh', args, { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`gh ${args.join(' ')} failed: ${(r.stderr || r.stdout).trim()}`);
  return r.stdout;
}

function parse(argv) {
  const out = { apply: false, repo: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--apply') out.apply = true;
    else if (argv[i] === '--repo') out.repo = argv[++i];
    else throw new Error(`unknown argument ${argv[i]}. Usage: protect-branch.cjs [--repo owner/name] [--apply]`);
  }
  return out;
}

// The protection settings for a branch whose latest commit ran `checks`.
function protection(checks) {
  return {
    required_status_checks: checks.length ? { strict: false, contexts: checks } : null,
    enforce_admins: true,
    required_pull_request_reviews: { required_approving_review_count: 0 },
    restrictions: null,
    allow_force_pushes: false,
    allow_deletions: false,
  };
}

function main() {
  const args = parse(process.argv.slice(2));
  const repo = args.repo || gh(['repo', 'view', '--json', 'nameWithOwner', '-q', '.nameWithOwner']).trim();
  const info = JSON.parse(gh(['api', `repos/${repo}`]));
  if (info.private) {
    console.log(`${repo} is private. GitHub Free has no branch protection for private repositories. If GitHub refuses, the guard hook is the only enforcement there.`);
  }
  const branch = info.default_branch;
  // The checks to require are the ones that run on a pull request, so they
  // come from the last merged pull request. Checks that run only on the
  // default branch would never report on a pull request and block it.
  const merged = JSON.parse(gh(['pr', 'list', '--repo', repo, '--state', 'merged', '--limit', '1', '--json', 'headRefOid']));
  const ref = merged.length ? merged[0].headRefOid : branch;
  const runs = JSON.parse(gh(['api', `repos/${repo}/commits/${ref}/check-runs?per_page=100`]));
  const checks = [...new Set((runs.check_runs || []).map((r) => r.name))].sort();
  const body = protection(checks);
  console.log(`${repo} ${branch}\n${JSON.stringify(body, null, 2)}`);
  if (!checks.length) console.log('No checks ran on the last pull request, so none are required.');
  if (!args.apply) {
    console.log('\nNothing changed. Run again with --apply to set this.');
    return;
  }
  const r = spawnSync('gh', ['api', '-X', 'PUT', `repos/${repo}/branches/${branch}/protection`, '--input', '-'],
    { input: JSON.stringify(body), encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`setting protection failed: ${(r.stderr || r.stdout).trim()}`);
  console.log(`\nProtection set on ${repo} ${branch}.`);
}

module.exports = { protection };

if (require.main === module) {
  try { main(); } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
