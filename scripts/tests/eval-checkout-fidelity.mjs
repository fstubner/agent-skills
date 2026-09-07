// A fresh clone must reproduce the bytes the bundles were hashed from.
//
// Every run bundle records sha256 digests of its fixture, its grader and its
// own outputs, and eval-verify recomputes them from the files on disk. That
// binding is only worth anything if the files on disk are the files git
// stores. Twice now they have not been, and both times the suite was green on
// the machine that wrote the bundle and red on every clean checkout:
//
//   - .agent-evidence/ is gitignored, so gate reports written INTO a run's
//     outputs were never committed. 14 runs hashed files a clone does not
//     have. The same hole was found in eval/fixtures-v2on 2026-09-06 and
//     patched there only; the run bundles kept it.
//   - .gitattributes normalises text to LF on commit, but git never rewrites
//     a file already in the worktree. The secrets-baked-into-image fixture,
//     its grader and nine runs' copies of it were authored CRLF, hashed CRLF,
//     and stored LF. CI checked out LF and computed a different digest.
//
// Neither is visible locally: `git status` is clean in both cases, because
// git compares content the same way it stored it. So the check has to ask git
// what it would hand a stranger, not whether the worktree looks tidy.
//
// The two clauses below are that question, split by failure mode. They run
// against the real repository rather than a temp fixture: the defect IS the
// state of this checkout, and a synthetic one would prove nothing about it.
import path from 'path';
import { spawnSync } from 'child_process';
import { expect } from './harness.mjs';

const root = path.resolve(import.meta.dirname, '..', '..');
// eval/ holds ~24k tracked files and the eol listing runs to megabytes, well
// past spawnSync's 1MB default. A truncated listing is the dangerous failure
// here: it silently shortens the list of offenders, and the first draft of
// this test reported 5 of the 24 real ones and would have reported 0 once
// those were fixed. The row-count clause below is what proves it did not
// happen; the buffer is what stops it happening.
const git = (...args) => spawnSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 512 * 1024 * 1024 });

const available = git('rev-parse', '--is-inside-work-tree').status === 0;

// A bundle mid-assembly lives under `eval/runs/.<runId>.partial/` and is
// ignored on purpose — eval-verify skips it too. Nothing else under eval/ may
// be absent from a clone.
const isStaging = (file) => file.split('/').some((seg) => seg.startsWith('.') && seg.endsWith('.partial'));

function ignoredButPresent() {
  const out = git('ls-files', '--others', '--ignored', '--exclude-standard', '--', 'eval/');
  return out.stdout.split('\n').map((l) => l.trim()).filter(Boolean).filter((f) => !isStaging(f));
}

// `git ls-files --eol` reports the line endings git holds (i/) and the ones on
// disk (w/). They disagree exactly when a checkout would rewrite the file,
// which is exactly when its recorded digest stops matching. `none` is git's
// answer for a file with no line endings to convert, and `-text` for one
// pinned against conversion; either agreeing with itself is fine.
// The attr/ field holds the resolved attributes and contains spaces
// ("attr/text=auto eol=lf"), so the path is taken from the tab, not from a
// whitespace split. Getting that wrong parses nothing and the clause passes
// on an empty list, which is why `parsed` is asserted separately.
function eolRewrites() {
  const out = git('ls-files', '--eol', '--', 'eval/');
  const rewrites = [];
  let parsed = 0;
  for (const line of out.stdout.split('\n')) {
    const tab = line.indexOf('\t');
    const m = /^i\/(\S+)\s+w\/(\S+)\s/.exec(line);
    if (tab < 0 || !m) continue;
    parsed += 1;
    const [, index, worktree] = m;
    if (index !== worktree) rewrites.push(`${line.slice(tab + 1)} (git ${index}, disk ${worktree})`);
  }
  return { rewrites, parsed };
}

if (!available) {
  expect('checkout fidelity: skipped, not a git work tree', true);
} else {
  const missing = ignoredButPresent();
  expect('no file under eval/ is ignored by git but present on disk',
    missing.length === 0,
    `${missing.length} would be absent from a fresh clone: ${missing.slice(0, 3).join(', ')}`);

  const tracked = git('ls-files', '--', 'eval/').stdout.split('\n').filter(Boolean).length;
  const { rewrites, parsed } = eolRewrites();
  expect('every tracked file under eval/ was actually examined',
    parsed === tracked && tracked > 0, `parsed ${parsed} of ${tracked} tracked files`);
  expect('no file under eval/ changes line endings when git checks it out',
    rewrites.length === 0,
    `${rewrites.length} would differ from the bytes hashed: ${rewrites.slice(0, 3).join(', ')}`);
}
