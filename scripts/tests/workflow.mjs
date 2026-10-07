// delivery-workflow: the guard hook, Conventional Commits and the next
// version, the pull request checker, the branch protection settings and the
// guard installer.
//
// The guard is tested against real git repositories in scratch folders, since
// what it refuses depends on the current branch and the origin remote.
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { root, expect, tmpBase, runNode, pathToFileUrl } from './harness.mjs';

const scripts = path.join(root, 'delivery-workflow', 'scripts');
const guardPath = path.join(scripts, 'guard.cjs');
const { evaluate } = await import(pathToFileUrl(guardPath));
const { protection } = await import(pathToFileUrl(path.join(scripts, 'protect-branch.cjs')));
const hasVale = (() => { const p = spawnSync('vale', ['--version'], { encoding: 'utf8' }); return !p.error && p.status === 0; })();

const git = (dir, ...args) => spawnSync('git', ['-C', dir, ...args], { encoding: 'utf8' });
function repo(name, { origin = 'https://github.com/owner/repo.git', branch = 'main' } = {}) {
  const dir = path.join(tmpBase, `workflow-${name}`);
  fs.mkdirSync(dir, { recursive: true });
  git(dir, 'init', '-q', '-b', 'main');
  if (origin) git(dir, 'remote', 'add', 'origin', origin);
  if (branch !== 'main') git(dir, 'checkout', '-q', '-b', branch);
  return dir;
}

const noGh = { owners: ['owner'], now: () => new Date(), gh: () => ({ status: 0, stdout: '[]' }) };
const refused = (cmd, dir, env = noGh) => evaluate(cmd, dir, env).length > 0;
const reasonsOf = (cmd, dir, env = noGh) => evaluate(cmd, dir, env).join(' | ');

// ---------- Commits and pushes ----------
{
  const onMain = repo('main');
  const onBranch = repo('branch', { branch: 'fix-thing' });
  const local = repo('local', { origin: false });
  const work = repo('work', { origin: 'git@github.com:some-company/service.git' });
  expect('guard: a commit on the default branch is refused', refused('git commit -m "fix: it"', onMain), reasonsOf('git commit -m "fix: it"', onMain));
  expect('guard: a typed commit on a working branch is allowed', !refused('git commit -m "fix: it"', onBranch), reasonsOf('git commit -m "fix: it"', onBranch));
  expect('guard: a repository without a remote is left alone', !refused('git commit -m "Fix it"', local));
  expect('guard: someone else\'s repository keeps its own conventions',
    !refused('git commit -m "Fix it"', work) && !refused('git push origin main', work), reasonsOf('git push origin main', work));
  expect('guard: git -C points the check at that repository', refused(`git -C "${onMain}" commit -m "fix: x"`, onBranch));
  expect('guard: cd before the commit points the check at that repository', refused(`cd "${onMain}" && git commit -m "fix: x"`, onBranch));

  expect('guard: a subject without a type is refused', /needs a type/.test(reasonsOf('git commit -m "Fix the parser"', onBranch)));
  expect('guard: an unknown type is refused', /"fixed" is not a commit type/.test(reasonsOf('git commit -m "fixed: the parser"', onBranch)));
  expect('guard: a scope and a breaking mark are allowed', !refused('git commit -m "feat(cli)!: drop the old flag"', onBranch));
  expect('guard: the first -m is the subject', !refused('git commit -m "fix: the parser" -m "Untyped body text."', onBranch));

  expect('guard: a push to the default branch is refused', refused('git push origin main', onBranch));
  expect('guard: a push of HEAD to the default branch is refused', refused('git push origin HEAD:main', onBranch));
  expect('guard: a bare push from the default branch is refused', refused('git push', onMain));
  expect('guard: pushing every branch is refused', refused('git push --all origin', onBranch));
  expect('guard: a push of the working branch is allowed', !refused('git push -u origin fix-thing', onBranch), reasonsOf('git push -u origin fix-thing', onBranch));
  expect('guard: --force-with-lease on a working branch is allowed', !refused('git push --force-with-lease origin fix-thing', onBranch));
  expect('guard: --force is refused', refused('git push --force origin fix-thing', onBranch));
  expect('guard: -f inside combined short flags is refused', refused('git push -uf origin fix-thing', onBranch));
  expect('guard: a + refspec is a force push', refused('git push origin +fix-thing', onBranch));
  expect('guard: deleting a remote tag is refused', refused('git push origin --delete v1.0.0', onBranch));
  expect('guard: deleting with an empty source is refused', refused('git push origin :fix-thing', onBranch));

  // The default branch comes from origin/HEAD when git knows it.
  const master = repo('master', { branch: 'feature' });
  git(master, 'symbolic-ref', 'refs/remotes/origin/HEAD', 'refs/remotes/origin/master');
  expect('guard: the default branch is read from origin/HEAD', refused('git push origin master', master) && !refused('git push origin main', master));

  const trailer = 'git commit -m "fix: it\n\nCo-Authored-By: Someone <a@b.c>"';
  expect('guard: an attribution trailer in -m is refused', /attribution/.test(reasonsOf(trailer, onBranch)));
  const msg = path.join(onBranch, 'msg.txt');
  fs.writeFileSync(msg, 'fix: it\n\n🤖 Generated with Claude Code\n');
  expect('guard: an attribution line in a -F file is refused', /attribution/.test(reasonsOf('git commit -F msg.txt', onBranch)));
  expect('guard: a plain message is allowed', !refused('git commit -m "fix: it" -m "The body."', onBranch));
}

