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

  const clean = runHook('fix: read the page instead of its bytes in the drift job\n\nTags collapse to a space now.\n');
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
  const commented = runHook('chore: subject line\n\n# Please enter the commit message for your changes.\n# On branch main, e.g. /home/runner/work is only in this comment.\n');
  expect('commit-msg: ignores git\'s own comment lines', commented.status === 0, commented.stderr);

  // The rule is about identifiers, not vocabulary. A message describing a run
  // that died on a quota event is describing evidence, and a hook that argued
  // with it would be trained away inside a day.
  const prose = runHook('docs: note that Codex quota is gone, so the second harness cannot run\n');
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
    ['a body line past 72 columns', `feat: add the thing\n\n${'x '.repeat(37)}\n`],
  ]) {
    const blocked = runHook(message);
    expect(`commit-msg: refuses ${what}`, blocked.status === 1, `exit ${blocked.status}: ${blocked.stderr}`);
  }

  // An ellipsis is not a sentence-ending period.
  const ellipsis = runHook('fix: stop the run somewhere in the middle...\n');
  expect('commit-msg: an ellipsis is not a trailing period', ellipsis.status === 0, ellipsis.stderr);

  // Indented lines are quoted output. 11 of the 34 over-length lines in this
  // history are eval report tables whose columns are aligned on purpose, and
  // rewrapping them would destroy the alignment that makes them legible.
  const table = runHook(`docs: report the arm\n\n${'  '}${'y '.repeat(45)}\n`);
  expect('commit-msg: indented quoted output may exceed the column limit',
    table.status === 0, table.stderr);

  // Exactly 72 is inside the limit, not over it.
  const exact = runHook(`feat: add the thing\n\n${'z '.repeat(36).trimEnd()}\n`);
  expect('commit-msg: 72 columns exactly is allowed', exact.status === 0, exact.stderr);

  // The subject is a title of at most 72 characters. The detail goes in the body.
  const longSubject = runHook(`fix: ${'stop a finding stated at length '.repeat(3)}\n`);
  expect('commit-msg: a subject over 72 characters is refused',
    longSubject.status === 1 && /Keep it to 72/.test(longSubject.stderr), longSubject.stderr);
  const pastTense = runHook('fix: stopped reading DO NOT SHIP as ship\n');
  expect('commit-msg: a description in the past tense is refused, since the format is imperative',
    pastTense.status === 1 && /instruction/.test(pastTense.stderr), pastTense.stderr);

  // The subject is a Conventional Commit, since next-version.cjs reads the
  // type. The description after it still states the finding.
  const narrative = runHook('The verdict parser read "DO NOT SHIP" as ship\n\nIt matched on the substring.\n');
  expect('commit-msg: a subject without a type is refused, and the refusal names the types',
    narrative.status === 1 && /needs a type/.test(narrative.stderr), narrative.stderr);
  const typed = runHook('fix(eval)!: stop reading "DO NOT SHIP" as ship\n\nIt matched on the substring.\n');
  expect('commit-msg: a typed subject with a scope and a breaking mark passes', typed.status === 0, typed.stderr);
  const merge = runHook('Merge pull request #30 from fstubner/repo-docs\n');
  expect('commit-msg: a merge commit git wrote needs no type', merge.status === 0, merge.stderr);

  const noRemote = fs.mkdtempSync(path.join(tmpBase, 'commit-msg-local-'));
  spawnSync('git', ['init', '-q'], { cwd: noRemote });
  const local = runHook('chore: a clean message\n', noRemote);
  expect('commit-msg: says so when there is no remote to publish to',
    local.status === 0 && /stays on this machine/.test(local.stderr), local.stderr);
}
