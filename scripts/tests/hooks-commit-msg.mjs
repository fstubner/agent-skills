import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { root, expect, tmpBase } from './harness.mjs';

// The commit-msg hook: the audience, stated at every commit.
// A commit message is published more durably than the code — it cannot be
// edited afterwards without rewriting history — and this repository's messages
// are long and discursive, which is the register in which private detail
// arrives by accident.
//
// The hook ANSWERS the audience question rather than asking it. Two reasons,
// and both are testable: a prompt on every commit is answered reflexively
// within a week, and eval-batch.mjs commits on its own after a verify pass, so
// a hook blocking on stdin would hang a multi-hour measurement at the first
// bundle. What can be recognised mechanically is refused instead.
{
  const hookPath = path.join(root, 'scripts', 'git-hooks', 'commit-msg');
  const syntaxCheck = spawnSync(process.execPath, ['--check', hookPath], { encoding: 'utf8' });
  expect('syntax scripts/git-hooks/commit-msg', syntaxCheck.status === 0, (syntaxCheck.stderr || '').split('\n')[0]);

  const msgRepo = fs.mkdtempSync(path.join(tmpBase, 'commit-msg-'));
  spawnSync('git', ['init', '-q'], { cwd: msgRepo });
  spawnSync('git', ['remote', 'add', 'origin', 'https://github.com/fstubner/agent-skills.git'], { cwd: msgRepo });
  const msgFile = path.join(msgRepo, 'COMMIT_EDITMSG');
  const runHook = (message, cwd = msgRepo) => {
    fs.writeFileSync(msgFile, message);
    return spawnSync(process.execPath, [hookPath, msgFile], { cwd, encoding: 'utf8' });
  };

  const clean = runHook('The drift job read the bytes of a page instead of the page\n\nTags collapse to a space now.\n');
  expect('commit-msg: a clean message passes', clean.status === 0, clean.stderr);
  expect('commit-msg: and is told where it will be published',
    /will be published at https:\/\/github\.com\/fstubner\/agent-skills/.test(clean.stderr), clean.stderr);

  // Each of these was found in this session's own working notes, which is how
  // they get into a message in the first place.
  for (const [what, message] of [
    ['a Windows home path', 'Fixed it\n\nRan node C:\\Users\\Felix\\.gemini\\config\\x.js and it worked.\n'],
    ['a POSIX home path', 'Fixed it\n\nSee /home/felix/projects/notes.md for the trace.\n'],
    ['a local scratch path', 'Fixed it\n\nOutput went to AppData\\Local\\Temp\\claude\\scratch.\n'],
    ['an IP address', 'Fixed it\n\nThe box at 192.168.1.14 refused the connection.\n'],
  ]) {
    const blocked = runHook(message);
    expect(`commit-msg: refuses ${what}`, blocked.status === 1, `exit ${blocked.status}: ${blocked.stderr}`);
  }
  const named = runHook('Fixed it\n\nRan node C:\\Users\\Felix\\.gemini\\config\\x.js and it worked.\n');
  expect('commit-msg: names what it found, so the message can be rewritten',
    /home-directory path: /.test(named.stderr), named.stderr);

  // Git's own commentary is stripped before the message is stored, so scanning
  // it would refuse commits over the help text git wrote itself.
  const commented = runHook('Subject line\n\n# Please enter the commit message for your changes.\n# On branch main, e.g. /home/runner/work is only in this comment.\n');
  expect('commit-msg: ignores git\'s own comment lines', commented.status === 0, commented.stderr);

  // The rule is about identifiers, not vocabulary. A message describing a run
  // that died on a quota event is describing evidence, and a hook that argued
  // with it would be trained away inside a day.
  const prose = runHook('Codex quota is gone, so the pre-registered second harness cannot run\n');
  expect('commit-msg: does not argue with prose about quota or cost', prose.status === 0, prose.stderr);

  // There is no email clause, decided by replaying all 224 messages in this
  // repository's history: one refused 11, every hit a vendor bot quoted in a
  // merge commit (support@github.com, cursoragent@cursor.com) and not one a
  // person. A rule that fires only on false positives teaches --no-verify.
  const vendorBot = runHook('build(deps): bump the harness-clis group\n\nSigned-off-by: dependabot[bot] <support@github.com>\n');
  expect('commit-msg: a vendor bot address in a merge commit is not a leak',
    vendorBot.status === 0, vendorBot.stderr);

  // Six commits in this history carry `Co-authored-by: Cursor
  // <cursoragent@cursor.com>`, put there by a tool. Removing those needs a
  // history rewrite; refusing the seventh does not, and the standing rule for
  // this project is that no commit carries a Co-Authored-By footer at all.
  for (const [what, message] of [
    ['a Co-authored-by trailer', 'Add the thing\n\nCo-authored-by: Cursor <cursoragent@cursor.com>\n'],
    // The bare form too. No commit in this history carries it, so the clause
    // costs nothing against the past — it exists because dropping two
    // characters is the obvious way around the Co- rule.
    ['a bare Authored-by trailer', 'Add the thing\n\nAuthored-by: Some Tool <tool@example.com>\n'],
    ['a generated-with footer', 'Add the thing\n\n🤖 Generated with [Some Tool](https://example.com)\n'],
  ]) {
    const blocked = runHook(message);
    expect(`commit-msg: refuses ${what}`, blocked.status === 1, `exit ${blocked.status}: ${blocked.stderr}`);
  }
  // But not a squash-merge trailer GitHub wrote server-side, which never
  // passes through this hook and claims nothing about authorship.
  const squash = runHook('build(deps): bump the harness-clis group (#21)\n\nSigned-off-by: dependabot[bot] <support@github.com>\n');
  expect('commit-msg: a GitHub squash-merge sign-off is not tool attribution',
    squash.status === 0, squash.stderr);

  // The shape rules. Each was measured against the 215 human non-merge commits
  // in this history before it was added, so each refuses something this
  // repository already avoids rather than importing a style from elsewhere.
  for (const [what, message] of [
    ['a subject ending in a period', 'Add the thing.\n'],
    ['a missing blank line after the subject', 'Add the thing\nStraight into the body.\n'],
    ['a body line past 80 columns', `Add the thing\n\n${'x'.repeat(81)}\n`],
  ]) {
    const blocked = runHook(message);
    expect(`commit-msg: refuses ${what}`, blocked.status === 1, `exit ${blocked.status}: ${blocked.stderr}`);
  }

  // An ellipsis is not a sentence-ending period.
  const ellipsis = runHook('The run stopped somewhere in the middle...\n');
  expect('commit-msg: an ellipsis is not a trailing period', ellipsis.status === 0, ellipsis.stderr);

  // Indented lines are quoted output. 11 of the 34 over-length lines in this
  // history are eval report tables whose columns are aligned on purpose, and
  // rewrapping them would destroy the alignment that makes them legible.
  const table = runHook(`Report the arm\n\n${'  '}${'y'.repeat(90)}\n`);
  expect('commit-msg: indented quoted output may exceed the column limit',
    table.status === 0, table.stderr);

  // Exactly 80 is inside the limit, not over it.
  const exact = runHook(`Add the thing\n\n${'z'.repeat(80)}\n`);
  expect('commit-msg: 80 columns exactly is allowed', exact.status === 0, exact.stderr);

  // The subject is uncapped on purpose: 45% of recent subjects run past 72
  // characters because the subject states a finding, not a category.
  const longSubject = runHook(`${'A finding stated at length '.repeat(4)}\n`);
  expect('commit-msg: a long subject is not a style failure',
    longSubject.status === 0, longSubject.stderr);

  // And Conventional Commits is not required — 1 of 215 human commits uses a
  // type prefix. A hook demanding one would refuse this repository's history.
  const narrative = runHook('The verdict parser read "DO NOT SHIP" as ship\n\nIt matched on the substring.\n');
  expect('commit-msg: a narrative subject with no type prefix passes',
    narrative.status === 0, narrative.stderr);

  const noRemote = fs.mkdtempSync(path.join(tmpBase, 'commit-msg-local-'));
  spawnSync('git', ['init', '-q'], { cwd: noRemote });
  const local = runHook('A clean message\n', noRemote);
  expect('commit-msg: says so when there is no remote to publish to',
    local.status === 0 && /stays on this machine/.test(local.stderr), local.stderr);
}