// ---------- Releases and merges ----------
{
  const dir = repo('release', { branch: 'fix-thing' });
  const at = (iso) => ({ owners: ['owner'], now: () => new Date('2026-10-06T15:00:00'), gh: () => ({ status: 0, stdout: JSON.stringify(iso ? [{ tagName: 'v1.2.0', createdAt: iso }] : []) }) });
  expect('guard: a release that is not a draft is refused', /draft/.test(reasonsOf('gh release create v1.3.0', dir, at(null))));
  expect('guard: a draft release is allowed', !refused('gh release create v1.3.0 --draft --notes-file n.md', dir, at('2026-10-01T10:00:00Z')));
  expect('guard: a second release on the same day is refused',
    /already created today/.test(reasonsOf('gh release create v1.3.0 --draft', dir, at(new Date('2026-10-06T09:00:00').toISOString()))));
  const broken = { owners: ['owner'], now: () => new Date(), gh: () => ({ status: 1, stdout: '', stderr: 'no network' }) };
  expect('guard: a release whose cadence can\'t be checked is refused', /could not be checked/.test(reasonsOf('gh release create v1 --draft', dir, broken)));
  expect('guard: publishing a draft with release edit is refused', refused('gh release edit v1.3.0 --draft=false', dir));
  expect('guard: publishing a draft through the API is refused', refused('gh api -X PATCH repos/o/r/releases/1 -F draft=false', dir));
  expect('guard: deleting a ref through the API is refused', refused('gh api -X DELETE repos/o/r/git/refs/tags/v1', dir));
  expect('guard: merging with --admin is refused', refused('gh pr merge 12 --admin --merge', dir));
  expect('guard: an ordinary merge is allowed', !refused('gh pr merge 12 --merge --delete-branch', dir));
}

