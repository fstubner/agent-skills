'use strict';
// Conventional Commits, and the semantic version they imply.
//
// A subject is `type(scope)!: description`, with the scope and the ! optional.
// fix bumps the patch number and feat the minor number. A ! or a
// "BREAKING CHANGE:" footer bumps the major number. Below 1.0.0 the public
// interface isn't stable yet, so a breaking change bumps the minor number
// there, and the project chooses when to reach 1.0.0.
//
// The guard hook, next-version.cjs and the agent-skills commit-msg hook all
// read this file, so there is one definition of a valid subject.

const TYPES = ['feat', 'fix', 'docs', 'style', 'refactor', 'perf', 'test', 'build', 'ci', 'chore', 'revert'];
const HEADER = /^([a-z]+)(?:\(([^()\r\n]+)\))?(!)?: (\S.*)$/;
// Subjects git writes itself, which carry no type.
const GENERATED = /^(?:Merge (?:pull request|branch|remote-tracking branch|tag) |Revert ")/;

// The parsed subject, or null when it isn't a Conventional Commit.
function parse(message) {
  const [subject = '', ...rest] = String(message).replace(/\r/g, '').split('\n');
  const m = HEADER.exec(subject.trim());
  if (!m || !TYPES.includes(m[1])) return null;
  const body = rest.join('\n');
  return {
    type: m[1],
    scope: m[2] || null,
    breaking: Boolean(m[3]) || /^BREAKING[ -]CHANGE: /m.test(body),
    description: m[4],
  };
}

// Why the subject is refused, or null when it is fine.
function subjectProblem(message) {
  const subject = String(message).replace(/\r/g, '').split('\n')[0].trim();
  if (GENERATED.test(subject) || parse(message)) return null;
  const m = HEADER.exec(subject);
  if (m) return `"${m[1]}" is not a commit type. Use one of ${TYPES.join(', ')}`;
  return `the subject needs a type, as in "fix: the parser read DO NOT SHIP as ship". Types are ${TYPES.join(', ')}`;
}

const LEVELS = ['patch', 'minor', 'major'];

function levelOf(commit, preMajor) {
  if (commit.breaking) return preMajor ? 'minor' : 'major';
  if (commit.type === 'feat') return 'minor';
  if (commit.type === 'fix' || commit.type === 'perf') return 'patch';
  return null;
}

// The bump the commits call for, and the version it produces from `current`
// ("1.4.2" or "v1.4.2"). Returns { level, next }, with level null when no
// commit changes the version.
function nextVersion(current, messages) {
  const [major, minor, patch] = String(current).replace(/^v/, '').split('.').map(Number);
  const preMajor = major === 0;
  let level = null;
  for (const message of messages) {
    const commit = parse(message);
    const l = commit && levelOf(commit, preMajor);
    if (l && (!level || LEVELS.indexOf(l) > LEVELS.indexOf(level))) level = l;
  }
  const next = level === 'major' ? `${major + 1}.0.0`
    : level === 'minor' ? `${major}.${minor + 1}.0`
      : level === 'patch' ? `${major}.${minor}.${patch + 1}`
        : `${major}.${minor}.${patch}`;
  return { level, next };
}

module.exports = { TYPES, parse, subjectProblem, nextVersion, levelOf, GENERATED };