// ---------- The hook as Claude Code runs it ----------
{
  const dir = repo('hook');
  const config = path.join(tmpBase, 'workflow-config.json');
  fs.writeFileSync(config, JSON.stringify({ owners: ['Owner'] }));
  const hook = (input, cfg = config) => spawnSync(process.execPath, [guardPath],
    { input, encoding: 'utf8', env: { ...process.env, AGENT_SKILLS_WORKFLOW_CONFIG: cfg } });
  const commit = JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'git commit -m "fix: x"' }, cwd: dir });
  const blocked = hook(commit);
  expect('guard hook: a refused command exits 2 with the reason on stderr', blocked.status === 2 && /straight to main/.test(blocked.stderr), blocked.stderr);
  expect('guard hook: with no config file, no repository is covered', hook(commit, path.join(tmpBase, 'missing.json')).status === 0);
  const other = hook(JSON.stringify({ tool_name: 'Read', tool_input: { file_path: 'x' }, cwd: dir }));
  expect('guard hook: another tool passes through', other.status === 0);
  expect('guard hook: input it can\'t parse passes through', hook('not json').status === 0);
  const status = spawnSync(process.execPath, [guardPath, '--status'],
    { cwd: dir, encoding: 'utf8', env: { ...process.env, AGENT_SKILLS_WORKFLOW_CONFIG: config } });
  expect('guard --status says the repository is covered and names its default branch', /^covered: owner .* main/.test(status.stdout), status.stdout);
}

// ---------- Conventional Commits and the next version ----------
{
  const { parse, nextVersion } = await import(pathToFileUrl(path.join(scripts, 'conventional.cjs')));
  expect('conventional: a BREAKING CHANGE footer marks a breaking change',
    parse('feat: new output\n\nBREAKING CHANGE: the JSON shape changed').breaking === true);
  expect('conventional: fix bumps the patch number', nextVersion('1.4.2', ['fix: a', 'docs: b']).next === '1.4.3');
  expect('conventional: feat bumps the minor number', nextVersion('v1.4.2', ['fix: a', 'feat: b']).next === '1.5.0');
  expect('conventional: a breaking change bumps the major number', nextVersion('1.4.2', ['feat!: b', 'fix: a']).next === '2.0.0');
  expect('conventional: below 1.0.0 a breaking change bumps the minor number', nextVersion('0.3.0', ['fix!: b']).next === '0.4.0');
  expect('conventional: docs and chore leave the version alone', nextVersion('1.4.2', ['docs: a', 'chore: b']).level === null);

  const dir = repo('versions', { branch: 'main' });
  const env = { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' };
  const commit = (msg) => spawnSync('git', ['-C', dir, '-c', 'core.hooksPath=/dev/null', 'commit', '-q', '--allow-empty', '-m', msg], { env, encoding: 'utf8' });
  commit('feat: the first version');
  git(dir, 'tag', 'v1.2.0');
  commit('fix: a parser bug');
  commit('docs: the README');
  const next = (args = []) => runNode(path.join(scripts, 'next-version.cjs'), ['--root', dir, '--format', 'json', ...args]);
  let r = next();
  let out = JSON.parse(r.stdout);
  expect('next-version: commits since the last tag set the next version', r.status === 0 && out.current === '1.2.0' && out.next === '1.2.1' && out.level === 'patch', r.stdout);
  commit('feat(cli): a new flag');
  out = JSON.parse(next().stdout);
  expect('next-version: the largest bump wins', out.next === '1.3.0' && out.bumps.length === 2, JSON.stringify(out));
  commit('Tidy things up');
  r = next();
  out = JSON.parse(r.stdout);
  expect('next-version: an untyped commit exits 1 and is listed for the owner to decide',
    r.status === 1 && out.untyped.length === 1 && out.untyped[0].subject === 'Tidy things up', r.stdout);
}

// ---------- The pull request checker ----------
{
  const check = (body, extraEnv = null) => {
    const file = path.join(tmpBase, `pr-${Math.random().toString(36).slice(2)}.md`);
    fs.writeFileSync(file, body);
    const opts = extraEnv ? { env: { ...process.env, ...extraEnv } } : {};
    const r = runNode(path.join(scripts, 'check-pr.js'), ['--root', tmpBase, '--body-file', file, '--no-write'], opts);
    return JSON.parse(r.stdout);
  };
  const status = (report, id) => report.checks.find((c) => c.id === id)?.status;
  const good = ['## Summary', '', 'The guard refuses pushes to main.', '', '## What changed', '',
    'Pushes to main stop with a reason. This landed on 2026-10-06.', '', '## How it was verified', '',
    'The full suite passes.', '', '## Left out on purpose', '', 'Hooks for other harnesses.', ''].join('\n');
  const ok = check(good);
  expect('check-pr: a complete description passes its sections and attribution', status(ok, 'P-sections') === 'pass' && status(ok, 'P-attribution') === 'pass');
  expect('check-pr: an empty section fails', status(check(good.replace('Hooks for other harnesses.', '')), 'P-sections') === 'fail');
  expect('check-pr: an attribution line fails', status(check(`${good}\n🤖 Generated with [Claude Code](https://claude.com)\n`), 'P-attribution') === 'fail');
  if (hasVale) {
    expect('check-pr: a date in the description is allowed, because a pull request is history', status(ok, 'P-voice') === 'pass', JSON.stringify(ok.checks));
    expect('check-pr: the repo-docs voice rules apply', status(check(good.replace('The full suite passes.', 'The suite passes; all of it.')), 'P-voice') === 'fail');
  }
  const bare = check(good, { PATH: path.dirname(process.execPath), Path: path.dirname(process.execPath) });
  expect('check-pr: without Vale the voice check is not_evaluated, never passed', status(bare, 'P-voice') === 'not_evaluated');
}

// ---------- Branch protection settings ----------
{
  const p = protection(['tests (ubuntu-latest)']);
  expect('protect-branch: a pull request is required, with no approving review the author could never give',
    p.required_pull_request_reviews.required_approving_review_count === 0);
  expect('protect-branch: administrators are not exempt, and force pushes and deletion are off',
    p.enforce_admins === true && p.allow_force_pushes === false && p.allow_deletions === false);
  expect('protect-branch: the named checks are required', p.required_status_checks.contexts[0] === 'tests (ubuntu-latest)');
  expect('protect-branch: with no checks, none are required', protection([]).required_status_checks === null);
}

// ---------- The guard installer ----------
{
  const home = path.join(tmpBase, 'workflow-home');
  fs.mkdirSync(path.join(home, '.claude'), { recursive: true });
  const settings = path.join(home, '.claude', 'settings.json');
  const theirs = { matcher: 'Edit', hooks: [{ type: 'command', command: 'echo theirs' }] };
  fs.writeFileSync(settings, JSON.stringify({ hooks: { PreToolUse: [theirs] } }));
  const env = { env: { ...process.env, HOME: home, USERPROFILE: home } };
  const installer = path.join(root, 'scripts', 'install-workflow-guard.mjs');
  runNode(installer, ['--owner', 'someone'], env);
  runNode(installer, [], env);
  const installed = JSON.parse(fs.readFileSync(settings, 'utf8')).hooks.PreToolUse;
  expect('install-workflow-guard: installs once, however often it runs, and keeps other hooks',
    installed.length === 2 && installed[0].hooks[0].command === 'echo theirs' && installed[1].matcher === 'Bash',
    JSON.stringify(installed));
  const dir = path.join(home, '.agent-skills', 'workflow');
  expect('install-workflow-guard: the hook and the commit rules it needs are copied',
    fs.existsSync(path.join(dir, 'guard.cjs')) && fs.existsSync(path.join(dir, 'conventional.cjs')));
  expect('install-workflow-guard: the owners are written, and a reinstall keeps them',
    JSON.parse(fs.readFileSync(path.join(dir, 'config.json'), 'utf8')).owners.join() === 'someone');
  runNode(installer, ['--remove'], env);
  const after = JSON.parse(fs.readFileSync(settings, 'utf8')).hooks.PreToolUse;
  expect('install-workflow-guard: --remove takes out only its own entry', after.length === 1 && after[0].hooks[0].command === 'echo theirs');
}
